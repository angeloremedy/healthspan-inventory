// ONE-TIME (re-runnable) MIGRATION: pulls the COMPLETE Shopify order history and
// writes it into Supabase — orders + order_lines (source='shopify', keyed by the
// Shopify order number so re-runs refresh instead of duplicate) and the accounts
// table (insert-only: existing CRM edits are never touched).
// Requires Netlify env: SUPABASE_URL, SUPABASE_SERVICE_KEY (+ existing Shopify creds).
import crypto from 'node:crypto';
import { connectLambda, getStore } from '@netlify/blobs';

const STORE_HANDLE = process.env.SHOPIFY_STORE || 'healthspan-global';
const API = 'https://' + STORE_HANDLE + '.myshopify.com/admin/api/2025-01/graphql.json';
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';

async function getAccessToken() {
  const legacy = (process.env.SHOPIFY_ADMIN_TOKEN || '').trim();
  if (legacy.startsWith('shpat_')) return legacy;
  const id = (process.env.SHOPIFY_CLIENT_ID || '').trim();
  const secret = (process.env.SHOPIFY_CLIENT_SECRET || '').trim();
  if (!id || !secret) throw new Error('Missing SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET');
  const r = await fetch('https://' + STORE_HANDLE + '.myshopify.com/admin/oauth/access_token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: id, client_secret: secret })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Token exchange failed: ' + JSON.stringify(j).slice(0, 150));
  return j.access_token;
}
async function gql(token, query, variables) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!r.ok) throw new Error('Shopify HTTP ' + r.status);
  const j = await r.json();
  if (j.errors && !j.data) throw new Error('GraphQL: ' + JSON.stringify(j.errors).slice(0, 150));
  return j.data;
}
async function sb(path, method, body, prefer) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    method,
    headers: {
      apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json', Prefer: prefer || 'return=minimal'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error('Supabase ' + method + ' ' + path.split('?')[0] + ': ' + (await r.text()).slice(0, 200));
  return r;
}
// deterministic UUID from the Shopify order number → re-runs hit the same row
const refUuid = ref => {
  const h = crypto.createHash('sha1').update('hs-order:' + ref).digest('hex');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-8' + h.slice(17, 20) + '-' + h.slice(20, 32);
};
const sleep = ms => new Promise(res => setTimeout(res, ms));

