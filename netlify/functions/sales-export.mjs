// Sales export — one month of Shopify orders, line by line, for the Sales export page
// (2026-10-08; replaces a by-hand monthly Shopify CSV export + pivot).
// GET ?ym=YYYY-MM[&after=<cursor>] → { ym, orders:[…], next }
//   One page (25 orders) per call so no call runs long; the page loops until next is null.
// Who may: the super admin, admins, the sales manager and finance by role; anyone else only
// with the page granted on Team & access (profiles.view_grants contains "salesexport") —
// never a product specialist (company-wide customer and order data). A deny always wins.
// Money: a line's sales = its original total minus every discount allocated to it
// (line AND order-level), scaled to the quantity the order holds now. VAT-inclusive, as booked.
import { sessionUser } from './lib/guard.mjs';
import { getAccessToken, gql, isInternal } from './lib/shopify.mjs';

const HDRS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const out = (code, body) => ({ statusCode: code, headers: HDRS, body: JSON.stringify(body) });
const VIEW = 'salesexport';
const BY_ROLE = ['admin', 'manager', 'finance'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function mayExport(u, fetchProfile) {
  if (!u || u.code) return false;
  if (u.role === 'sales' && !u.super) return false;            // specialists: own rows only, never this
  let grants = [], denies = [];
  try { const p = await fetchProfile(u.id); grants = (p && p.view_grants) || []; denies = (p && p.view_denies) || []; } catch (e) {}
  if (Array.isArray(denies) && denies.includes(VIEW) && !u.super) return false;
  if (u.super || BY_ROLE.includes(u.role)) return true;
  return Array.isArray(grants) && grants.includes(VIEW);
}

/* the Manila month as a UTC range Shopify's search understands */
export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1, -8)), to = new Date(Date.UTC(y, m, 1, -8));
  return { from: from.toISOString().replace('.000', ''), to: to.toISOString().replace('.000', '') };
}
const manilaDate = iso => new Date(Date.parse(iso) + 8 * 3600e3).toISOString().slice(0, 10);
const num = s => Math.round((parseFloat((s && s.shopMoney && s.shopMoney.amount) || '0') || 0) * 100) / 100;

export function mapOrder(o) {
  const lines = [];
  for (const e of ((o.lineItems && o.lineItems.edges) || [])) {
    const li = e.node, q = li.quantity || 0, cq = li.currentQuantity == null ? q : li.currentQuantity;
    if (!cq) continue;                                   // removed by an order edit
    const orig = num(li.originalTotalSet), disc = (li.discountAllocations || []).reduce((a, d) => a + num(d.allocatedAmountSet), 0);
    const k = q ? cq / q : 1;
    lines.push({ sku: String(li.sku || '').trim(), name: li.name || '', q: cq, p: num(li.originalUnitPriceSet),
      amt: Math.round((orig - disc) * k * 100) / 100 });
  }
  const tags = o.tags || [], cust = (o.customer && o.customer.displayName) || '';
  return { n: o.name, dt: manilaDate(o.createdAt), c: cust, co: (o.billingAddress && o.billingAddress.company) || '',
    t: tags.length ? String(tags[0]).trim() : '', fs: o.displayFinancialStatus || '', ff: o.displayFulfillmentStatus || '',
    x: !!o.cancelledAt, int: isInternal(cust, tags), test: tags.some(t => String(t).trim().toUpperCase() === 'TEST'),
    pull: /pull\s*-?\s*out/i.test(cust),
    sub: num(o.currentSubtotalPriceSet), tot: num(o.currentTotalPriceSet), disc: num(o.currentTotalDiscountsSet),
    ship: num(o.totalShippingPriceSet), tax: num(o.currentTotalTaxSet), ls: lines };
}

const Q = 'query($q:String!,$c:String){orders(first:25,after:$c,query:$q,sortKey:CREATED_AT){pageInfo{hasNextPage endCursor}edges{node{' +
  'name createdAt cancelledAt tags displayFinancialStatus displayFulfillmentStatus customer{displayName} billingAddress{company} ' +
  'currentSubtotalPriceSet{shopMoney{amount}} currentTotalPriceSet{shopMoney{amount}} currentTotalDiscountsSet{shopMoney{amount}} ' +
  'totalShippingPriceSet{shopMoney{amount}} currentTotalTaxSet{shopMoney{amount}} ' +
  'lineItems(first:60){edges{node{name sku quantity currentQuantity originalUnitPriceSet{shopMoney{amount}} originalTotalSet{shopMoney{amount}} ' +
  'discountAllocations{allocatedAmountSet{shopMoney{amount}}}}}}}}}}';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return out(405, { error: 'GET only' });
  const u = await sessionUser(event);
  if (u.code) return out(u.code, { error: u.error });
  const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), SVC = process.env.SUPABASE_SERVICE_KEY || '';
  const fetchProfile = async id => {
    const r = await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(id) + '&select=view_grants,view_denies', { headers: { apikey: SVC, Authorization: 'Bearer ' + SVC } });
    if (!r.ok) return {};
    const j = await r.json(); return j[0] || {};
  };
  if (!(await mayExport(u, fetchProfile))) return out(403, { error: 'The Sales export is not open to your account — ask the super admin.' });
  const qs = event.queryStringParameters || {};
  const ym = String(qs.ym || '');
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(ym)) return out(400, { error: 'Pick a month (YYYY-MM)' });
  const after = qs.after ? String(qs.after).slice(0, 400) : null;
  const { from, to } = monthRange(ym);
  const q = "created_at:>='" + from + "' created_at:<'" + to + "' status:any";
  try {
    const token = await getAccessToken();
    let d = null;
    for (let i = 0; i < 3; i++) {
      try { d = await gql(token, Q, { q, c: after }); break; }
      catch (e) { if ((e.throttled || e.status === 429) && i < 2) { await sleep(2000 * (i + 1)); continue; } throw e; }
    }
    const os = d.orders;
    return out(200, { ym, orders: os.edges.map(e => mapOrder(e.node)), next: os.pageInfo.hasNextPage ? os.pageInfo.endCursor : null });
  } catch (e) {
    return out(502, { error: 'Shopify did not answer: ' + String(e.message || e).slice(0, 200) });
  }
};
