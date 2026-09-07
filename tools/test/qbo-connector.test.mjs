/* QuickBooks connector — the library and the sync pass against a fake Intuit and a
   fake Supabase (fetch is mocked; nothing leaves the machine). Run from the repo root:
     node tools/test/qbo-connector.test.mjs
   Covers: document shapes (VAT-inclusive invoice, ₱0 lines, DocNumber, due date,
   class/location), payment ↔ invoice link, credit-memo application, CDC parsing,
   token refresh + rotation, 401 retry, find-or-create with fuzzy customer matching,
   and runSync in preview (posts nothing) and live (posts, pulls a QBO payment
   back, rolls up the order). */
process.env.SUPABASE_URL = 'https://sb.test'; process.env.SUPABASE_SERVICE_KEY = 'svc';
process.env.QBO_CLIENT_ID = 'cid'; process.env.QBO_CLIENT_SECRET = 'sec'; process.env.QBO_ENV = 'sandbox';

let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + x : '')); };

// ── fake Supabase: tiny in-memory tables behind PostgREST-ish URLs ────────────
const DB = { app_settings: [], qbo_tokens: [], qbo_map: [], qbo_sync: [], orders: [], order_lines: [], payments: [], returns: [], doc_formats: [], audit_log: [] };
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
    return { status: 200, body: { QueryResponse: {} } };
  }
  const body = opt.body ? JSON.parse(opt.body) : null;
  const mk = (list, key, extra) => { const doc = Object.assign({ Id: String(list.length + 500), SyncToken: '0' }, body, extra || {}); list.push(doc); return { status: 200, body: { [key]: doc } }; };
  if (path === 'customer') return mk(QBO.customers, 'Customer');
  if (path === 'item') return mk(QBO.items, 'Item');
  if (path === 'class') return mk(QBO.classes, 'Class');
  if (path === 'department') return mk(QBO.departments, 'Department');
  if (path === 'invoice' && body && body.Id) { const inv = QBO.invoices.find(i => i.Id === body.Id); Object.assign(inv, body, { SyncToken: String(+inv.SyncToken + 1) }); if (u.searchParams.get('operation') === 'void') inv.voided = true; return { status: 200, body: { Invoice: inv } }; }
  if (path === 'invoice') return mk(QBO.invoices, 'Invoice', { DocNumber: body.DocNumber });
  if (path.startsWith('invoice/')) return { status: 200, body: { Invoice: QBO.invoices.find(i => i.Id === path.split('/')[1]) } };
  if (path === 'payment') return mk(QBO.payments, 'Payment');
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

