// SHOPIFY → SUPABASE IMPORT (re-runnable). Two modes:
//   full    (nightly, from nightly.mjs)          the COMPLETE order history, oldest first
//   recent  (every 15 min, from shopify-recent.mjs; POST ?recent=1 or {recent:true})
//           only orders Shopify changed in the last 2 days — new orders, edits, payments,
//           cancellations, refunds — so HQ (and through it QuickBooks) is minutes behind
//           Shopify, not a day
// Writes orders + order_lines (source='shopify', keyed by the Shopify order number so
// re-runs refresh instead of duplicate) and the accounts table (insert-only: existing
// CRM edits are never touched).
//
// Since 2026-09-18 every imported order on/after app_settings.qbo_src_from also carries
// orders.qbo_src: the order in the QuickBooks connector's ORDER-CONTRACT shape (list
// prices, discount allocations, per-line VAT, totals, customer/company, payment terms,
// edits and refunds) — exactly what lib/qbo-map.mjs needs to post the SAME invoice the
// old Shopify→QBO connector posted. Money is kept to the centavo (Shopify's 2 dp): a
// QuickBooks total must tie out exactly, so the import may no longer round to pesos.
// Dates are the MANILA calendar date of Shopify's timestamp, never the UTC one.
// Requires Netlify env: SUPABASE_URL, SUPABASE_SERVICE_KEY (+ existing Shopify creds).
import crypto from 'node:crypto';
import { connectLambda, getStore } from '@netlify/blobs';
import { requireJobKey } from './lib/guard.mjs';
import { dateInTz, money } from './lib/qbo-map.mjs';

const STORE_HANDLE = process.env.SHOPIFY_STORE || 'healthspan-global';
const API = 'https://' + STORE_HANDLE + '.myshopify.com/admin/api/2025-01/graphql.json';
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const RECENT_DAYS = 2;

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
  if (j.errors && !j.data) { const e = new Error('GraphQL: ' + JSON.stringify(j.errors).slice(0, 300)); e.cost = /max cost|query cost|throttled/i.test(JSON.stringify(j.errors)); throw e; }
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
async function settingValue(key, dflt) {
  try { const r = await fetch(SB_URL + '/rest/v1/app_settings?key=eq.' + encodeURIComponent(key) + '&select=value', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }); if (r.ok) { const j = await r.json(); const v = (j[0] && j[0].value) || ''; if (v) return v; } } catch (e) {}
  return dflt;
}
// deterministic UUID from the Shopify order number → re-runs hit the same row
const refUuid = ref => {
  const h = crypto.createHash('sha1').update('hs-order:' + ref).digest('hex');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-8' + h.slice(17, 20) + '-' + h.slice(20, 32);
};
const sleep = ms => new Promise(res => setTimeout(res, ms));
const amt = set => money((set && set.shopMoney && set.shopMoney.amount) || 0);
const s2 = v => money(v).toFixed(2);
const gidNum = gid => { const m = String(gid || '').match(/(\d+)$/); return m ? Number(m[1]) : (gid || null); };
const nodes = conn => conn && conn.edges ? conn.edges.map(e => e.node) : (Array.isArray(conn) ? conn : []);

