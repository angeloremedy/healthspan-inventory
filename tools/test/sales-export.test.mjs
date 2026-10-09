/* Sales export, server side: who may, the Manila month, the money rule, paging.
   Run from the repo root: node tools/test/sales-export.test.mjs */
import { handler, mayExport, monthRange, mapOrder } from '../../netlify/functions/sales-export.mjs';
let ok = 0, fail = 0; const t = (n, c, x) => { c ? ok++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && x !== '' ? '  → ' + x : '')); };

// ── who may
const prof = p => async () => p;
t('super admin, admin, sales manager, finance: by role', await mayExport({ id: 'a', role: 'admin', super: true }, prof({})) && await mayExport({ id: 'a', role: 'admin' }, prof({})) && await mayExport({ id: 'a', role: 'manager' }, prof({})) && await mayExport({ id: 'a', role: 'finance' }, prof({})));
t('a viewer only with the page granted', !(await mayExport({ id: 'v', role: 'viewer' }, prof({}))) && await mayExport({ id: 'v', role: 'viewer' }, prof({ view_grants: ['salesexport'] })));
t('a product specialist never, even with a grant', !(await mayExport({ id: 's', role: 'sales' }, prof({ view_grants: ['salesexport'] }))));
t('a deny wins over the role (not for the super admin)', !(await mayExport({ id: 'f', role: 'finance' }, prof({ view_denies: ['salesexport'] }))) && await mayExport({ id: 'x', role: 'admin', super: true }, prof({ view_denies: ['salesexport'] })));

// ── the month, in Manila
const r = monthRange('2026-05');
t('May in Manila = Apr 30 16:00Z → May 31 16:00Z', r.from === '2026-04-30T16:00:00Z' && r.to === '2026-05-31T16:00:00Z', JSON.stringify(r));
t('December rolls into January', monthRange('2026-12').to === '2026-12-31T16:00:00Z');

// ── the money rule: original total less EVERY allocated discount, scaled to what the order holds now
const M = (a) => ({ shopMoney: { amount: String(a) } });
const li = (sku, name, q, cq, price, allocs) => ({ node: { sku, name, quantity: q, currentQuantity: cq, originalUnitPriceSet: M(price), originalTotalSet: M(price * q), discountAllocations: allocs.map(a => ({ allocatedAmountSet: M(a) })) } });
const o = mapOrder({ name: '#HG-9280', createdAt: '2026-05-21T12:11:31Z', cancelledAt: null, tags: ['Rhas'], displayFinancialStatus: 'PENDING', displayFulfillmentStatus: 'UNFULFILLED',
  customer: { displayName: 'Jan Dipasupil' }, billingAddress: { company: 'Jan Medical Group' },
  currentSubtotalPriceSet: M(57000), currentTotalPriceSet: M(57000), currentTotalDiscountsSet: M(66500), totalShippingPriceSet: M(0), currentTotalTaxSet: M(6107.14),
  lineItems: { edges: [li('TD040B', '6+1 BUNDLE – TDS FACE NADE 4*2.5ML', 1, 1, 57000, []), li('TD040', 'TDS FACE NADE 4*2.5ML', 7, 7, 9500, [66500]), li('XX1', 'Removed line', 2, 0, 100, [])] } });
t('a 6+1 bundle: the bundle line ₱57,000, the seven units ₱0 after the order discount, the removed line gone', o.ls.length === 2 && o.ls[0].amt === 57000 && o.ls[1].amt === 0 && o.ls[1].q === 7, JSON.stringify(o.ls));
t('order fields: Manila date, company, specialist, statuses, subtotal', o.dt === '2026-05-21' && o.co === 'Jan Medical Group' && o.t === 'Rhas' && o.fs === 'PENDING' && o.sub === 57000 && !o.int && !o.x);
const e = mapOrder({ name: '#1', createdAt: '2026-05-31T17:30:00Z', tags: ['Remedy'], customer: { displayName: 'Remedy BGC' }, lineItems: { edges: [li('A', 'A', 4, 2, 100, [40])] } });
t('an edited line (4 → 2) keeps half its value and half its discount; 01:30 on Jun 1 Manila is June', e.ls[0].amt === 180 && e.ls[0].q === 2 && e.dt === '2026-06-01', JSON.stringify(e.ls[0]) + ' ' + e.dt);
t('Remedy is internal; TEST and pull-outs are flagged', e.int && mapOrder({ name: '#2', createdAt: '2026-05-02T00:00:00Z', tags: ['TEST'], lineItems: { edges: [] } }).test && mapOrder({ name: '#3', createdAt: '2026-05-02T00:00:00Z', tags: [], customer: { displayName: 'Marketing Pull-out' }, lineItems: { edges: [] } }).pull);

// ── the handler: auth, grant, month check, one page per call
process.env.SUPABASE_URL = 'https://sb.test'; process.env.SUPABASE_SERVICE_KEY = 'svc'; process.env.SHOPIFY_ADMIN_TOKEN = 'shpat_test';
let role = 'viewer', grants = [], shopCalls = [];
globalThis.fetch = async (url, opt) => {
  url = String(url);
  if (url.includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'u1', email: 'm@x' }) };
  if (url.includes('/rest/v1/profiles') && url.includes('select=role')) return { ok: true, json: async () => [{ role, is_super: false, name: 'Marie' }] };
  if (url.includes('/rest/v1/profiles') && url.includes('view_grants')) return { ok: true, json: async () => [{ view_grants: grants, view_denies: [] }] };
  if (url.includes('myshopify.com')) { const b = JSON.parse(opt.body); shopCalls.push(b.variables);
    return { ok: true, json: async () => ({ data: { orders: { pageInfo: { hasNextPage: !b.variables.c, endCursor: 'CUR1' }, edges: [{ node: { name: b.variables.c ? '#2' : '#1', createdAt: '2026-05-03T02:00:00Z', tags: [], lineItems: { edges: [li('A', 'A', 1, 1, 100, [])] } } }] } } }) }; }
  return { ok: false, status: 404, json: async () => ({}) };
};
const ev = (qs) => ({ httpMethod: 'GET', headers: { authorization: 'Bearer tok' }, queryStringParameters: qs });
let res = await handler(ev({ ym: '2026-05' }));
t('a viewer without the grant is refused (403)', res.statusCode === 403, res.statusCode);
grants = ['salesexport'];
res = await handler(ev({ ym: '2026-5' }));
t('a bad month is refused (400)', res.statusCode === 400);
res = await handler(ev({ ym: '2026-05' }));
let j = JSON.parse(res.body);
t('with the grant: first page and a cursor', res.statusCode === 200 && j.orders.length === 1 && j.orders[0].n === '#1' && j.next === 'CUR1', res.body.slice(0, 120));
t('Shopify is asked for the Manila month, every status', /created_at:>='2026-04-30T16:00:00Z' created_at:<'2026-05-31T16:00:00Z' status:any/.test(shopCalls[0].q), shopCalls[0].q);
res = await handler(ev({ ym: '2026-05', after: 'CUR1' }));
j = JSON.parse(res.body);
t('second page with the cursor, then no more', j.orders[0].n === '#2' && j.next === null && shopCalls[1].c === 'CUR1');
role = 'sales'; grants = ['salesexport'];
res = await handler(ev({ ym: '2026-05' }));
t('a specialist is refused even with a grant', res.statusCode === 403);
res = await handler({ httpMethod: 'POST', headers: {}, queryStringParameters: {} });
t('GET only', res.statusCode === 405);

console.log(ok + '/' + (ok + fail) + ' passed'); process.exit(fail ? 1 : 0);
