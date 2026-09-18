/* QuickBooks connector — the library and the sync pass against a fake Intuit and a
   fake Supabase (fetch is mocked; nothing leaves the machine). Run from the repo root:
     node tools/test/qbo-connector.test.mjs
   Covers: document shapes (VAT-inclusive credit memo, payment link), token refresh + rotation, 401 retry, find-or-create (fuzzy + e-mail customer match, Service items), CDC parsing, runSync in preview and live under finance's rules (post at creation, list price + Discount row, class, No-VAT lines, strict totals with delete, same-month void, payments toggle, Shopify orders from qbo_src) and the shadow reconciliation.
   Legacy line kept for grep: (VAT-inclusive invoice, ₱0 lines, DocNumber, due date,
   class/location), payment ↔ invoice link, credit-memo application, CDC parsing,
   token refresh + rotation, 401 retry, find-or-create with fuzzy customer matching,
   and runSync in preview (posts nothing) and live (posts, pulls a QBO payment
   back, rolls up the order). */
process.env.SUPABASE_URL = 'https://sb.test'; process.env.SUPABASE_SERVICE_KEY = 'svc';
process.env.QBO_CLIENT_ID = 'cid'; process.env.QBO_CLIENT_SECRET = 'sec'; process.env.QBO_ENV = 'sandbox';

let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + x : '')); };