// Everything the order carries that HQ or QuickBooks needs — one page of orders.
const QUERY = 'query($c:String,$q:String,$n:Int!,$sort:OrderSortKeys!){orders(first:$n,after:$c,query:$q,sortKey:$sort){pageInfo{hasNextPage endCursor}edges{node{' +
  'id name createdAt updatedAt cancelledAt tags note email taxesIncluded currencyCode displayFulfillmentStatus displayFinancialStatus discountCodes ' +
  'totalPriceSet{shopMoney{amount}} totalTaxSet{shopMoney{amount}} totalDiscountsSet{shopMoney{amount}} currentTotalPriceSet{shopMoney{amount}} currentTotalTaxSet{shopMoney{amount}} currentTotalDiscountsSet{shopMoney{amount}} ' +
  'totalTipReceivedSet{shopMoney{amount}} currentTotalDutiesSet{shopMoney{amount}} totalReceivedSet{shopMoney{amount}} totalOutstandingSet{shopMoney{amount}} ' +
  'shippingLines(first:5){edges{node{title originalPriceSet{shopMoney{amount}} taxLines{rate priceSet{shopMoney{amount}}}}}} ' +
  'paymentTerms{paymentTermsName paymentTermsType dueInDays paymentSchedules(first:1){edges{node{dueAt}}}} ' +
  'purchasingEntity{__typename ... on PurchasingCompany{company{name}}} billingAddress{company} ' +
  'customer{id firstName lastName displayName email phone defaultAddress{address1 city phone company}} ' +
  'fulfillments(first:3){createdAt deliveredAt displayStatus trackingInfo(first:3){company number}} ' +
  'refunds{id createdAt refundLineItems(first:20){edges{node{quantity lineItem{id} totalTaxSet{shopMoney{amount}}}}} transactions(first:5){edges{node{kind status amountSet{shopMoney{amount}}}}}} ' +
  'lineItems(first:60){edges{node{id sku title variantTitle quantity currentQuantity taxable variant{id} originalUnitPriceSet{shopMoney{amount}} discountedTotalSet{shopMoney{amount}} discountAllocations{allocatedAmountSet{shopMoney{amount}}} taxLines{rate priceSet{shopMoney{amount}}}}}}' +
  '}}}}';

// The order as the QuickBooks connector's ORDER-CONTRACT describes it (docs/inhouse/ORDER-CONTRACT.md):
// REST field names, money as 2-dp strings, ids numeric. lib/qbo-map.mjs → normalizeShopify() reads this.
export function toQboSrc(o) {
  const lis = nodes(o.lineItems);
  const edited = lis.some(li => li.currentQuantity != null && li.currentQuantity !== li.quantity);
  const src = {
    id: gidNum(o.id), name: o.name, email: o.email || (o.customer && o.customer.email) || '', currency: o.currencyCode || 'PHP', taxes_included: o.taxesIncluded !== false,
    created_at: o.createdAt, updated_at: o.updatedAt || null, cancelled_at: o.cancelledAt || null, financial_status: String(o.displayFinancialStatus || '').toLowerCase(), note: o.note || '',
    total_price: s2(amt(o.totalPriceSet)), total_tax: s2(amt(o.totalTaxSet)), total_discounts: s2(amt(o.totalDiscountsSet)), total_tip_received: s2(amt(o.totalTipReceivedSet)),
    total_duties: s2(amt(o.currentTotalDutiesSet)), total_outstanding: o.totalOutstandingSet ? s2(amt(o.totalOutstandingSet)) : null,
    payment_terms: o.paymentTerms ? { payment_terms_name: o.paymentTerms.paymentTermsName || '', payment_terms_type: o.paymentTerms.paymentTermsType || '', due_in_days: o.paymentTerms.dueInDays == null ? null : Number(o.paymentTerms.dueInDays), payment_schedules: nodes(o.paymentTerms.paymentSchedules).map(s => ({ due_at: s.dueAt || null })) } : null,
    customer: o.customer ? { id: gidNum(o.customer.id), first_name: o.customer.firstName || '', last_name: o.customer.lastName || '', display_name: o.customer.displayName || '', email: o.customer.email || '', phone: o.customer.phone || '', default_address: o.customer.defaultAddress ? { company: o.customer.defaultAddress.company || '' } : null } : null,
    billing_address: { company: (o.billingAddress && o.billingAddress.company) || '' },
    company: o.purchasingEntity && o.purchasingEntity.__typename === 'PurchasingCompany' && o.purchasingEntity.company ? { name: o.purchasingEntity.company.name || '' } : null,
    discount_codes: (o.discountCodes || []).map(code => ({ code })),
    line_items: lis.map(li => ({ id: gidNum(li.id), variant_id: li.variant ? gidNum(li.variant.id) : null, sku: (li.sku || '').trim(), title: li.title || '', variant_title: li.variantTitle || 'Default Title',
      price: s2(amt(li.originalUnitPriceSet)), quantity: Number(li.quantity) || 0, current_quantity: li.currentQuantity == null ? null : Number(li.currentQuantity), taxable: li.taxable !== false,
      discount_allocations: (li.discountAllocations || []).map(d => ({ amount: s2(amt(d.allocatedAmountSet)) })), tax_lines: (li.taxLines || []).map(t => ({ rate: Number(t.rate) || 0, price: s2(amt(t.priceSet)) })) })),
    shipping_lines: nodes(o.shippingLines).map(l => ({ title: l.title || 'Shipping', price: s2(amt(l.originalPriceSet)), tax_lines: (l.taxLines || []).map(t => ({ rate: Number(t.rate) || 0, price: s2(amt(t.priceSet)) })) })),
    refunds: (o.refunds || []).map(r => ({ id: gidNum(r.id), created_at: r.createdAt, refund_line_items: nodes(r.refundLineItems).map(x => ({ line_item_id: x.lineItem ? gidNum(x.lineItem.id) : null, quantity: Number(x.quantity) || 0, total_tax: s2(amt(x.totalTaxSet)) })),
      transactions: nodes(r.transactions).map(t => ({ kind: String(t.kind || '').toLowerCase(), status: String(t.status || '').toLowerCase(), amount: s2(amt(t.amountSet)) })) }))
  };
  if (edited) { src.current_total_price = s2(amt(o.currentTotalPriceSet)); src.current_total_tax = s2(amt(o.currentTotalTaxSet)); src.current_total_discounts = s2(amt(o.currentTotalDiscountsSet)); src.current_total_duties = s2(amt(o.currentTotalDutiesSet)); }
  return src;
}

