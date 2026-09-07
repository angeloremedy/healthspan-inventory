// QuickBooks Online — one door. Everything the connector knows about Intuit's
// API lives here: OAuth token refresh (refresh tokens ROTATE on every use and
// die after 100 days of silence, so the sync keeps them warm), the query
// endpoint, find-or-create for the reference data an invoice needs (customer,
// item, class, department), and the three document builders — Invoice,
// Payment, CreditMemo — shaped the way a Philippine VAT-inclusive company
// books them (GlobalTaxCalculation = TaxInclusive, one tax code on every line).
//
// Env: QBO_CLIENT_ID · QBO_CLIENT_SECRET · QBO_ENV (sandbox | production)
// Tokens: public.qbo_tokens (service key only). Mappings: public.qbo_map.
//
// Callers never build request bodies themselves; they call the verbs below and
// get back plain objects. Every QBO error surfaces as an Error whose message
// carries Intuit's own Detail text, so the sync log says WHY, not just "failed".

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_KEY || '';
const MINOR = 75; // API minor version — pinned so a QBO change never silently reshapes responses

export function qboEnv() { return (process.env.QBO_ENV || 'production').toLowerCase() === 'sandbox' ? 'sandbox' : 'production'; }
export function apiBase(env) { return (env || qboEnv()) === 'sandbox' ? 'https://sandbox-quickbooks.api.intuit.com' : 'https://quickbooks.api.intuit.com'; }
export const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
export const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
export const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
export function hasClient() { return !!(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET); }
function basic() { return 'Basic ' + Buffer.from(process.env.QBO_CLIENT_ID + ':' + process.env.QBO_CLIENT_SECRET).toString('base64'); }