// ── documents ────────────────────────────────────────────────────────────────
{
  const inv = Q.buildInvoice({ label: 'HS-1042', date: '2026-09-05', terms_days: 30, dr_no: 'DR-000123', spec: 'Rhas', notes: 'deliver Tue' },
    [{ sku: 'TD040', name: 'FACE NADE', qty: 10, price: 1000, amount: 10000 }, { sku: 'TD040', name: 'FACE NADE', qty: 1, price: 0, amount: 0, is_free: true, deal: '10+1' }],
    { customerId: '1', items: { TD040: '10' }, classId: '77', departmentId: '88' }, { taxCode: '5' });
  ok('invoice: customer, DocNumber, due date from terms, tax-inclusive', inv.CustomerRef.value === '1' && inv.DocNumber === 'HS-1042' && inv.DueDate === '2026-10-05' && inv.GlobalTaxCalculation === 'TaxInclusive', JSON.stringify([inv.DocNumber, inv.DueDate]));
  ok('invoice: every line carries item, tax code, class; free line is ₱0 and says so', inv.Line.length === 2 && inv.Line.every(l => l.SalesItemLineDetail.ItemRef.value === '10' && l.SalesItemLineDetail.TaxCodeRef.value === '5' && l.SalesItemLineDetail.ClassRef.value === '77') && inv.Line[1].Amount === 0 && /free/.test(inv.Line[1].Description) && /10\+1/.test(inv.Line[1].Description));
  ok('invoice: unit price derived from amount/qty, location set, DR in the private note', inv.Line[0].SalesItemLineDetail.UnitPrice === 1000 && inv.DepartmentRef.value === '88' && /DR DR-000123/.test(inv.PrivateNote) && inv.CustomerMemo.value === 'deliver Tue');
  const pay = Q.buildPayment({ id: 7, amount: 5000, date: '2026-09-06', method: 'Bank transfer', ref: 'BPI 8891' }, '1', '500', { depositAccount: '35' });
  ok('payment: applied to the invoice, deposit account, ref ≤ 21 chars', pay.TotalAmt === 5000 && pay.Line[0].LinkedTxn[0].TxnId === '500' && pay.Line[0].LinkedTxn[0].TxnType === 'Invoice' && pay.DepositToAccountRef.value === '35' && pay.PaymentRefNum === 'BPI 8891');
  const cm = Q.buildCreditMemo({ amount: 2000, date: '2026-09-07', reason: 'damaged', items: '2 × FACE NADE', order_ref: 'HS-1042' }, '1', '99', { taxCode: '5' }, 'CM-1003');
  ok('credit memo: one tax-inclusive line on the returns item, numbered', cm.DocNumber === 'CM-1003' && cm.Line[0].Amount === 2000 && cm.Line[0].SalesItemLineDetail.ItemRef.value === '99' && cm.GlobalTaxCalculation === 'TaxInclusive');
  const app = Q.buildCreditApplication('1', '500', '600', 2000, '2026-09-07');
  ok('credit application: zero-amount payment linking invoice and credit memo', app.TotalAmt === 0 && app.Line[0].LinkedTxn.map(t => t.TxnType).join() === 'Invoice,CreditMemo');
  ok('fingerprint is stable and changes with content', Q.fingerprint(inv) === Q.fingerprint(JSON.parse(JSON.stringify(inv))) && Q.fingerprint(inv) !== Q.fingerprint(Object.assign({}, inv, { DocNumber: 'HS-1043' })));
  ok('docLabel mirrors docNo(): HS-1042 for num 42, CM-1003, QT padding', Q.docLabel({}, 'order', 42) === 'HS-1042' && Q.docLabel({}, 'cm', 3) === 'CM-1003' && Q.docLabel({ quote: { prefix: 'QT-', pad: 4, offset_no: 0 } }, 'quote', 7) === 'QT-0007');
  ok('norm() matches clinic names across systems', Q.norm('Skin Station, Inc.') === Q.norm('SKIN STATION INC') && Q.norm("Dr. Cruz's Clinic") !== Q.norm('Dr. Reyes Clinic'));
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
  const c = await Q.ensureCustomer(api, 'New Derma Hub');
  ok('unknown customer is created and mapped', c.confirmed === true && QBO.customers.some(x => x.DisplayName === 'New Derma Hub'));
  ok('second lookup hits qbo_map, not QuickBooks', (QBO.calls.length, await Q.ensureCustomer(api, 'New Derma Hub'), QBO.calls.slice(-1)[0] !== 'query GET'));
  const i1 = await Q.ensureItem(api, 'TD040', 'FACE NADE', '40', '5'); const i2 = await Q.ensureItem(api, 'ME0001', 'MELINE INTIMATE', '40', '5');
  ok('items: found by SKU, created on the income account when missing', i1.qbo_id === '10' && QBO.items.find(i => i.Sku === 'ME0001').IncomeAccountRef.value === '40' && i2.confirmed === true);
  let e = ''; try { await Q.ensureItem(api, 'XX1', 'Unknown', '', '5'); } catch (x) { e = x.message; }
  ok('no income account → clear error instead of a half-made item', /no income account/.test(e), e);
  const cls = await Q.ensureClass(api, 'Rhas Porciuncula'); const dep = await Q.ensureDepartment(api, 'Team 1');
  ok('class and department created by name', QBO.classes[0].Name === 'Rhas Porciuncula' && cls.qbo_id && QBO.departments[0].Name === 'Team 1' && dep.qbo_id);
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
{
  DB.orders.push({ id: 'o1', num: 42, date: '2026-09-05', account: 'Dr. Cruz Clinic', spec: 'Rhas', status: 'fulfilled', total: 10000, terms_days: 30, notes: '', dr_no: 'DR-000123', fulfilled_at: '2026-09-05T10:00:00Z', deleted_at: null, source: 'native' },
    { id: 'o2', num: 43, date: '2026-09-05', account: 'Remedy BGC', spec: 'Rhas', status: 'fulfilled', total: 500, fulfilled_at: '2026-09-05T11:00:00Z', deleted_at: null, source: 'native' },
    { id: 'o3', num: 44, date: '2026-09-05', account: 'SKIN STATION INC', spec: 'Rhas', status: 'fulfilled', total: 800, fulfilled_at: '2026-09-05T12:00:00Z', deleted_at: null, source: 'native' },
    { id: 'o0', num: 40, date: '2026-08-01', account: 'Dr. Cruz Clinic', spec: 'Rhas', status: 'fulfilled', total: 999, fulfilled_at: '2026-08-01T12:00:00Z', deleted_at: null, source: 'native' });
  DB.order_lines.push({ id: 1, order_id: 'o1', sku: 'TD040', name: 'FACE NADE', qty: 10, price: 1000, amount: 10000, is_free: false, deal: null }, { id: 2, order_id: 'o1', sku: 'TD040', name: 'FACE NADE', qty: 1, price: 0, amount: 0, is_free: true, deal: '10+1' },
    { id: 3, order_id: 'o2', sku: 'TD040', name: 'FACE NADE', qty: 1, price: 500, amount: 500, is_free: false }, { id: 4, order_id: 'o3', sku: 'TD040', name: 'FACE NADE', qty: 1, price: 800, amount: 800, is_free: false });
  DB.payments.push({ id: 7, order_id: 'o1', order_label: 'HS-1042', account: 'Dr. Cruz Clinic', amount: 4000, date: '2026-09-06', method: 'Bank transfer', ref: 'BPI 8891', qbo_id: null });
  DB.returns.push({ id: 3, account: 'Dr. Cruz Clinic', order_ref: 'HS-1042', items: '1 × FACE NADE', amount: 1000, action: 'restock', reason: 'damaged', date: '2026-09-07' });
  const set = (k, v) => { const r = DB.app_settings.find(x => x.key === k); if (r) r.value = v; else DB.app_settings.push({ key: k, value: v }); };
  set('qbo_post_from', '2026-09-01'); set('qbo_tax_code', '5'); set('qbo_deposit_account', '35'); set('qbo_income_account', '40'); set('qbo_use_class', '1'); set('qbo_use_location', '1');
  DB.qbo_tokens[0].access_expires_at = new Date(Date.now() + 3600000).toISOString();

  DB.orders.push({ id: 'o4', num: 45, date: '2026-09-05', account: 'Brand New Derma', spec: 'Rhas', status: 'fulfilled', total: 300, fulfilled_at: '2026-09-05T13:00:00Z', deleted_at: null, source: 'native' });
  DB.order_lines.push({ id: 5, order_id: 'o4', sku: 'NEW01', name: 'NEW PRODUCT', qty: 1, price: 300, amount: 300, is_free: false });
  const custN = QBO.customers.length, itemN = QBO.items.length, classN = QBO.classes.length;
  const P = await runSync({ by: 'test' });
  ok('preview writes NOTHING to QuickBooks: unknown customer/item/class are reported, not created', QBO.customers.length === custN && QBO.items.length === itemN && QBO.classes.length === classN && /would post — and create the customer "Brand New Derma"/.test(DB.qbo_sync.find(r => r.hq_ref === 'o4').last_error), DB.qbo_sync.find(r => r.hq_ref === 'o4').last_error);
  DB.orders.splice(DB.orders.findIndex(o => o.id === 'o4'), 1); DB.qbo_sync.splice(DB.qbo_sync.findIndex(r => r.hq_ref === 'o4'), 1);
  ok('preview: nothing posted, would-post rows written, internal account skipped, fuzzy customer held', P.mode === 'preview' && QBO.invoices.length === 0 && P.invoices.preview === 2 && P.invoices.held === 1 &&
    DB.qbo_sync.find(r => r.hq_ref === 'o1').status === 'pending' && DB.qbo_sync.find(r => r.hq_ref === 'o2').status === 'skipped' && /needs confirmation/.test(DB.qbo_sync.find(r => r.hq_ref === 'o3').last_error), JSON.stringify(P.invoices) + ' ' + JSON.stringify(DB.qbo_sync.map(r => [r.hq_ref, r.status])));
  ok('preview: the August order is outside post_from and untouched', !DB.qbo_sync.find(r => r.hq_ref === 'o0'));
  ok('lock released after the run', !DB.app_settings.find(x => x.key === 'qbo_lock').value && DB.app_settings.find(x => x.key === 'qbo_last_run'));

  set('qbo_enabled', '1');
  const L = await runSync({ by: 'test' });
  const inv = QBO.invoices[0]; const s1 = DB.qbo_sync.find(r => r.hq_ref === 'o1');
  ok('live: HS-1042 posted as an invoice with class + location, ledger row posted', L.invoices.posted === 1 && inv && inv.DocNumber === 'HS-1042' && inv.Line[0].SalesItemLineDetail.ClassRef && inv.DepartmentRef && s1.status === 'posted' && s1.qbo_id === inv.Id, JSON.stringify(L.errors));
  ok('live: the HQ payment posted against that invoice', L.payments.posted === 1 && QBO.payments.some(p => p.TotalAmt === 4000 && p.Line[0].LinkedTxn[0].TxnId === inv.Id) && DB.qbo_sync.find(r => r.kind === 'payment' && r.hq_ref === '7').status === 'posted');
  ok('live: the credit memo posted and was applied to HS-1042', L.creditmemos.posted === 1 && QBO.creditmemos[0].DocNumber === 'CM-1003' && QBO.payments.some(p => p.TotalAmt === 0 && p.Line[0].LinkedTxn.length === 2) && /applied to HS-1042/.test(DB.qbo_sync.find(r => r.kind === 'creditmemo').last_error));
  ok('live: first live run only sets the CDC cursor', !!DB.app_settings.find(x => x.key === 'qbo_cdc_since').value && L.payments.pulled === 0);
  ok('live: held order still held (unconfirmed customer)', DB.qbo_sync.find(r => r.hq_ref === 'o3').status === 'pending');

  // unchanged order → no second post; changed order → update
  const before = QBO.calls.length; await runSync({ by: 'test' });
  ok('rerun with nothing changed posts nothing', QBO.invoices.length === 1 && !QBO.calls.slice(before).some(c => c === 'invoice POST'));
  DB.orders.find(o => o.id === 'o1').notes = 'leave at reception'; const U = await runSync({ by: 'test' });
  ok('a changed order updates the invoice with the current SyncToken', U.invoices.updated === 1 && inv.CustomerMemo.value === 'leave at reception' && inv.SyncToken === '1' && DB.qbo_sync.find(r => r.hq_ref === 'o1').status === 'updated');

  // a payment recorded in QuickBooks comes back into HQ
  QBO.cdc = [{ Id: '900', TotalAmt: 3000, TxnDate: '2026-09-08', PaymentRefNum: 'CHK 1', PaymentMethodRef: { name: 'Check' }, Line: [{ Amount: 3000, LinkedTxn: [{ TxnId: inv.Id, TxnType: 'Invoice' }] }], CustomerRef: { value: '1' } }];
  const C = await runSync({ by: 'test' });
  const pulled = DB.payments.find(p => p.qbo_id === '900'); const o1 = DB.orders.find(o => o.id === 'o1');
  ok('QBO payment pulled into HQ payments and the order rolled up (4000 + 3000 of 10000)', C.payments.pulled === 1 && pulled && pulled.amount === 3000 && pulled.created_name === 'QuickBooks' && o1.paid === 7000 && o1.balance === 3000 && o1.pay_status === 'partial', JSON.stringify([C.payments, o1.paid, o1.balance]));
  const D = await runSync({ by: 'test' });
  ok('the same QBO payment is never pulled twice, and our own payments are not echoed back', D.payments.pulled === 0 && DB.payments.filter(p => p.qbo_id === '900').length === 1);
  QBO.cdc = [{ Id: '900', status: 'Deleted' }]; const V = await runSync({ by: 'test' });
  ok('a payment deleted in QuickBooks becomes an offsetting row; order rolls back', V.payments.pulled === 1 && DB.payments.some(p => p.qbo_id === '900:void' && p.amount === -3000) && o1.paid === 4000);
  QBO.cdc = [];

  // cancelled after posting → void
  DB.orders.find(o => o.id === 'o1').status = 'cancelled'; const X = await runSync({ by: 'test' });
  ok('a cancelled order voids its invoice', X.invoices.voided === 1 && inv.voided === true && DB.qbo_sync.find(r => r.hq_ref === 'o1').status === 'voided');

  // confirm the fuzzy customer → posts on the next run
  const m = DB.qbo_map.find(x => x.hq_key === 'SKIN STATION INC'); m.confirmed = true;
  const Y = await runSync({ by: 'test' });
  ok('confirmed mapping → held invoice posts', Y.invoices.posted === 1 && DB.qbo_sync.find(r => r.hq_ref === 'o3').status === 'posted');
  ok('second concurrent run is refused by the lock', (set('qbo_lock', new Date().toISOString()), (await runSync({ by: 'test' })).skipped === true));
}
console.log('\n' + pass + '/' + (pass + fail) + ' passed'); process.exit(fail ? 1 : 0);