export const handler = async (event) => {
  // ── AUTH: JOB_KEY (x-job-key header or ?key=). Fail closed when it is unset.
  { const gate = requireJobKey(event); if (gate) return gate; }

  let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) {}
  const qs = event.queryStringParameters || {};
  const recent = qs.recent === '1' || body.recent === true || body.recent === 1;
  try { connectLambda(event); } catch (e) {}
  let store = null; try { store = getStore('shopify'); } catch (e) {}
  const statusKey = recent ? 'backfill-recent' : 'backfill';
  const setStatus = async (s) => { if (store) { try { await store.setJSON(statusKey, { ...s, mode: recent ? 'recent' : 'full', at: new Date().toISOString() }); } catch (e) {} } };
  const t0 = Date.now();
  try {
    if (!SB_URL || !SB_KEY) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in Netlify env');
    const token = await getAccessToken();
    // PERIOD CLOSE: orders already inside a closed accounting period keep their
    // amounts, dates and lines. We still sync collections and shipping for them
    // (a July invoice paid in September is real), and we may still import an
    // order we have never seen — but we never restate a signed-off month.
    let closedThrough = '';
    { const v = await settingValue('closed_through', ''); if (/^\d{4}-\d{2}-\d{2}$/.test(v)) closedThrough = v; }
    const qboSrcFrom = await settingValue('qbo_src_from', '2026-09-01'); // orders created on/after this date carry qbo_src
    let known = new Set(), knownTruncated = false; // ext_refs that already exist, so we can tell import from restate
    if (closedThrough) {
      try {
        for (let off = 0; off < 20000; off += 1000) {
          const r = await fetch(SB_URL + '/rest/v1/orders?select=ext_ref&source=eq.shopify&date=lte.' + closedThrough + '&order=ext_ref&limit=1000&offset=' + off,
            { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
          if (!r.ok) break;
          const j = await r.json();
          j.forEach(x => { if (x.ext_ref) known.add(x.ext_ref); });
          if (j.length < 1000) break;
          if (off >= 19000) knownTruncated = true; // more closed orders than we paged
        }
      } catch (e) {}
    }
    let nFrozen = 0, nSrc = 0;
    let cursor = null, pages = 0, nOrders = 0, nLines = 0;
    let pageSize = recent ? 25 : 40; // halves itself when Shopify says the query costs too much
    const q = recent ? 'status:any updated_at:>=' + new Date(Date.now() - RECENT_DAYS * 86400000).toISOString() : 'status:any';
    const sort = recent ? 'UPDATED_AT' : 'CREATED_AT';
    const accounts = {}; // name -> {phone,address}
    for (let page = 0; page < 800; page++) {
      let d;
      try { d = await gql(token, QUERY, { c: cursor, q, n: pageSize, sort }); }
      catch (e) { if (e.cost && pageSize > 5) { pageSize = Math.max(5, Math.floor(pageSize / 2)); await sleep(1500); page--; continue; } throw e; }
      const os = d.orders; pages++;
      const orderRows = [], shipRows = [], frozenRows = [], frozenShipRows = [], lineRows = [], delIds = [];
      for (const e of os.edges) {
        const o = e.node;
        const tag = (o.tags && o.tags.length ? String(o.tags[0]).trim() : '');
        if (tag.toUpperCase() === 'TEST') continue;
        const cust = (o.customer && o.customer.displayName) || '';
        if (/pull\s*-?\s*out/i.test(cust)) continue;
        const lis = [];
        for (const le of o.lineItems.edges) {
          const li = le.node; const sku = (li.sku || '').trim(); if (!sku) continue;
          // order edits: removed lines stay in lineItems with currentQuantity 0 —
          // count only what the order holds NOW, scale money to the kept quantity
          const oq = li.quantity || 0;
          const cq = (li.currentQuantity == null) ? oq : li.currentQuantity;
          if (!cq) continue;
          const rawAmt = amt(li.discountedTotalSet);
          lis.push({ sku, title: li.title || sku, qty: cq, amt: money((oq && cq !== oq) ? rawAmt * cq / oq : rawAmt) });
        }
        if (!lis.length) continue;
        const id = refUuid(o.name);
        const total = money(lis.reduce((a, l) => a + l.amt, 0));
        const status = o.cancelledAt ? 'cancelled' : (o.displayFulfillmentStatus === 'FULFILLED' ? 'fulfilled' : 'pending');
        // payments: Shopify's own financial tracking (accounting marks paid there)
        const fin = String(o.displayFinancialStatus || '').toUpperCase();
        let pay_status = o.cancelledAt ? 'refunded' : fin === 'PAID' ? 'paid' : fin === 'REFUNDED' || fin === 'PARTIALLY_REFUNDED' ? 'refunded' : fin === 'PARTIALLY_PAID' ? 'partial' : 'pending';
        // Shopify's totalOutstanding IS the truth (0 on paid orders — even those marked
        // paid manually with no gateway "received" amount). Never second-guess it.
        const hasOut = !!(o.totalOutstandingSet && o.totalOutstandingSet.shopMoney);
        const outst = hasOut ? amt(o.totalOutstandingSet) : null;
        const balance = (o.cancelledAt || pay_status === 'refunded') ? 0
          : pay_status === 'paid' ? Math.max(0, outst || 0)
          : (outst !== null ? Math.max(0, outst) : total);
        const paid = money(Math.max(0, total - balance));
        // Shopify shows "Paid" on the original charge even when the order still owes
        // money (50% down / 50% PDC, or items added after payment). Money owed = partial.
        if (pay_status === 'paid' && balance > 0) pay_status = 'partial';
        const note = String(o.note || '').slice(0, 500) || null;
        // payment terms live in free-text notes, e.g. "50% down & 50% PDC 30 days"
        const tm = note && note.match(/(\d{1,3})\s*(?:days?|dys?)\b/i);
        const terms_days = tm ? parseInt(tm[1], 10) : null;
        // shipment info from Shopify fulfillments (tracking number, delivered date)
        const fus = o.fulfillments || [];
        const fu = fus.find(f => (f.trackingInfo || []).length) || fus[0];
        const ti = fu && (fu.trackingInfo || [])[0];
        const ship = fu ? {
          courier: (ti && ti.company) || null,
          waybill: (ti && ti.number) || null,
          dispatched_at: fu.createdAt ? dateInTz(fu.createdAt) : null,
          delivered_at: fu.deliveredAt ? dateInTz(fu.deliveredAt)
            : (fu.displayStatus === 'DELIVERED' && fu.createdAt ? dateInTz(fu.createdAt) : null)
        } : null;
        const odate = dateInTz(o.createdAt); // the Manila calendar date, as on the invoice
        // when the known-set was truncated, fail SAFE: treat every closed-period
        // order as frozen rather than attempt a restatement the trigger will reject
        const frozen = !!closedThrough && odate <= closedThrough && (knownTruncated || known.has(o.name));
        const row = frozen
          // closed period: collections + shipping only. No date/total/status/lines.
          ? { id, source: 'shopify', ext_ref: o.name, pay_status, paid, balance }
          : { id, source: 'shopify', ext_ref: o.name, date: odate, account: cust, spec: tag || '', status, total, user_id: null,
              pay_status, paid, balance, terms_days, order_note: note };
        // the QuickBooks-facing copy of the order (contract shape) for orders in the QBO era — frozen or not,
        // it restates nothing HQ books; it is what the invoice is built from
        row.qbo_src = odate >= qboSrcFrom ? toQboSrc(o) : null; if (row.qbo_src) nSrc++;
        if (frozen) nFrozen++;
        // only overwrite shipment fields when Shopify actually has a fulfillment —
        // otherwise manual courier/waybill entries in the app survive re-runs.
        // Frozen rows go in their own arrays: a bulk PostgREST upsert requires
        // every row in the batch to carry the SAME keys, and frozen rows carry fewer.
        if (ship) { Object.assign(row, ship); (frozen ? frozenShipRows : shipRows).push(row); }
        else (frozen ? frozenRows : orderRows).push(row);
        if (!frozen) delIds.push(id); // frozen orders keep the lines they were signed off with
        for (const l of (frozen ? [] : lis)) {
          const isDealPart = l.sku.length >= 4 && lis.some(o2 => o2.sku !== l.sku && o2.sku.length > l.sku.length && o2.sku.includes(l.sku));
          lineRows.push({ order_id: id, sku: l.sku, name: l.title, qty: l.qty, price: l.qty ? money(l.amt / l.qty) : 0, amount: l.amt, is_free: l.amt <= 0 && !isDealPart, deal: null });
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
      if (orderRows.length || shipRows.length || frozenRows.length || frozenShipRows.length) {
        // one batch per key shape: PostgREST bulk rows must share the same keys
        if (orderRows.length) await sb('orders?on_conflict=ext_ref', 'POST', orderRows, 'resolution=merge-duplicates,return=minimal');
        if (shipRows.length) await sb('orders?on_conflict=ext_ref', 'POST', shipRows, 'resolution=merge-duplicates,return=minimal');
        if (frozenRows.length) await sb('orders?on_conflict=ext_ref', 'POST', frozenRows, 'resolution=merge-duplicates,return=minimal');
        if (frozenShipRows.length) await sb('orders?on_conflict=ext_ref', 'POST', frozenShipRows, 'resolution=merge-duplicates,return=minimal');
        if (delIds.length) await sb('order_lines?order_id=in.(' + delIds.map(x => '"' + x + '"').join(',') + ')', 'DELETE'); // idempotent lines
        for (let i = 0; i < lineRows.length; i += 400) await sb('order_lines', 'POST', lineRows.slice(i, i + 400));
        nOrders += orderRows.length + shipRows.length + frozenRows.length + frozenShipRows.length; nLines += lineRows.length;
      }
      if (pages % 5 === 0) await setStatus({ state: 'running', pages, orders: nOrders });
      if (!os.pageInfo.hasNextPage) break;
      cursor = os.pageInfo.endCursor;
      await sleep(recent ? 150 : 300);
    }
    // customer records: insert-only, never touches existing CRM edits
    const acctRows = Object.values(accounts);
    for (let i = 0; i < acctRows.length; i += 300)
      await sb('accounts?on_conflict=name', 'POST', acctRows.slice(i, i + 300), 'resolution=ignore-duplicates,return=minimal');
    await setStatus({ state: 'done', pages, orders: nOrders, lines: nLines, customers: acctRows.length, qbo_src: nSrc,
      frozen: nFrozen, closed_through: closedThrough || null, // orders synced for collections only
      secs: Math.round((Date.now() - t0) / 1000) });
  } catch (err) {
    await setStatus({ state: 'error', error: String(err.message || err) });
  }
  return { statusCode: 200, body: 'done' };
};