// ── Supabase (service key) ───────────────────────────────────────────────────
export async function sb(path, method = 'GET', body) {
  // a POST whose path carries on_conflict= is an upsert (merge the given columns); every other POST is a plain insert / RPC
  const prefer = method === 'POST' && /on_conflict=/.test(path) ? 'return=representation,resolution=merge-duplicates' : method === 'GET' ? '' : 'return=representation';
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    method, headers: Object.assign({ apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' }, prefer ? { Prefer: prefer } : {}),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!r.ok) { const t = await r.text(); throw new Error('Supabase ' + r.status + ' on ' + path.split('?')[0] + ': ' + t.slice(0, 200)); }
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
export async function setting(key) { try { const r = await sb('app_settings?select=value&key=eq.' + encodeURIComponent(key)); return (r[0] || {}).value || ''; } catch (e) { return ''; } }
export async function setSetting(key, value, by) {
  return sb('app_settings?on_conflict=key', 'POST', { key, value: String(value), updated_by: by || null, updated_at: new Date().toISOString() });
}

// ── OAuth ────────────────────────────────────────────────────────────────────
export function authorizeUrl(redirectUri, state) {
  const q = new URLSearchParams({ client_id: process.env.QBO_CLIENT_ID || '', response_type: 'code', scope: 'com.intuit.quickbooks.accounting', redirect_uri: redirectUri, state });
  return AUTH_URL + '?' + q.toString();
}
async function tokenCall(params) {
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { Authorization: basic(), Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Intuit token endpoint: ' + (j.error_description || j.error || ('HTTP ' + r.status)));
  return j;
}
function tokenRow(realmId, j, extra) {
  const now = Date.now();
  return Object.assign({
    realm_id: realmId, env: qboEnv(), access_token: j.access_token, refresh_token: j.refresh_token,
    access_expires_at: new Date(now + (j.expires_in || 3600) * 1000).toISOString(),
    refresh_expires_at: new Date(now + (j.x_refresh_token_expires_in || 100 * 86400) * 1000).toISOString(),
    updated_at: new Date().toISOString()
  }, extra || {});
}
export async function exchangeCode(code, redirectUri, realmId, by) {
  const j = await tokenCall({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  const row = tokenRow(realmId, j, { connected_by: by || null });
  await sb('qbo_tokens?on_conflict=realm_id', 'POST', row);
  return row;
}
export async function loadTokens() { const r = await sb('qbo_tokens?select=*&env=eq.' + qboEnv() + '&order=updated_at.desc&limit=1'); return r[0] || null; }
export async function refreshIfNeeded(tok, force) {
  if (!tok) throw new Error('QuickBooks is not connected — Finance → QuickBooks sync → Connect.');
  const soon = Date.parse(tok.access_expires_at) - Date.now() < 5 * 60 * 1000;
  if (!soon && !force) return tok;
  if (Date.parse(tok.refresh_expires_at) < Date.now()) throw new Error('The QuickBooks connection lapsed (refresh token older than 100 days) — connect again.');
  const j = await tokenCall({ grant_type: 'refresh_token', refresh_token: tok.refresh_token });
  const row = tokenRow(tok.realm_id, j, { company_name: tok.company_name || null, connected_by: tok.connected_by || null });
  await sb('qbo_tokens?on_conflict=realm_id', 'POST', row);
  return row;
}
export async function revoke(tok) {
  try { await fetch(REVOKE_URL, { method: 'POST', headers: { Authorization: basic(), 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tok.refresh_token }) }); } catch (e) {}
  await sb('qbo_tokens?realm_id=eq.' + encodeURIComponent(tok.realm_id), 'DELETE');
}

// ── The API client ───────────────────────────────────────────────────────────
// qbo(tok) returns a client bound to one company; .get/.post retry once after a
// 401 (token just expired between our check and the call).
export function client(tok) {
  let cur = tok;
  const base = () => apiBase(cur.env) + '/v3/company/' + encodeURIComponent(cur.realm_id) + '/';
  async function call(method, path, body, retry = true) {
    const url = base() + path + (path.includes('?') ? '&' : '?') + 'minorversion=' + MINOR;
    const r = await fetch(url, { method, headers: { Authorization: 'Bearer ' + cur.access_token, Accept: 'application/json', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (r.status === 401 && retry) { cur = await refreshIfNeeded(cur, true); return call(method, path, body, false); }
    const text = await r.text(); let j = {}; try { j = text ? JSON.parse(text) : {}; } catch (e) { j = { raw: text }; }
    if (!r.ok) throw new Error(qboError(j, r.status));
    return j;
  }
  return {
    get tok() { return cur; },
    get: p => call('GET', p),
    post: (p, b) => call('POST', p, b),
    async query(sql) { const j = await call('GET', 'query?query=' + encodeURIComponent(sql)); return j.QueryResponse || {}; },
    async companyInfo() { const j = await call('GET', 'companyinfo/' + encodeURIComponent(cur.realm_id)); return j.CompanyInfo || {}; },
    async preferences() { const j = await call('GET', 'preferences'); return j.Preferences || {}; }
  };
}
export function qboError(j, status) {
  const f = j && j.Fault && j.Fault.Error && j.Fault.Error[0];
  if (f) return 'QBO ' + (f.code ? f.code + ' ' : '') + (f.Message || '') + (f.Detail ? ' — ' + f.Detail : '');
  return 'QBO HTTP ' + status + (j && j.raw ? ': ' + String(j.raw).slice(0, 160) : '');
}
// QBO's query language takes single-quoted strings; a name with an apostrophe must be doubled
export const q = s => String(s || '').replace(/'/g, "\\'");

// ── Reference data: find in qbo_map → find in QBO → create ─────────────────
export async function mapGet(kind, key) { const r = await sb('qbo_map?select=*&kind=eq.' + kind + '&hq_key=eq.' + encodeURIComponent(key)); return r[0] || null; }
export async function mapSet(kind, key, qboId, qboName, confirmed = true, candidates = null, by = null) {
  await sb('qbo_map?on_conflict=kind,hq_key', 'POST', { kind, hq_key: key, qbo_id: String(qboId), qbo_name: qboName || null, confirmed, candidates, updated_by: by, updated_at: new Date().toISOString() });
  return { kind, hq_key: key, qbo_id: String(qboId), qbo_name: qboName, confirmed };
}
// simplest sane normaliser for matching clinic names across two systems
export const norm = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').replace(/\b(inc|corp|corporation|co|ltd|clinic|clinics|the)\b/g, '').replace(/\s+/g, ' ').trim();

// Customer: exact DisplayName → normalised match among all customers (unconfirmed) → create.
export async function ensureCustomer(api, name, opts = {}) {
  const m = await mapGet('customer', name); if (m) return m;
  let res = await api.query("select Id, DisplayName from Customer where DisplayName = '" + q(name) + "' maxresults 1");
  if (res.Customer && res.Customer[0]) return mapSet('customer', name, res.Customer[0].Id, res.Customer[0].DisplayName, true);
  // fuzzy: pull the customer list once per run (cached on api) and compare normalised names
  if (!api._customers) { const all = []; let start = 1; for (;;) { const r = await api.query('select Id, DisplayName, Active from Customer startposition ' + start + ' maxresults 1000'); const c = r.Customer || []; all.push(...c); if (c.length < 1000) break; start += 1000; } api._customers = all; }
  const n = norm(name); const hits = api._customers.filter(c => norm(c.DisplayName) === n);
  if (hits.length === 1) return mapSet('customer', name, hits[0].Id, hits[0].DisplayName, false, hits.slice(0, 5).map(c => ({ id: c.Id, name: c.DisplayName })));
  if (hits.length > 1) return mapSet('customer', name, hits[0].Id, hits[0].DisplayName, false, hits.slice(0, 5).map(c => ({ id: c.Id, name: c.DisplayName })));
  if (opts.create === false) return null;
  const c = await api.post('customer', { DisplayName: name.slice(0, 100), CompanyName: name.slice(0, 100) });
  return mapSet('customer', name, c.Customer.Id, c.Customer.DisplayName, true);
}
// Item by SKU, then by name; created as a non-inventory item on the configured income account.
export async function ensureItem(api, sku, name, incomeAccountId, taxCodeId, opts = {}) {
  const key = sku || name; const m = await mapGet('item', key); if (m) return m;
  let res = sku ? await api.query("select Id, Name, Sku from Item where Sku = '" + q(sku) + "' maxresults 1") : {};
  if (res.Item && res.Item[0]) return mapSet('item', key, res.Item[0].Id, res.Item[0].Name, true);
  res = await api.query("select Id, Name, Sku from Item where Name = '" + q(String(name).slice(0, 100)) + "' maxresults 1");
  if (res.Item && res.Item[0]) return mapSet('item', key, res.Item[0].Id, res.Item[0].Name, false, [{ id: res.Item[0].Id, name: res.Item[0].Name, sku: res.Item[0].Sku || '' }]);
  if (opts.create === false) return null;                                   // preview: report, don't create
  if (!incomeAccountId) throw new Error('No QBO item for ' + key + ' and no income account chosen to create one (QuickBooks sync → Settings).');
  const body = { Name: String(name || sku).slice(0, 100), Type: 'NonInventory', IncomeAccountRef: { value: String(incomeAccountId) }, Taxable: true };
  if (sku) body.Sku = String(sku).slice(0, 100);
  if (taxCodeId) body.SalesTaxCodeRef = { value: String(taxCodeId) };
  const c = await api.post('item', body);
  return mapSet('item', key, c.Item.Id, c.Item.Name, true);
}
// Class (specialist) and Department/Location (team): created by name when tracking is on
async function ensureNamed(api, kind, entity, listKey, name, opts = {}) {
  const m = await mapGet(kind, name); if (m) return m;
  const res = await api.query('select Id, Name from ' + entity + " where Name = '" + q(name) + "' maxresults 1");
  if (res[listKey] && res[listKey][0]) return mapSet(kind, name, res[listKey][0].Id, res[listKey][0].Name, true);
  if (opts.create === false) return null;
  const c = await api.post(entity.toLowerCase(), { Name: String(name).slice(0, 100) });
  return mapSet(kind, name, c[listKey].Id, c[listKey].Name, true);
}
export const ensureClass = (api, name, opts) => ensureNamed(api, 'class', 'Class', 'Class', name, opts);
export const ensureDepartment = (api, name, opts) => ensureNamed(api, 'department', 'Department', 'Department', name, opts);

// ── Documents ────────────────────────────────────────────────────────────────
// The invoice for an HQ order. lines: [{sku,name,qty,price,amount,is_free,deal}] in pesos, VAT-inclusive.
export function buildInvoice(order, lines, refs, cfg) {
  const L = lines.map(l => {
    const amt = round2(+l.amount || 0);
    const d = { DetailType: 'SalesItemLineDetail', Amount: amt, Description: [l.name, l.deal ? '(' + l.deal + ')' : '', l.is_free || amt === 0 ? '— free' : ''].filter(Boolean).join(' ').slice(0, 4000),
      SalesItemLineDetail: { ItemRef: { value: String(refs.items[l.sku || l.name]) }, Qty: +l.qty || 1, UnitPrice: round2((+l.qty ? amt / +l.qty : amt)) } };
    if (cfg.taxCode) d.SalesItemLineDetail.TaxCodeRef = { value: String(cfg.taxCode) };
    if (refs.classId) d.SalesItemLineDetail.ClassRef = { value: String(refs.classId) };
    return d;
  });
  const inv = { CustomerRef: { value: String(refs.customerId) }, TxnDate: order.date, DocNumber: String(order.label || '').slice(0, 21), Line: L,
    PrivateNote: ['HQ ' + (order.label || ''), order.dr_no ? 'DR ' + order.dr_no : '', order.spec ? 'PS ' + order.spec : ''].filter(Boolean).join(' · ').slice(0, 4000) };
  if (cfg.taxCode) inv.GlobalTaxCalculation = 'TaxInclusive';
  if (order.terms_days != null && order.terms_days >= 0) inv.DueDate = addDays(order.date, order.terms_days);
  if (refs.departmentId) inv.DepartmentRef = { value: String(refs.departmentId) };
  if (order.notes) inv.CustomerMemo = { value: String(order.notes).slice(0, 1000) };
  return inv;
}
// A payment applied to one invoice. Negative HQ payments (corrections) are not posted — they are logged as 'skipped'.
export function buildPayment(p, customerId, invoiceQboId, cfg) {
  const body = { CustomerRef: { value: String(customerId) }, TotalAmt: round2(+p.amount), TxnDate: p.date, PaymentRefNum: String(p.ref || p.method || ('HQ payment ' + p.id)).slice(0, 21),
    PrivateNote: ('HQ payment #' + p.id + (p.method ? ' · ' + p.method : '') + (p.note ? ' · ' + p.note : '')).slice(0, 4000),
    Line: [{ Amount: round2(+p.amount), LinkedTxn: [{ TxnId: String(invoiceQboId), TxnType: 'Invoice' }] }] };
  if (cfg.depositAccount) body.DepositToAccountRef = { value: String(cfg.depositAccount) };
  if (cfg.payMethodId) body.PaymentMethodRef = { value: String(cfg.payMethodId) };
  return body;
}
// A credit memo for an HQ return (one line, the CM amount, on the configured returns item)
export function buildCreditMemo(cm, customerId, itemId, cfg, label) {
  const amt = round2(+cm.amount);
  const line = { DetailType: 'SalesItemLineDetail', Amount: amt, Description: ('HQ ' + label + (cm.reason ? ' — ' + cm.reason : '') + (cm.items ? ' · ' + cm.items : '')).slice(0, 4000), SalesItemLineDetail: { ItemRef: { value: String(itemId) }, Qty: 1, UnitPrice: amt } };
  if (cfg.taxCode) line.SalesItemLineDetail.TaxCodeRef = { value: String(cfg.taxCode) };
  const body = { CustomerRef: { value: String(customerId) }, TxnDate: cm.date, DocNumber: String(label).slice(0, 21), Line: [line], PrivateNote: ('HQ credit memo ' + label + (cm.order_ref ? ' for ' + cm.order_ref : '')).slice(0, 4000) };
  if (cfg.taxCode) body.GlobalTaxCalculation = 'TaxInclusive';
  return body;
}
// Applying a credit memo to an invoice = a zero-amount Payment linking both
export function buildCreditApplication(customerId, invoiceQboId, creditMemoQboId, amount, date) {
  return { CustomerRef: { value: String(customerId) }, TotalAmt: 0, TxnDate: date,
    Line: [{ Amount: round2(+amount), LinkedTxn: [{ TxnId: String(invoiceQboId), TxnType: 'Invoice' }, { TxnId: String(creditMemoQboId), TxnType: 'CreditMemo' }] }] };
}
export async function postInvoice(api, body) { const j = await api.post('invoice', body); return j.Invoice; }
export async function updateInvoice(api, body, id, syncToken) { const j = await api.post('invoice', Object.assign({}, body, { Id: String(id), SyncToken: String(syncToken), sparse: false })); return j.Invoice; }
export async function voidInvoice(api, id, syncToken) { const j = await api.post('invoice?operation=void', { Id: String(id), SyncToken: String(syncToken) }); return j.Invoice; }
export async function postPayment(api, body) { const j = await api.post('payment', body); return j.Payment; }
export async function postCreditMemo(api, body) { const j = await api.post('creditmemo', body); return j.CreditMemo; }
export async function readInvoice(api, id) { const j = await api.get('invoice/' + encodeURIComponent(id)); return j.Invoice; }

// ── Payments recorded in QuickBooks → HQ (change data capture) ──────────────
// Returns every Payment changed since `since` (ISO) that is applied to at least one
// of OUR invoices, with the linked invoice ids so the caller can map them back.
export async function changedPayments(api, since) {
  const j = await api.get('cdc?entities=Payment&changedSince=' + encodeURIComponent(since));
  const out = [];
  for (const block of (j.CDCResponse || [])) for (const qr of (block.QueryResponse || [])) for (const p of (qr.Payment || [])) {
    if (p.status === 'Deleted') { out.push({ id: p.Id, deleted: true }); continue; }
    const links = [];
    for (const L of (p.Line || [])) for (const t of (L.LinkedTxn || [])) if (t.TxnType === 'Invoice') links.push({ invoiceId: t.TxnId, amount: +L.Amount || 0 });
    out.push({ id: p.Id, total: +p.TotalAmt || 0, date: p.TxnDate, ref: p.PaymentRefNum || '', method: (p.PaymentMethodRef && p.PaymentMethodRef.name) || '', note: p.PrivateNote || '', links, customerId: p.CustomerRef && p.CustomerRef.value });
  }
  return out;
}

// ── small helpers ────────────────────────────────────────────────────────────
export function round2(n) { return Math.round((+n || 0) * 100) / 100; }
export function addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + (+n || 0)); return d.toISOString().slice(0, 10); }
export function fingerprint(obj) { // stable hash of what we send, so an unchanged order is never re-posted
  const s = JSON.stringify(obj, Object.keys(flat(obj)).sort());
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16);
  function flat(o, acc = {}) { if (o && typeof o === 'object') for (const k in o) { acc[k] = 1; flat(o[k], acc); } return acc; }
}
export function docLabel(fmt, kind, n) { // mirrors docNo() in js/01: prefix + (offset + n), zero-padded
  const f = (fmt && fmt[kind]) || { order: { prefix: 'HS-', pad: 0, offset_no: 1000 }, cm: { prefix: 'CM-', pad: 0, offset_no: 1000 } }[kind] || { prefix: '', pad: 0, offset_no: 0 };
  let num = String((f.offset_no || 0) + Number(n || 0)); if (f.pad > 0) while (num.length < f.pad) num = '0' + num; return (f.prefix || '') + num;
}
