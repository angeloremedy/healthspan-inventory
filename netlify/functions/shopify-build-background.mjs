// Background builder: pulls Shopify products and 13 months of orders, and caches
// per-SKU sales aggregates (units, FREE units, revenue — monthly + 60-day daily),
// bundle/deal definitions, and per-specialist sales (from order tags).
//
// Unit-counting rule (validated against real orders): physical units are itemized
// as base-SKU line items (free ones at PHP 0). Bundle/deal product lines carry the
// REVENUE but their physical units arrive via those base-SKU lines — so bundle
// lines are NOT multiplied into units (that would double count).
import { connectLambda, getStore } from '@netlify/blobs';

const STORE_HANDLE = process.env.SHOPIFY_STORE || 'healthspan-global';
const API = 'https://' + STORE_HANDLE + '.myshopify.com/admin/api/2025-01/graphql.json';

// ── Auth. Since Jan 1 2026 Shopify no longer issues permanent shpat_ tokens for
// new apps: Dev Dashboard apps get a Client ID + Client Secret, exchanged here for
// a ~24h access token via the client-credentials grant. A legacy shpat_ token in
// SHOPIFY_ADMIN_TOKEN still works as a fallback if one ever exists again.
async function getAccessToken() {
  const legacy = (process.env.SHOPIFY_ADMIN_TOKEN || '').trim();
  if (legacy.startsWith('shpat_')) return legacy;
  const id = (process.env.SHOPIFY_CLIENT_ID || '').trim();
  const secret = (process.env.SHOPIFY_CLIENT_SECRET || (legacy.startsWith('shpss_') ? legacy : '')).trim();
  if (!id || !secret) throw new Error('Set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in Netlify env (from the Dev Dashboard app credentials)');
  const r = await fetch('https://' + STORE_HANDLE + '.myshopify.com/admin/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: id, client_secret: secret })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    const msg = JSON.stringify(j).slice(0, 200) || ('HTTP ' + r.status);
    throw new Error('Shopify token exchange failed: ' + msg + (String(msg).includes('shop_not_permitted') ? ' — the app and store must belong to the same Shopify organization' : ''));
  }
  return j.access_token;
}

async function gql(token, query, variables) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!r.ok) throw new Error('Shopify HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  if (j.errors && !j.data) throw new Error('Shopify GraphQL: ' + JSON.stringify(j.errors).slice(0, 200));
  return j.data;
}
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

export const handler = async (event) => {
  try { connectLambda(event); } catch (e) {}
  let store;
  try { store = getStore('shopify'); }
  catch (e) { return { statusCode: 200, body: 'blobs unavailable: ' + e.message }; }
  const t0 = Date.now();
  try {
    const token = await getAccessToken();

    // ── 1. Products & variants: price, inventory, bundle set-size from "N+M" titles
    const variants = {}; // sku -> record
    const mkVariant = (sku) => ({ sku, productTitle: '', status: '', price: 0, inv: null, setSize: null, monthly: {}, daily: {} });
    let cursor = null;
    for (let page = 0; page < 40; page++) {
      const d = await gql(token,
        'query($c:String){products(first:100,after:$c){pageInfo{hasNextPage endCursor}edges{node{title status variants(first:20){edges{node{sku price inventoryQuantity}}}}}}}',
        { c: cursor });
      const pr = d.products;
      for (const e of pr.edges) {
        const n = e.node;
        const m = n.title.match(/(\d+)\s*\+\s*(\d+)/);
        const setSize = m ? (parseInt(m[1], 10) + parseInt(m[2], 10)) : null;
        for (const ve of n.variants.edges) {
          const v = ve.node;
          const sku = (v.sku || '').trim();
          if (!sku) continue;
          const rec = variants[sku] || (variants[sku] = mkVariant(sku));
          rec.productTitle = n.title;
          rec.status = n.status;
          rec.price = parseFloat(v.price) || 0;
          rec.inv = (typeof v.inventoryQuantity === 'number' ? v.inventoryQuantity : null);
          rec.setSize = setSize;
        }
      }
      if (!pr.pageInfo.hasNextPage) break;
      cursor = pr.pageInfo.endCursor;
      await sleep(150);
    }

    // ── 2. Orders (13 months): per-line units / free units / revenue, plus specialist tags
    const since = new Date();
    since.setMonth(since.getMonth() - 13); since.setDate(1);
    const dailyFrom = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    const q = 'created_at:>=' + since.toISOString().slice(0, 10) + ' status:any';
    const specialists = {}; // tag -> { monthly: {ym:{u,v}}, daily: {d:{u,v}} }
    cursor = null;
    let orders = 0;
    for (let page = 0; page < 300; page++) {
      const d = await gql(token,
        'query($c:String,$q:String){orders(first:100,after:$c,query:$q){pageInfo{hasNextPage endCursor}edges{node{createdAt cancelledAt tags lineItems(first:40){edges{node{sku quantity discountedTotalSet{shopMoney{amount}}}}}}}}}',
        { c: cursor, q });
      const os = d.orders;
      for (const e of os.edges) {
        const o = e.node;
        if (o.cancelledAt) continue;
        const ym = o.createdAt.slice(0, 7);
        const day = o.createdAt.slice(0, 10);
        const useDaily = day >= dailyFrom;
        orders++;
        const spec = (o.tags && o.tags.length ? String(o.tags[0]).trim() : '') || null;
        let oUnits = 0, oValue = 0;
        for (const le of o.lineItems.edges) {
          const li = le.node;
          const sku = (li.sku || '').trim();
          if (!sku) continue;
          const qty = li.quantity || 0;
          const amt = parseFloat((li.discountedTotalSet && li.discountedTotalSet.shopMoney && li.discountedTotalSet.shopMoney.amount) || '0') || 0;
          const free = amt <= 0 ? qty : 0;
          const rec = variants[sku] || (variants[sku] = mkVariant(sku));
          const bump = (obj, key) => {
            const s = obj[key] || (obj[key] = { u: 0, f: 0, v: 0 });
            s.u += qty; s.f += free; s.v += amt;
          };
          bump(rec.monthly, ym);
          if (useDaily) bump(rec.daily, day);
          oUnits += qty; oValue += amt;
        }
        if (spec) {
          const sp = specialists[spec] || (specialists[spec] = { monthly: {}, daily: {} });
          const bumpS = (obj, key) => { const s = obj[key] || (obj[key] = { u: 0, v: 0 }); s.u += oUnits; s.v += oValue; };
          bumpS(sp.monthly, ym);
          if (useDaily) bumpS(sp.daily, day);
        }
      }
      if (!os.pageInfo.hasNextPage) break;
      cursor = os.pageInfo.endCursor;
      await sleep(250);
    }

    await store.setJSON('data', {
      v: 2, // aggregate format version
      variants: Object.values(variants),
      specialists,
      orders,
      dailyFrom,
      synced: new Date().toISOString(),
      elapsed: ((Date.now() - t0) / 1000).toFixed(1)
    });
    await store.setJSON('status', { state: 'ok', at: new Date().toISOString(), orders });
  } catch (err) {
    try { await store.setJSON('status', { state: 'error', error: String(err.message || err), at: new Date().toISOString() }); } catch (e) {}
  }
  return { statusCode: 200, body: 'done' };
};