export const handler = async (event) => {
  try { connectLambda(event); } catch (e) {}
  let store = null; try { store = getStore('shopify'); } catch (e) {}
  const setStatus = async (s) => { if (store) { try { await store.setJSON('backfill', { ...s, at: new Date().toISOString() }); } catch (e) {} } };
  const t0 = Date.now();
  try {
    if (!SB_URL || !SB_KEY) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in Netlify env');
    const token = await getAccessToken();
    let cursor = null, pages = 0, nOrders = 0, nLines = 0;
    const accounts = {}; // name -> {phone,address}
    for (let page = 0; page < 600; page++) {
      const d = await gql(token,
        'query($c:String){orders(first:60,after:$c,query:"status:any",sortKey:CREATED_AT){pageInfo{hasNextPage endCursor}edges{node{name createdAt cancelledAt tags note displayFulfillmentStatus displayFinancialStatus totalReceivedSet{shopMoney{amount}}totalOutstandingSet{shopMoney{amount}}customer{displayName phone defaultAddress{address1 city phone}}lineItems(first:60){edges{node{title sku quantity discountedTotalSet{shopMoney{amount}}}}}}}}}',
        { c: cursor });
      const os = d.orders; pages++;
      const orderRows = [], lineRows = [], delIds = [];
      for (const e of os.edges) {
        const o = e.node;
        const tag = (o.tags && o.tags.length ? String(o.tags[0]).trim() : '');
        if (tag.toUpperCase() === 'TEST') continue;
        const cust = (o.customer && o.customer.displayName) || '';
        if (/pull\s*-?\s*out/i.test(cust)) continue;
        const lis = [];
        for (const le of o.lineItems.edges) {
          const li = le.node; const sku = (li.sku || '').trim(); if (!sku) continue;
          lis.push({ sku, title: li.title || sku, qty: li.quantity || 0, amt: Math.round(parseFloat((li.discountedTotalSet && li.discountedTotalSet.shopMoney && li.discountedTotalSet.shopMoney.amount) || '0') || 0) });
        }
        if (!lis.length) continue;
        const id = refUuid(o.name);
        const total = lis.reduce((a, l) => a + l.amt, 0);
        const status = o.cancelledAt ? 'cancelled' : (o.displayFulfillmentStatus === 'FULFILLED' ? 'fulfilled' : 'pending');
        // payments: Shopify's own financial tracking (accounting marks paid there)
        const fin = String(o.displayFinancialStatus || '').toUpperCase();
        const paid = Math.round(parseFloat((o.totalReceivedSet && o.totalReceivedSet.shopMoney.amount) || '0') || 0);
        const outst = Math.round(parseFloat((o.totalOutstandingSet && o.totalOutstandingSet.shopMoney.amount) || '0') || 0);
        const pay_status = o.cancelledAt ? 'refunded' : fin === 'PAID' ? 'paid' : fin === 'REFUNDED' || fin === 'PARTIALLY_REFUNDED' ? 'refunded' : fin === 'PARTIALLY_PAID' ? 'partial' : 'pending';
        const note = String(o.note || '').slice(0, 500) || null;
        // payment terms live in free-text notes, e.g. "50% down & 50% PDC 30 days"
        const tm = note && note.match(/(\d{1,3})\s*(?:days?|dys?)\b/i);
        const terms_days = tm ? parseInt(tm[1], 10) : null;
        orderRows.push({ id, source: 'shopify', ext_ref: o.name, date: o.createdAt.slice(0, 10), account: cust, spec: tag || '', status, total, user_id: null,
          pay_status, paid, balance: o.cancelledAt ? 0 : Math.max(0, outst || (total - paid)), terms_days, order_note: note });
        delIds.push(id);
        for (const l of lis) {
          const isDealPart = l.sku.length >= 4 && lis.some(o2 => o2.sku !== l.sku && o2.sku.length > l.sku.length && o2.sku.includes(l.sku));
          lineRows.push({ order_id: id, sku: l.sku, name: l.title, qty: l.qty, price: l.qty ? Math.round(l.amt / l.qty) : 0, amount: l.amt, is_free: l.amt <= 0 && !isDealPart, deal: null });
        }
        if (cust && !accounts[cust]) {
          const ad = o.customer && o.customer.defaultAddress;
          accounts[cust] = {
            name: cust,
            phone: (o.customer && o.customer.phone) || (ad && ad.phone) || null,
            address: ad ? [ad.address1, ad.city].filter(Boolean).join(', ') || null : null
          };
        }
      }
      if (orderRows.length) {
        await sb('orders?on_conflict=ext_ref', 'POST', orderRows, 'resolution=merge-duplicates,return=minimal');
        await sb('order_lines?order_id=in.(' + delIds.map(x => '"' + x + '"').join(',') + ')', 'DELETE'); // idempotent lines
        for (let i = 0; i < lineRows.length; i += 400) await sb('order_lines', 'POST', lineRows.slice(i, i + 400));
        nOrders += orderRows.length; nLines += lineRows.length;
      }
      if (pages % 5 === 0) await setStatus({ state: 'running', pages, orders: nOrders });
      if (!os.pageInfo.hasNextPage) break;
      cursor = os.pageInfo.endCursor;
      await sleep(300);
    }
    // customer records: insert-only, never touches existing CRM edits
    const acctRows = Object.values(accounts);
    for (let i = 0; i < acctRows.length; i += 300)
      await sb('accounts?on_conflict=name', 'POST', acctRows.slice(i, i + 300), 'resolution=ignore-duplicates,return=minimal');
    await setStatus({ state: 'done', pages, orders: nOrders, lines: nLines, customers: acctRows.length, secs: Math.round((Date.now() - t0) / 1000) });
  } catch (err) {
    await setStatus({ state: 'error', error: String(err.message || err) });
  }
  return { statusCode: 200, body: 'done' };
};
