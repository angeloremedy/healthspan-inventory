// Background builder: pulls Shopify products (prices, deals, inventory) and
// 13 months of orders (unit demand), and caches the result in Netlify Blobs.
// Triggered by /api/shopify when the cache is missing or stale.
import { getStore } from '@netlify/blobs';

const STORE_HANDLE = process.env.SHOPIFY_STORE || 'healthspan-global';
const API = 'https://' + STORE_HANDLE + '.myshopify.com/admin/api/2025-01/graphql.json';

async function gql(token, query, variables) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!r.ok) throw new Error('Shopify HTTP ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  if (j.errors) throw new Error('Shopify GraphQL: ' + JSON.stringify(j.errors).slice(0, 200));
  return j.data;
}
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

export const handler = async () => {
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  const store = getStore('shopify');
  const t0 = Date.now();
  try {
    if (!token) throw new Error('SHOPIFY_ADMIN_TOKEN not set in Netlify env');

    // ── 1. All products & variants: price, inventory, bundle set-size from "N+M" titles
    const variants = {}; // sku -> record
    let cursor = null;
    for (let page = 0; page < 40; page++) {
      const d = await gql(token,
        'query($c:String){products(first:100,after:$c){pageInfo{hasNextPage endCursor}edges{node{title status variants(first:20){edges{node{sku price inventoryQuantity}}}}}}}',
        { c: cursor });
      const pr = d.products;
      for (const e of pr.edges) {
        const n = e.node;
        const m = n.title.match(/(\d+)\s*\+\s*(\d+)/); // "4+1", "7+1", etc.
        const setSize = m ? (parseInt(m[1], 10) + parseInt(m[2], 10)) : null;
        for (const ve of n.variants.edges) {
          const v = ve.node;
          const sku = (v.sku || '').trim();
          if (!sku) continue;
          variants[sku] = {
            sku,
            productTitle: n.title,
            status: n.status,
            price: parseFloat(v.price) || 0,
            inv: (typeof v.inventoryQuantity === 'number' ? v.inventoryQuantity : null),
            setSize,
            monthly: {}
          };
        }
      }
      if (!pr.pageInfo.hasNextPage) break;
      cursor = pr.pageInfo.endCursor;
      await sleep(150);
    }

    // ── 2. Orders for the last 13 months: units per SKU per month (cancelled excluded)
    const since = new Date();
    since.setMonth(since.getMonth() - 13); since.setDate(1);
    const q = 'created_at:>=' + since.toISOString().slice(0, 10) + ' status:any';
    cursor = null;
    let orders = 0;
    for (let page = 0; page < 300; page++) {
      const d = await gql(token,
        'query($c:String,$q:String){orders(first:100,after:$c,query:$q){pageInfo{hasNextPage endCursor}edges{node{createdAt cancelledAt lineItems(first:40){edges{node{sku quantity}}}}}}}',
        { c: cursor, q });
      const os = d.orders;
      for (const e of os.edges) {
        const o = e.node;
        if (o.cancelledAt) continue;
        const ym = o.createdAt.slice(0, 7);
        orders++;
        for (const le of o.lineItems.edges) {
          const li = le.node;
          const sku = (li.sku || '').trim();
          if (!sku) continue;
          const v = variants[sku] || (variants[sku] = { sku, productTitle: '', status: '', price: 0, inv: null, setSize: null, monthly: {} });
          v.monthly[ym] = (v.monthly[ym] || 0) + (li.quantity || 0);
        }
      }
      if (!os.pageInfo.hasNextPage) break;
      cursor = os.pageInfo.endCursor;
      await sleep(250);
    }

    await store.setJSON('data', {
      variants: Object.values(variants),
      orders,
      synced: new Date().toISOString(),
      elapsed: ((Date.now() - t0) / 1000).toFixed(1)
    });
    await store.setJSON('status', { state: 'ok', at: new Date().toISOString(), orders });
  } catch (err) {
    try { await store.setJSON('status', { state: 'error', error: String(err.message || err), at: new Date().toISOString() }); } catch (e) {}
  }
  return { statusCode: 200, body: 'done' };
};