// ── fake Supabase: tiny in-memory tables behind PostgREST-ish URLs ────────────
const DB = { app_settings: [], qbo_tokens: [], qbo_map: [], qbo_sync: [], orders: [], order_lines: [], payments: [], returns: [], doc_formats: [], audit_log: [], items: [] };
let nextId = 100;
function parseFilters(qs) { const f = []; for (const [k, v] of qs) { if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue; const m = v.match(/^(eq|gte|like|ilike|in|is)\.(.*)$/s); if (m) f.push({ k, op: m[1], v: m[2] }); } return f; }
function match(row, f) {
  const val = row[f.k]; const s = val == null ? null : String(val);
  if (f.op === 'eq') return s === f.v; if (f.op === 'gte') return s != null && s >= f.v; if (f.op === 'is') return f.v === 'null' ? val == null : f.v === 'false' ? val === false : val === true;
  if (f.op === 'in') return f.v.replace(/^\(|\)$/g, '').split(',').includes(s);
  if (f.op === 'like' || f.op === 'ilike') { const re = new RegExp('^' + f.v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%|\\\*/g, '.*').replace(/\*/g, '.*') + '$', f.op === 'ilike' ? 'i' : ''); return re.test(s || ''); }
  return true;
}
function sbHandle(url, opt) {
  const u = new URL(url); const table = u.pathname.replace('/rest/v1/', ''); const qs = u.searchParams; const method = (opt && opt.method) || 'GET';
  if (table.startsWith('rpc/')) return { status: 200, body: [{ tag: 'Rhas', name: 'Rhas Porciuncula', team: 'Team 1' }] };
  const rows = DB[table]; if (!rows) return { status: 404, body: { message: 'no table ' + table } };
  const filters = parseFilters(qs); const sel = rows.filter(r => filters.every(f => match(r, f)));
  if (method === 'GET') return { status: 200, body: sel };
  if (method === 'PATCH') { const patch = JSON.parse(opt.body); sel.forEach(r => Object.assign(r, patch)); return { status: 200, body: sel }; }
  if (method === 'DELETE') { for (const r of sel) rows.splice(rows.indexOf(r), 1); return { status: 200, body: sel }; }
  if (method === 'POST') {
    const body = JSON.parse(opt.body); const conflict = qs.get('on_conflict');
    if (conflict) { const keys = conflict.split(','); const ex = rows.find(r => keys.every(k => String(r[k]) === String(body[k]))); if (ex) { Object.assign(ex, body); return { status: 201, body: [ex] }; } }
    if (table === 'payments' && body.amount === 0) return { status: 400, body: { message: 'check constraint' } };
    if (!('id' in body) && table !== 'qbo_map' && table !== 'app_settings' && table !== 'qbo_tokens' && table !== 'doc_formats') body.id = table === 'orders' ? 'o' + (nextId++) : nextId++;
    rows.push(body); return { status: 201, body: [body] };
  }
  return { status: 405, body: {} };
}
// ── fake Intuit ───────────────────────────────────────────────────────────────
const QBO = { customers: [{ Id: '1', DisplayName: 'Dr. Cruz Clinic' }, { Id: '2', DisplayName: "Skin Station, Inc." }], items: [{ Id: '10', Name: 'FACE NADE', Sku: 'TD040' }], classes: [], departments: [], invoices: [], payments: [], creditmemos: [], cdc: [], tokenCalls: 0, calls: [] };
let expire401Once = false;
function qboHandle(url, opt) {
  QBO.calls.push(url.split('?')[0].split('/').slice(-1)[0] + ' ' + ((opt && opt.method) || 'GET'));
  if (url.startsWith('https://oauth.platform.intuit.com')) { QBO.tokenCalls++; const p = new URLSearchParams(opt.body); return { status: 200, body: { access_token: 'acc' + QBO.tokenCalls, refresh_token: 'ref' + QBO.tokenCalls, expires_in: 3600, x_refresh_token_expires_in: 8640000, grant: p.get('grant_type') } }; }
  const u = new URL(url); const path = u.pathname.split('/').slice(4).join('/'); // v3/company/{realm}/...
  const auth = (opt.headers || {}).Authorization || '';
  if (expire401Once) { expire401Once = false; return { status: 401, body: { Fault: { Error: [{ Message: 'token expired', code: '3200' }] } } }; }
  if (path === 'companyinfo/123') return { status: 200, body: { CompanyInfo: { CompanyName: 'Healthspan Sandbox' } } };
  if (path === 'preferences') return { status: 200, body: { Preferences: { AccountingInfoPrefs: { ClassTrackingPerTxnLine: true, TrackDepartments: true } } } };
  if (path === 'query') {
    const q = u.searchParams.get('query');
    if (/from Customer where DisplayName = '(.*)'/.test(q)) { const n = q.match(/DisplayName = '(.*)' maxresults/)[1].replace(/\\'/g, "'"); return { status: 200, body: { QueryResponse: { Customer: QBO.customers.filter(c => c.DisplayName === n) } } }; }
    if (/from Customer startposition/.test(q)) return { status: 200, body: { QueryResponse: { Customer: QBO.customers } } };
    if (/from Item where Sku = '(.*)'/.test(q)) { const s = q.match(/Sku = '(.*)' maxresults/)[1]; return { status: 200, body: { QueryResponse: { Item: QBO.items.filter(i => i.Sku === s) } } }; }
    if (/from Item where Name = '(.*)'/.test(q)) { const s = q.match(/Name = '(.*)' maxresults/)[1]; return { status: 200, body: { QueryResponse: { Item: QBO.items.filter(i => i.Name === s) } } }; }
    if (/from Class where Name = '(.*)'/.test(q)) { const s = q.match(/Name = '(.*)' maxresults/)[1]; return { status: 200, body: { QueryResponse: { Class: QBO.classes.filter(i => i.Name === s) } } }; }
    if (/from Department where Name = '(.*)'/.test(q)) { const s = q.match(/Name = '(.*)' maxresults/)[1]; return { status: 200, body: { QueryResponse: { Department: QBO.departments.filter(i => i.Name === s) } } }; }
    if (/from Customer where PrimaryEmailAddr = '(.*)'/.test(q)) { const s = q.match(/PrimaryEmailAddr = '(.*)' maxresults/)[1]; return { status: 200, body: { QueryResponse: { Customer: QBO.customers.filter(c => c.PrimaryEmailAddr && c.PrimaryEmailAddr.Address === s) } } }; }
    if (/from Class maxresults/.test(q)) return { status: 200, body: { QueryResponse: { Class: QBO.classes } } };
    if (/from Invoice where DocNumber in \((.*)\)/.test(q)) { const list = q.match(/in \((.*)\) maxresults/)[1].split(',').map(x => x.trim().replace(/^'|'$/g, '')); return { status: 200, body: { QueryResponse: { Invoice: QBO.invoices.filter(i => list.includes(String(i.DocNumber))) } } }; }
    return { status: 200, body: { QueryResponse: {} } };
  }
  const body = opt.body ? JSON.parse(opt.body) : null;
  // what the real global edition computes for a TaxInclusive document: gross from TaxInclusiveAmt (VAT code) or Amount (no VAT);
  // a Discount row is read as NET and prorated (percent applies to the list); VAT = Σ(gross − net) on VAT lines
  const VAT = '5';
  const qboTotal = b => { let gross = 0, vat = 0, list = 0; for (const l of (b.Line || [])) { if (l.DetailType !== 'SalesItemLineDetail') continue; const d = l.SalesItemLineDetail || {}; const isVat = d.TaxCodeRef && d.TaxCodeRef.value === VAT; const g = isVat ? (d.TaxInclusiveAmt != null ? +d.TaxInclusiveAmt : +l.Amount * 1.12) : +l.Amount; gross += g; list += g; if (isVat) vat += g - (d.TaxInclusiveAmt != null ? +l.Amount : +l.Amount); }
    for (const l of (b.Line || [])) { if (l.DetailType !== 'DiscountLineDetail') continue; const dd = l.DiscountLineDetail || {}; const isVat = dd.TaxCodeRef && dd.TaxCodeRef.value === VAT; const dg = dd.PercentBased ? list * (+dd.DiscountPercent) / 100 : (isVat ? +l.Amount * 1.12 : +l.Amount); gross -= dg; if (isVat) vat -= dg - dg / 1.12; }
    return { TotalAmt: Math.round(gross * 100) / 100, TxnTaxDetail: { TotalTax: Math.round(vat * 100) / 100 } }; };
  const mk = (list, key, extra) => { const doc = Object.assign({ Id: String(list.length + 500), SyncToken: '0' }, body, extra || {}, key === 'Invoice' || key === 'CreditMemo' ? qboTotal(body) : {}); if (key === 'Invoice') doc.Balance = doc.TotalAmt; list.push(doc); return { status: 200, body: { [key]: doc } }; };
  if (path === 'customer') return mk(QBO.customers, 'Customer');
  if (path === 'item') return mk(QBO.items, 'Item');
  if (path === 'class') return mk(QBO.classes, 'Class');
  if (path === 'department') return mk(QBO.departments, 'Department');
  if (path === 'invoice' && body && body.Id) { const inv = QBO.invoices.find(i => i.Id === body.Id); if (u.searchParams.get('operation') === 'delete') { QBO.invoices.splice(QBO.invoices.indexOf(inv), 1); inv.deleted = true; return { status: 200, body: { Invoice: { Id: inv.Id, status: 'Deleted' } } }; }
    Object.assign(inv, body, { SyncToken: String(+inv.SyncToken + 1) }); if (u.searchParams.get('operation') === 'void') { inv.voided = true; inv.TotalAmt = 0; inv.Balance = 0; inv.PrivateNote = 'Voided - ' + (inv.PrivateNote || ''); } else { const paid = (+inv.TotalAmt || 0) - (+inv.Balance || 0); Object.assign(inv, qboTotal(inv)); inv.Balance = inv.TotalAmt - paid; } return { status: 200, body: { Invoice: inv } }; }
  if (path === 'invoice') return mk(QBO.invoices, 'Invoice', { DocNumber: body.DocNumber });
  if (path.startsWith('invoice/')) return { status: 200, body: { Invoice: QBO.invoices.find(i => i.Id === path.split('/')[1]) } };
  if (path === 'payment') { for (const L of (body.Line || [])) for (const t of (L.LinkedTxn || [])) if (t.TxnType === 'Invoice') { const inv = QBO.invoices.find(i => i.Id === t.TxnId); if (inv) inv.Balance = Math.round(((+inv.Balance || 0) - (+L.Amount || 0)) * 100) / 100; } return mk(QBO.payments, 'Payment'); }
  if (path === 'creditmemo') return mk(QBO.creditmemos, 'CreditMemo', { DocNumber: body.DocNumber });
  if (path === 'cdc') return { status: 200, body: { CDCResponse: [{ QueryResponse: [{ Payment: QBO.cdc }] }] } };
  return { status: 404, body: { Fault: { Error: [{ Message: 'no route ' + path, Detail: 'test double' }] } } };
}
globalThis.fetch = async (url, opt = {}) => {
  const r = url.startsWith('https://sb.test') ? sbHandle(url, opt) : qboHandle(url, opt);
  const text = JSON.stringify(r.body);
  return { ok: r.status < 300, status: r.status, headers: { get: () => null }, text: async () => text, json: async () => r.body };
};

const Q = await import('../../netlify/functions/lib/qbo.mjs');
const { runSync } = await import('../../netlify/functions/lib/qbo-sync.mjs');
const REC = await import('../../netlify/functions/lib/qbo-reconcile.mjs');
const near = (a, b, tol = 0.011) => Math.abs((+a) - (+b)) <= tol;

// ── documents ────────────────────────────────────────────────────────────────
{
  const pay = Q.buildPayment({ id: 7, amount: 5000, date: '2026-09-06', method: 'Bank transfer', ref: 'BPI 8891' }, '1', '500', { depositAccount: '35' });
  ok('payment: applied to the invoice, deposit account, ref ≤ 21 chars', pay.TotalAmt === 5000 && pay.Line[0].LinkedTxn[0].TxnId === '500' && pay.Line[0].LinkedTxn[0].TxnType === 'Invoice' && pay.DepositToAccountRef.value === '35' && pay.PaymentRefNum === 'BPI 8891');
  const cm = Q.buildCreditMemo({ amount: 2000, date: '2026-09-07', reason: 'damaged', items: '2 × FACE NADE', order_ref: 'HS-1042' }, '1', '99', { taxCode: '5', classId: '77' }, 'CM-1003');
  ok('credit memo: VAT-inclusive shape (TaxInclusiveAmt 2000, Amount = net, no UnitPrice), class on line and header, numbered', cm.DocNumber === 'CM-1003' && cm.Line[0].SalesItemLineDetail.TaxInclusiveAmt === 2000 && near(cm.Line[0].Amount, 2000 / 1.12) && cm.Line[0].SalesItemLineDetail.UnitPrice === undefined && cm.Line[0].SalesItemLineDetail.ClassRef.value === '77' && cm.ClassRef.value === '77' && cm.GlobalTaxCalculation === 'TaxInclusive', JSON.stringify(cm));
  const app = Q.buildCreditApplication('1', '500', '600', 2000, '2026-09-07');
  ok('credit application: zero-amount payment linking invoice and credit memo', app.TotalAmt === 0 && app.Line[0].LinkedTxn.map(t => t.TxnType).join() === 'Invoice,CreditMemo');
  ok('fingerprint is stable and changes with content', Q.fingerprint(cm) === Q.fingerprint(JSON.parse(JSON.stringify(cm))) && Q.fingerprint(cm) !== Q.fingerprint(Object.assign({}, cm, { DocNumber: 'CM-1004' })));
  ok('docLabel mirrors docNo(): HS-1042 for num 42, CM-1003, QT padding', Q.docLabel({}, 'order', 42) === 'HS-1042' && Q.docLabel({}, 'cm', 3) === 'CM-1003' && Q.docLabel({ quote: { prefix: 'QT-', pad: 4, offset_no: 0 } }, 'quote', 7) === 'QT-0007');
  ok('norm() matches clinic names across systems', Q.norm('Skin Station, Inc.') === Q.norm('SKIN STATION INC') && Q.norm("Dr. Cruz's Clinic") !== Q.norm('Dr. Reyes Clinic'));
  ok('the legacy invoice builder is gone from the public surface', typeof Q.buildInvoice === 'undefined' && typeof Q.buildInvoice_legacy === 'function');
}
// ── tokens ───────────────────────────────────────────────────────────────────
{
  const soon = { realm_id: '123', env: 'sandbox', access_token: 'old', refresh_token: 'r0', access_expires_at: new Date(Date.now() + 60000).toISOString(), refresh_expires_at: new Date(Date.now() + 86400000).toISOString() };
  const fresh = await Q.refreshIfNeeded(soon);
  ok('refresh when the access token has <5 min left; the rotated refresh token is stored', fresh.access_token === 'acc1' && fresh.refresh_token === 'ref1' && DB.qbo_tokens[0].refresh_token === 'ref1');
  const later = Object.assign({}, fresh, { access_expires_at: new Date(Date.now() + 3600000).toISOString() });
  ok('no refresh when the token is still good', (await Q.refreshIfNeeded(later)).access_token === 'acc1' && QBO.tokenCalls === 1);
  let threw = ''; try { await Q.refreshIfNeeded(Object.assign({}, later, { access_expires_at: new Date().toISOString(), refresh_expires_at: new Date(Date.now() - 1000).toISOString() })); } catch (e) { threw = e.message; }
  ok('a lapsed refresh token says "connect again"', /connect again/.test(threw), threw);
  const api = Q.client(later); expire401Once = true;
  const ci = await api.companyInfo();
  ok('a 401 mid-call refreshes once and retries', ci.CompanyName === 'Healthspan Sandbox' && QBO.tokenCalls === 2 && api.tok.access_token === 'acc2');
  let err = ''; try { await api.get('nowhere'); } catch (e) { err = e.message; }
  ok('QBO faults surface Intuit\'s message and detail', /QBO .*no route nowhere — test double/.test(err), err);
  ok('authorize URL carries client id, scope, redirect and state', /client_id=cid/.test(Q.authorizeUrl('https://hq/cb', 'st')) && /scope=com.intuit.quickbooks.accounting/.test(Q.authorizeUrl('https://hq/cb', 'st')) && /state=st/.test(Q.authorizeUrl('https://hq/cb', 'st')));
}
// ── find-or-create ───────────────────────────────────────────────────────────
{
  const tok = DB.qbo_tokens[0]; const api = Q.client(Object.assign({}, tok, { access_expires_at: new Date(Date.now() + 3600000).toISOString() }));
  const a = await Q.ensureCustomer(api, 'Dr. Cruz Clinic');
  ok('exact customer match → confirmed mapping', a.qbo_id === '1' && a.confirmed === true);
  const b = await Q.ensureCustomer(api, 'SKIN STATION INC');
  ok('normalised match → UNconfirmed mapping with candidates', b.qbo_id === '2' && b.confirmed === false && DB.qbo_map.find(m => m.hq_key === 'SKIN STATION INC').candidates[0].name === 'Skin Station, Inc.');
  QBO.customers.push({ Id: '3', DisplayName: 'Maria Santos', PrimaryEmailAddr: { Address: 'maria@example.ph' } });
  const em = await Q.ensureCustomer(api, 'Maria Santos (maria@example.ph)', { email: 'maria@example.ph' });
  ok('a Shopify buyer QuickBooks knows by e-mail is matched by e-mail, confirmed', em.qbo_id === '3' && em.confirmed === true, JSON.stringify(em));
  const c = await Q.ensureCustomer(api, 'New Derma Hub');
  ok('unknown customer is created and mapped', c.confirmed === true && QBO.customers.some(x => x.DisplayName === 'New Derma Hub'));
  ok('second lookup hits qbo_map, not QuickBooks', (QBO.calls.length, await Q.ensureCustomer(api, 'New Derma Hub'), QBO.calls.slice(-1)[0] !== 'query GET'));
  const i1 = await Q.ensureItem(api, 'TD040', 'FACE NADE', '40', '5'); const i2 = await Q.ensureItem(api, 'ME0001', 'MELINE INTIMATE', '40', '5');
  ok('items: found by SKU, created on the income account when missing', i1.qbo_id === '10' && QBO.items.find(i => i.Sku === 'ME0001').IncomeAccountRef.value === '40' && i2.confirmed === true);
  const disc = await Q.ensureItem(api, '', 'Discount', '40', '', { type: 'Service' });
  ok('the Discount item is created as a Service on the income account, no tax code', disc.qbo_id && QBO.items.find(i => i.Name === 'Discount').Type === 'Service' && !QBO.items.find(i => i.Name === 'Discount').SalesTaxCodeRef);
  let e = ''; try { await Q.ensureItem(api, 'XX1', 'Unknown', '', '5'); } catch (x) { e = x.message; }
  ok('no income account → clear error instead of a half-made item', /no income account/.test(e), e);
  const cls = await Q.ensureClass(api, 'Sales');
  ok('class found or created by name', QBO.classes[0].Name === 'Sales' && cls.qbo_id);
}
// ── CDC parsing ──────────────────────────────────────────────────────────────
{
  QBO.cdc = [{ Id: '900', TotalAmt: 3000, TxnDate: '2026-09-08', PaymentRefNum: 'CHK 1', PaymentMethodRef: { name: 'Check' }, Line: [{ Amount: 3000, LinkedTxn: [{ TxnId: '500', TxnType: 'Invoice' }] }], CustomerRef: { value: '1' } }, { Id: '901', status: 'Deleted' }];
  const api = Q.client(Object.assign({}, DB.qbo_tokens[0], { access_expires_at: new Date(Date.now() + 3600000).toISOString() }));
  const ch = await Q.changedPayments(api, '2026-09-01T00:00:00Z');
  ok('changedPayments: invoice links with amounts, deletions flagged', ch.length === 2 && ch[0].links[0].invoiceId === '500' && ch[0].links[0].amount === 3000 && ch[0].method === 'Check' && ch[1].deleted === true);
  QBO.cdc = [];
}
// ── runSync: preview, then live ──────────────────────────────────────────────
const set = (k, v) => { const r = DB.app_settings.find(x => x.key === k); if (r) r.value = v; else DB.app_settings.push({ key: k, value: v }); };
const HG = { // a Shopify order as backfill-background stores it in orders.qbo_src (contract shape)
  id: 7821703643381, name: '#HG-10496', email: 'maria@example.ph', currency: 'PHP', taxes_included: true, created_at: '2026-09-15T21:23:00+08:00', cancelled_at: null, financial_status: 'pending', note: '',
  total_price: '95000.00', total_tax: '10178.57', total_discounts: '95000.00', total_tip_received: '0.00', total_duties: '0.00', total_outstanding: '95000.00', payment_terms: null,
  customer: { id: 7001, first_name: 'Maria', last_name: 'Santos', email: 'maria@example.ph', default_address: { company: '' } }, billing_address: { company: '' }, company: null, discount_codes: [{ code: 'INNO-DD0909-5PLU5' }],
  line_items: [{ id: 1, variant_id: 996, sku: 'TD040', title: 'TDS FACE NADE 4*2.5ML', variant_title: 'Default Title', price: '9500.00', quantity: 20, current_quantity: 20, taxable: true, discount_allocations: [{ amount: '95000.00' }], tax_lines: [{ rate: 0.12, price: '10178.57' }] }],
  shipping_lines: [], refunds: []
};
{
  DB.items.push({ sku: 'TD040', line: 'Inno', price: 1000 }, { sku: 'TS-ENEKA', line: 'Termosalud', price: 5000 });
  DB.orders.push({ id: 'o1', num: 42, date: '2026-09-05', account: 'Dr. Cruz Clinic', spec: 'Rhas', status: 'pending', total: 10000, terms_days: 30, notes: '', dr_no: 'DR-000123', fulfilled_at: null, deleted_at: null, source: 'native', approved: true, created_at: '2026-09-05T02:00:00Z' },
    { id: 'o2', num: 43, date: '2026-09-05', account: 'Remedy BGC', spec: 'Rhas', status: 'fulfilled', total: 500, fulfilled_at: '2026-09-05T11:00:00Z', deleted_at: null, source: 'native', approved: true },
    { id: 'o3', num: 44, date: '2026-09-05', account: 'SKIN STATION INC', spec: 'Rhas', status: 'fulfilled', total: 800, fulfilled_at: '2026-09-05T12:00:00Z', deleted_at: null, source: 'native', approved: true },
    { id: 'o0', num: 40, date: '2026-08-01', account: 'Dr. Cruz Clinic', spec: 'Rhas', status: 'fulfilled', total: 999, fulfilled_at: '2026-08-01T12:00:00Z', deleted_at: null, source: 'native', approved: true },
    { id: 'o5', num: 46, date: '2026-09-06', account: 'Dr. Cruz Clinic', spec: 'Rhas', status: 'pending', total: 700, deleted_at: null, source: 'native', approved: false },
    { id: 's1', num: 900, date: '2026-09-15', account: 'Maria Santos', spec: '', status: 'pending', total: 95000, deleted_at: null, source: 'shopify', ext_ref: '#HG-10496', approved: true, qbo_src: HG },
    { id: 's2', num: 901, date: '2026-09-16', account: 'Old Import', spec: '', status: 'pending', total: 100, deleted_at: null, source: 'shopify', ext_ref: '#HG-10497', approved: true, qbo_src: null });
  DB.order_lines.push({ id: 1, order_id: 'o1', sku: 'TD040', name: 'FACE NADE', qty: 10, price: 1000, amount: 10000, is_free: false, deal: null }, { id: 2, order_id: 'o1', sku: 'TD040', name: 'FACE NADE', qty: 1, price: 0, amount: 0, is_free: true, deal: '10+1' },
    { id: 3, order_id: 'o2', sku: 'TD040', name: 'FACE NADE', qty: 1, price: 500, amount: 500, is_free: false }, { id: 4, order_id: 'o3', sku: 'TD040', name: 'FACE NADE', qty: 1, price: 800, amount: 800, is_free: false }, { id: 6, order_id: 'o5', sku: 'TD040', name: 'FACE NADE', qty: 1, price: 700, amount: 700, is_free: false });
  DB.payments.push({ id: 7, order_id: 'o1', order_label: 'HS-1042', account: 'Dr. Cruz Clinic', amount: 4000, date: '2026-09-06', method: 'Bank transfer', ref: 'BPI 8891', qbo_id: null });
  DB.returns.push({ id: 3, account: 'Dr. Cruz Clinic', order_ref: 'HS-1042', items: '1 × FACE NADE', amount: 1000, action: 'restock', reason: 'damaged', date: '2026-09-07' });
  set('qbo_post_from', '2026-09-01'); set('qbo_tax_code', '5'); set('qbo_non_tax_code', 'N'); set('qbo_class_id', QBO.classes[0].Id); set('qbo_deposit_account', '35'); set('qbo_income_account', '40');
  DB.qbo_tokens[0].access_expires_at = new Date(Date.now() + 3600000).toISOString();

  DB.orders.push({ id: 'o4', num: 45, date: '2026-09-05', account: 'Brand New Derma', spec: 'Rhas', status: 'pending', total: 300, deleted_at: null, source: 'native', approved: true });
  DB.order_lines.push({ id: 5, order_id: 'o4', sku: 'NEW01', name: 'NEW PRODUCT', qty: 1, price: 300, amount: 300, is_free: false });
  const custN = QBO.customers.length, itemN = QBO.items.length, classN = QBO.classes.length;
  const P = await runSync({ by: 'test' });
  ok('preview writes NOTHING to QuickBooks: unknown customer/item are reported, not created', QBO.customers.length === custN && QBO.items.length === itemN && QBO.classes.length === classN && /would post 300.00 — and create the customer "Brand New Derma"/.test(DB.qbo_sync.find(r => r.hq_ref === 'o4').last_error), DB.qbo_sync.find(r => r.hq_ref === 'o4').last_error);
  DB.orders.splice(DB.orders.findIndex(o => o.id === 'o4'), 1); DB.qbo_sync.splice(DB.qbo_sync.findIndex(r => r.hq_ref === 'o4'), 1);
  ok('preview: nothing posted, would-post rows written, internal account skipped, fuzzy customer held, PENDING order included (post at creation)', P.mode === 'preview' && QBO.invoices.length === 0 && P.invoices.preview === 2 && P.invoices.held === 1 &&
    DB.qbo_sync.find(r => r.hq_ref === 'o1').status === 'pending' && /native discount row/.test(DB.qbo_sync.find(r => r.hq_ref === 'o1').last_error) && DB.qbo_sync.find(r => r.hq_ref === 'o2').status === 'skipped' && /needs confirmation/.test(DB.qbo_sync.find(r => r.hq_ref === 'o3').last_error), JSON.stringify(P.invoices) + ' ' + JSON.stringify(DB.qbo_sync.map(r => [r.hq_ref, r.status, r.last_error])));
  ok('preview: the August order is outside post_from; the unapproved order is not considered; Shopify orders wait for qbo_sources = all', !DB.qbo_sync.find(r => r.hq_ref === 'o0') && !DB.qbo_sync.find(r => r.hq_ref === 'o5') && !DB.qbo_sync.find(r => r.hq_ref === 's1'));
  ok('lock released after the run', !DB.app_settings.find(x => x.key === 'qbo_lock').value && DB.app_settings.find(x => x.key === 'qbo_last_run'));

  set('qbo_enabled', '1');
  const L = await runSync({ by: 'test' });
  const inv = QBO.invoices[0]; const s1 = DB.qbo_sync.find(r => r.hq_ref === 'o1');
  ok('live: HS-1042 posted as an invoice, ledger row posted with the QBO id', L.invoices.posted === 1 && inv && inv.DocNumber === 'HS-1042' && s1.status === 'posted' && s1.qbo_id === inv.Id, JSON.stringify(L.errors));
  const sold = inv.Line[0], free = inv.Line[1], disc = inv.Line.find(l => l.DetailType === 'DiscountLineDetail');
  ok('live: Sean\'s shape — list price on both lines (10 000 + 1 000 gross via TaxInclusiveAmt), Amount = net, no UnitPrice, tax code 5, class on every line and the header', sold.SalesItemLineDetail.TaxInclusiveAmt === 10000 && free.SalesItemLineDetail.TaxInclusiveAmt === 1000 && near(sold.Amount, 10000 / 1.12) && sold.SalesItemLineDetail.UnitPrice === undefined && sold.SalesItemLineDetail.TaxCodeRef.value === '5' && sold.SalesItemLineDetail.ClassRef.value === QBO.classes[0].Id && inv.ClassRef.value === QBO.classes[0].Id && !inv.DepartmentRef, JSON.stringify(inv.Line));
  ok('live: the 10+1 deal is ONE Discount row of 1 000 gross (sent as net) and QuickBooks totals the invoice at 10 000 — the order total', disc && disc.DiscountLineDetail.PercentBased === false && near(disc.Amount, 1000 / 1.12) && near(inv.TotalAmt, 10000) && near(s1.amount, 10000), JSON.stringify([disc, inv.TotalAmt]));
  ok('live: the Discount service item was created on the income account', QBO.items.some(i => i.Name === 'Discount' && i.Type === 'Service'));
  ok('live: payments are NOT sent while qbo_sync_payments is off (finance records them by hand)', L.payments.off === true && L.payments.posted === 0 && QBO.payments.filter(p => p.TotalAmt === 4000).length === 0);
  ok('live: the credit memo posted VAT-inclusive with class and was applied to HS-1042', L.creditmemos.posted === 1 && QBO.creditmemos[0].DocNumber === 'CM-1003' && QBO.creditmemos[0].Line[0].SalesItemLineDetail.TaxInclusiveAmt === 1000 && QBO.payments.some(p => p.TotalAmt === 0 && p.Line[0].LinkedTxn.length === 2) && /applied to HS-1042/.test(DB.qbo_sync.find(r => r.kind === 'creditmemo').last_error));
  ok('live: first live run only sets the CDC cursor', !!DB.app_settings.find(x => x.key === 'qbo_cdc_since').value && L.payments.pulled === 0);
  ok('live: held order still held (unconfirmed customer)', DB.qbo_sync.find(r => r.hq_ref === 'o3').status === 'pending');

  set('qbo_sync_payments', '1'); const L2 = await runSync({ by: 'test' });
  ok('payments toggle on → the HQ payment posts against the invoice', L2.payments.posted === 1 && QBO.payments.some(p => p.TotalAmt === 4000 && p.Line[0].LinkedTxn[0].TxnId === inv.Id) && DB.qbo_sync.find(r => r.kind === 'payment' && r.hq_ref === '7').status === 'posted');
  set('qbo_sync_payments', '0');

  // unchanged order → no second post; changed order → update
  const before = QBO.calls.length; await runSync({ by: 'test' });
  ok('rerun with nothing changed posts nothing', QBO.invoices.length === 1 && !QBO.calls.slice(before).some(c => c === 'invoice POST'));
  DB.orders.find(o => o.id === 'o1').notes = 'leave at reception'; const U = await runSync({ by: 'test' });
  ok('a changed order updates the invoice with the current SyncToken (same total, so allowed despite the payment)', U.invoices.updated === 1 && inv.CustomerMemo.value === 'leave at reception' && inv.SyncToken === '1' && DB.qbo_sync.find(r => r.hq_ref === 'o1').status === 'updated', JSON.stringify(U.errors));
  DB.order_lines.find(l => l.id === 1).amount = 20000; DB.order_lines.find(l => l.id === 1).price = 2000; DB.orders.find(o => o.id === 'o1').total = 20000;
  const U2 = await runSync({ by: 'test' });
  ok('a total change on an invoice that already has a payment (4 000 + the 1 000 credit applied) is refused with a clear message', U2.invoices.errors === 1 && /already has 5000.00 applied and the total would change 10000.00 → 20000.00/.test(DB.qbo_sync.find(r => r.hq_ref === 'o1').last_error), DB.qbo_sync.find(r => r.hq_ref === 'o1').last_error);
  DB.order_lines.find(l => l.id === 1).amount = 10000; DB.order_lines.find(l => l.id === 1).price = 1000; DB.orders.find(o => o.id === 'o1').total = 10000;
  const U3 = await runSync({ by: 'test' });
  ok('back to the original total → the row recovers to updated', ['updated', 'posted'].includes(DB.qbo_sync.find(r => r.hq_ref === 'o1').status) && U3.invoices.errors === 0, JSON.stringify(U3.errors));

  // a payment recorded in QuickBooks comes back into HQ
  QBO.cdc = [{ Id: '900', TotalAmt: 3000, TxnDate: '2026-09-08', PaymentRefNum: 'CHK 1', PaymentMethodRef: { name: 'Check' }, Line: [{ Amount: 3000, LinkedTxn: [{ TxnId: inv.Id, TxnType: 'Invoice' }] }], CustomerRef: { value: '1' } }];
  const C = await runSync({ by: 'test' });
  const pulled = DB.payments.find(p => p.qbo_id === '900'); const o1 = DB.orders.find(o => o.id === 'o1');
  ok('QBO payment pulled into HQ payments and the order rolled up (4000 + 3000 of 10000)', C.payments.pulled === 1 && pulled && pulled.amount === 3000 && pulled.created_name === 'QuickBooks' && o1.paid === 7000 && o1.balance === 3000 && o1.pay_status === 'partial', JSON.stringify([C.payments, o1.paid, o1.balance, C.errors]));
  const D = await runSync({ by: 'test' });
  ok('the same QBO payment is never pulled twice, and our own payments are not echoed back', D.payments.pulled === 0 && DB.payments.filter(p => p.qbo_id === '900').length === 1);
  QBO.cdc = [{ Id: '900', status: 'Deleted' }]; const V = await runSync({ by: 'test' });
  ok('a payment deleted in QuickBooks becomes an offsetting row; order rolls back', V.payments.pulled === 1 && DB.payments.some(p => p.qbo_id === '900:void' && p.amount === -3000) && o1.paid === 4000);
  QBO.cdc = [];

  // cancelled after posting: money received → hands off; unpaid same month → void; unpaid later month → credit note by hand
  DB.orders.find(o => o.id === 'o1').status = 'cancelled'; const X = await runSync({ by: 'test' });
  ok('a cancelled order with money received is NOT voided — refund / credit note by hand', X.invoices.skipped === 1 && inv.voided !== true && /money was received/.test(DB.qbo_sync.find(r => r.hq_ref === 'o1').last_error), DB.qbo_sync.find(r => r.hq_ref === 'o1').last_error);
  // confirm the fuzzy customer → HS-1044 posts; then cancel it the same month → void; then a later-month cancellation
  const m = DB.qbo_map.find(x => x.hq_key === 'SKIN STATION INC'); m.confirmed = true;
  const Y = await runSync({ by: 'test' });
  ok('confirmed mapping → held invoice posts', Y.invoices.posted === 1 && DB.qbo_sync.find(r => r.hq_ref === 'o3').status === 'posted');
  const inv3 = QBO.invoices.find(i => i.DocNumber === 'HS-1044');
  DB.orders.find(o => o.id === 'o3').status = 'cancelled'; DB.orders.find(o => o.id === 'o3').updated_at = '2026-09-20T03:00:00Z';
  const Z = await runSync({ by: 'test' });
  ok('unpaid and cancelled in the same Manila month → voided', Z.invoices.voided === 1 && inv3.voided === true && DB.qbo_sync.find(r => r.hq_ref === 'o3').status === 'voided', JSON.stringify(Z.errors));
  DB.orders.push({ id: 'o6', num: 47, date: '2026-09-07', account: 'Dr. Cruz Clinic', spec: 'Rhas', status: 'pending', total: 500, deleted_at: null, source: 'native', approved: true });
  DB.order_lines.push({ id: 7, order_id: 'o6', sku: 'TD040', name: 'FACE NADE', qty: 1, price: 500, amount: 500, is_free: false });
  await runSync({ by: 'test' });
  const inv6 = QBO.invoices.find(i => i.DocNumber === 'HS-1047'); inv6.TxnDate = '2026-08-07'; // pretend it was invoiced last month
  DB.orders.find(o => o.id === 'o6').status = 'cancelled'; DB.orders.find(o => o.id === 'o6').updated_at = '2026-09-20T03:00:00Z';
  const W = await runSync({ by: 'test' });
  ok('unpaid but cancelled in a LATER month than its invoice → left open, "issue a credit note"', W.invoices.skipped === 1 && inv6.voided !== true && /later month than its invoice \(2026-08\)/.test(DB.qbo_sync.find(r => r.hq_ref === 'o6').last_error), DB.qbo_sync.find(r => r.hq_ref === 'o6').last_error);

  // strict totals: an invoice QuickBooks totals differently is deleted again and the row errors
  DB.orders.push({ id: 'o7', num: 48, date: '2026-09-08', account: 'Dr. Cruz Clinic', spec: 'Rhas', status: 'pending', total: 5000, deleted_at: null, source: 'native', approved: true });
  DB.order_lines.push({ id: 8, order_id: 'o7', sku: 'TS-ENEKA', name: 'Termosalud Eneka', qty: 1, price: 5000, amount: 5000, is_free: false });
  set('qbo_non_tax_code', '5'); // misconfigured: the "No VAT" code is the VAT code → QBO would add VAT the mapper did not predict
  const ST = await runSync({ by: 'test' });
  const r7 = DB.qbo_sync.find(r => r.hq_ref === 'o7');
  ok('strict totals: QuickBooks computed a different total → the invoice is deleted again and the row errors with both figures', ST.invoices.errors === 1 && r7.status === 'error' && /QuickBooks computed .* but the order is 5000.00 — deleted again/.test(r7.last_error) && !QBO.invoices.some(i => i.DocNumber === 'HS-1048'), r7.last_error);
  set('qbo_non_tax_code', 'N'); DB.qbo_sync.splice(DB.qbo_sync.indexOf(r7), 1);
  const ST2 = await runSync({ by: 'test' });
  const inv7 = QBO.invoices.find(i => i.DocNumber === 'HS-1048');
  ok('fixed code → the exempt line posts as No-VAT with Amount = gross and the total ties out', ST2.invoices.posted === 1 && inv7 && inv7.Line[0].SalesItemLineDetail.TaxCodeRef.value === 'N' && inv7.Line[0].Amount === 5000 && near(inv7.TotalAmt, 5000), JSON.stringify(ST2.errors));

  // Shopify orders through HQ
  set('qbo_sources', 'all'); const SH = await runSync({ by: 'test' });
  const hg = QBO.invoices.find(i => i.DocNumber === 'HG-10496'); const rs1 = DB.qbo_sync.find(r => r.hq_ref === 's1'), rs2 = DB.qbo_sync.find(r => r.hq_ref === 's2');
  ok('qbo_sources = all: the Shopify order posts as HG-10496 from its snapshot — Shopify customer name, 50 % Discount row, total 95 000, VAT 10 178.57, due +30 days', hg && rs1.status === 'posted' && near(hg.TotalAmt, 95000) && near(hg.TxnTaxDetail.TotalTax, 10178.57, 0.02) && hg.Line.find(l => l.DetailType === 'DiscountLineDetail').DiscountLineDetail.DiscountPercent === 50 && hg.DueDate === '2026-10-15' && hg.TxnDate === '2026-09-15' && QBO.customers.some(c => c.DisplayName === 'Maria Santos') && hg.CustomerRef.value === '3', JSON.stringify([SH.errors, rs1 && rs1.last_error, hg && hg.DueDate]));
  ok('a Shopify order without a snapshot yet is held, not errored', rs2 && rs2.status === 'pending' && /no Shopify snapshot/.test(rs2.last_error), rs2 && rs2.last_error);
  ok('the Shopify order\'s PrivateNote names Shopify and HQ', /Shopify order #HG-10496 .* via HQ/.test(hg.PrivateNote), hg.PrivateNote);
  ok('second concurrent run is refused by the lock', (set('qbo_lock', new Date().toISOString()), (await runSync({ by: 'test' })).skipped === true));
  set('qbo_lock', '');
}
// ── the shadow reconciliation ────────────────────────────────────────────────
{
  const blobs = {}; REC._useStore(name => ({ async setJSON(k, v) { blobs[name + '/' + k] = JSON.parse(JSON.stringify(v)); }, async get(k) { return blobs[name + '/' + k] || null; } }));
  // HG-10496 is in QuickBooks (posted above by HQ — standing in for the old connector); add a second Shopify order the connector posted differently, a third missing, a cancelled one
  const HG2 = JSON.parse(JSON.stringify(HG)); HG2.id = 2; HG2.name = '#HG-10500'; HG2.total_discounts = '0.00'; HG2.total_price = '190000.00'; HG2.total_tax = '20357.14'; HG2.line_items[0].discount_allocations = [];
  const HG3 = JSON.parse(JSON.stringify(HG)); HG3.id = 3; HG3.name = '#HG-10501';
  const HG4 = JSON.parse(JSON.stringify(HG)); HG4.id = 4; HG4.name = '#HG-10502'; HG4.cancelled_at = '2026-09-17T10:00:00+08:00';
  DB.orders.push({ id: 's3', num: 902, date: '2026-09-16', account: 'Maria Santos', status: 'pending', total: 190000, deleted_at: null, source: 'shopify', ext_ref: '#HG-10500', approved: true, qbo_src: HG2 },
    { id: 's4', num: 903, date: '2026-09-16', account: 'Maria Santos', status: 'pending', total: 95000, deleted_at: null, source: 'shopify', ext_ref: '#HG-10501', approved: true, qbo_src: HG3 },
    { id: 's5', num: 904, date: '2026-09-17', account: 'Maria Santos', status: 'cancelled', total: 95000, deleted_at: null, source: 'shopify', ext_ref: '#HG-10502', approved: true, qbo_src: HG4 },
    { id: 's6', num: 905, date: '2026-09-17', account: 'Test Clinic', status: 'pending', total: 1, deleted_at: null, source: 'shopify', ext_ref: '#HG-10503', approved: true, qbo_src: HG4 });
  // the connector's HG-10500: same DocNumber, but it applied a discount HQ does not see → different total, and without a class
  QBO.invoices.push({ Id: '777', SyncToken: '0', DocNumber: 'HG-10500', TxnDate: '2026-09-15', DueDate: '2026-10-15', TotalAmt: 180000, Balance: 180000, TxnTaxDetail: { TotalTax: 19285.71 }, CustomerRef: { value: '3', name: 'Maria Santos' }, Line: [{ DetailType: 'SalesItemLineDetail', Amount: 1, SalesItemLineDetail: { ItemRef: { value: '10' } } }] });
  const R = await REC.runReconcile({ by: 'test', since: '2026-09-14' });
  ok('reconcile: compares every Shopify order since the cutoff, skipping test accounts and those without a snapshot', R.orders === 4 && R.skipped === 1 && R.noSnapshot === 1, JSON.stringify([R.orders, R.skipped, R.noSnapshot, R.errors]));
  ok('reconcile: HG-10496 identical, HG-10500 differs (total, VAT, class), HG-10501 missing, HG-10502 cancelled and never posted', R.matched === 1 && R.differences === 1 && R.missing === 1 && R.cancelled === 1 && R.clean === false, JSON.stringify(R.rows.map(r => [r.doc, r.state])));
  const d = R.rows.find(r => r.doc === 'HG-10500');
  ok('reconcile: the difference row names the fields with both figures', d && d.diffs.map(x => x.field).join() === 'total,VAT,class' && d.ours === 190000 && d.theirs === 180000, JSON.stringify(d && d.diffs));
  ok('reconcile: written to Blobs — latest with rows, history without', blobs['qbo/reconcile'].rows.length === 4 && blobs['qbo/reconcile-history'].length === 1 && !blobs['qbo/reconcile-history'][0].rows);
  // make it clean: post the missing one through HQ, fix the odd one, then run twice → a streak
  QBO.invoices.splice(QBO.invoices.findIndex(i => i.Id === '777'), 1); DB.orders.splice(DB.orders.findIndex(o => o.id === 's3'), 1);
  await runSync({ by: 'test' }); // posts HG-10501 (and voids nothing)
  const R2 = await REC.runReconcile({ by: 'test', since: '2026-09-14' }); const R3 = await REC.runReconcile({ by: 'test', since: '2026-09-14' });
  ok('reconcile: clean when every order matches; the streak counts consecutive clean runs', R2.clean === true && R3.clean === true && REC.cleanStreak(blobs['qbo/reconcile-history']).runs === 2 && REC.cleanStreak([{ clean: false }, { clean: true }]).runs === 0, JSON.stringify([R2.matched, R2.differences, R2.missing, R2.errors]));
}
console.log('\n' + pass + '/' + (pass + fail) + ' passed'); process.exit(fail ? 1 : 0);
