// QuickBooks mapping — Sean's rules, as one pure module. No network, no Supabase:
// it takes a NORMALISED order and returns the QuickBooks documents that order must
// become, plus the total QuickBooks will compute for them. The sync pass
// (qbo-sync.mjs) feeds it orders, the reconciliation (qbo-reconcile) feeds it the
// same orders to predict what the old Shopify connector posted, and the tests feed
// it that connector's own fixtures so the two produce identical documents.
//
// The rules (HEALTHSPAN GLOBAL INC, decided with finance — see PROFILE in the Claude
// project and docs/inhouse/QBO-INTEGRATION-GUIDE.md of the Shopify connector):
//   · invoice at ORDER CREATION, DocNumber = the order's printed number (HS-… / HG-…)
//   · VAT-inclusive: per line TaxInclusiveAmt = gross, Amount = net, NEVER UnitPrice
//     (a 2-dp rate × qty rarely equals the amount — QBO error 6070); tax code 11 on VAT
//     lines, 10 ("No VAT") on exempt lines (Termosalud, Mark-Vu, Line-Vu, GTG) and on
//     shipping/adjustments that were not taxed
//   · class "Sales" on the header and on every line
//   · discounts as list price + ONE QuickBooks Discount row (a clean percentage when it
//     is one), falling back to per-line negative Discount lines when the order mixes VAT
//     and exempt lines or carries shipping/tip — the only case QBO's prorating is wrong
//   · strict totals: refuse when the predicted total differs from the order's by > 2 centavos
//   · terms: Shopify's own terms when present ("Due on receipt" honoured), else 30 days
//   · a cancelled unpaid order is voided only in the SAME Manila month as its invoice
//   · "Anonymous" for a walk-in with no company, name or e-mail

export const DEFAULTS = {
  taxCode: '11', nonTaxCode: '10', classId: '', vatRate: 0.12, taxInclusive: true,
  discountStyle: 'native',            // native | line | net
  termsDays: 30, tolerance: 0.02, strictTotals: true,
  anonymousName: 'Anonymous', timezone: 'Asia/Manila',
  discountItemName: 'Discount', shippingItemName: 'Shopify Shipping', adjustmentItemName: 'Shopify Adjustment'
};
export const EXEMPT_RE = /termosalud|symmed|zionic|mark[\s-]?vu|line[\s-]?vu|\bgtg\b/i; // product lines sold without VAT
export const INTERNAL_RE = /pull-?out|healthspan|remedy/i;                              // never a sale
export const TEST_RE = /\btest\b|dummy|sample/i;

export const money = v => Math.round((Number(v) || 0) * 100) / 100;
const s2 = v => money(v).toFixed(2);

// ── Normalised order ──────────────────────────────────────────────────────────
// { source, docNumber, ref, date (YYYY-MM-DD Manila), createdAt, cancelledAt, status,
//   customer: { key, company, first, last, email, name }, email, note, currency,
//   lines: [{ key, sku, name, qty, listUnit, discount, taxable, rate }]  (money = VAT-inclusive)
//   shipping: [{ title, amount, taxed, rate }], tip, duties,
//   totals: { total, tax, discounts }, terms: { dueAt, onReceipt, days } }

// From HQ's own tables. items: sku → { line, price } (the catalog, for the list price and the VAT line)
export function normalizeNative(order, lines, items = {}, fmt) {
  const docNumber = order.label || docLabel(fmt, 'order', order.num);
  const L = lines.map((l, i) => {
    const it = items[l.sku] || {};
    const qty = Number(l.qty) || 1;
    const amount = money(l.amount);
    // list price: the catalog's (a ₱0 deal or free line then shows as a 100 % discount), never below what
    // was actually charged (a price rise the catalog has not caught up with is not a negative discount);
    // no catalog row → the line's own unit price and no discount
    const soldUnit = money(l.price != null && l.price !== '' ? l.price : (qty ? amount / qty : amount));
    const listUnit = it.price != null && it.price !== '' ? Math.max(money(it.price), soldUnit) : soldUnit;
    const listed = money(listUnit * qty);
    const discount = money(Math.max(0, listed - amount));
    return { key: l.sku || l.name, sku: l.sku || '', name: l.name || l.sku, qty, listUnit, discount, taxable: !EXEMPT_RE.test(it.line || l.name || ''), rate: DEFAULTS.vatRate, deal: l.deal || null, isFree: !!l.is_free, id: l.id || i };
  });
  const total = money(L.reduce((s, l) => s + money(l.listUnit * l.qty) - l.discount, 0));
  const discounts = money(L.reduce((s, l) => s + l.discount, 0));
  const tax = money(L.filter(l => l.taxable).reduce((s, l) => s + vatIn(money(l.listUnit * l.qty) - l.discount, l.rate), 0));
  return {
    source: 'native', docNumber, ref: order.id, date: order.date, createdAt: order.created_at || order.date, cancelledAt: order.status === 'cancelled' ? (order.cancelled_at || null) : null, status: order.status,
    customer: { key: order.account, company: order.account, name: order.account }, email: order.email || '', note: order.notes || order.order_note || '', currency: 'PHP',
    lines: L, shipping: [], tip: 0, duties: 0, totals: { total, tax, discounts }, terms: { days: order.terms_days != null && order.terms_days >= 0 ? Number(order.terms_days) : null },
    extra: { dr_no: order.dr_no, spec: order.spec }
  };
}

// From a Shopify order in the connector's ORDER-CONTRACT shape (REST field names). This is
// what backfill-background stores in orders.qbo_src, and what the old connector consumed.
export function normalizeShopify(o, opts = {}) {
  const tz = opts.timezone || DEFAULTS.timezone;
  const c = o.customer || null;
  const company = String((o.company && o.company.name) || (o.billing_address && o.billing_address.company) || (c && c.default_address && c.default_address.company) || '').trim();
  const first = c && c.first_name || '', last = c && c.last_name || '', email = (c && c.email) || o.email || '';
  const anonymous = !(c && c.id) && !company && !email && !first && !last;
  const edited = isEdited(o);
  const L = [];
  for (const li of (o.line_items || [])) {
    const qty = editedQty(li, o); if (qty <= 0) continue;
    let allocated = money((li.discount_allocations || []).reduce((s, d) => s + Number(d.amount || 0), 0));
    const title = li.variant_title && li.variant_title !== 'Default Title' ? li.title + ' - ' + li.variant_title : li.title;
    L.push({ key: li.variant_id != null && li.variant_id !== '' ? String(li.variant_id) : (li.sku ? 'sku:' + li.sku : 'name:' + String(title || 'unknown').slice(0, 100)), sku: li.sku || '', name: title, qty, origQty: Number(li.quantity) || qty, listUnit: money(li.price), discount: allocated, taxable: lineIsTaxed(li), rate: lineRate(li), id: li.id });
  }
  const shipping = (o.shipping_lines || []).map(l => ({ title: l.title || 'Shipping', amount: money(l.price), taxed: (l.tax_lines || []).some(t => Number(t.price || 0) > 0), rate: lineRate({ tax_lines: l.tax_lines || [] }) }));
  const totals = invoiceTotals(o);
  const terms = o.payment_terms || null;
  return {
    source: 'shopify', docNumber: String(o.name || o.id).replace('#', '').slice(0, 21), ref: o.id, date: dateInTz(o.created_at, tz), createdAt: o.created_at, cancelledAt: o.cancelled_at || null,
    status: o.cancelled_at ? 'cancelled' : 'pending', financialStatus: o.financial_status || '',
    customer: { key: anonymous ? 'guest:anonymous' : (c && c.id != null ? String(c.id) : 'guest:' + String(o.email || o.id || '').toLowerCase()), company, first, last, email, anonymous, phone: c && c.phone || '' },
    email, note: o.note || '', currency: o.currency || 'PHP', taxesIncluded: o.taxes_included !== false,
    lines: L, shipping, tip: money(o.total_tip_received), duties: money(o.total_duties != null ? o.total_duties : o.current_total_duties), totals, edited,
    terms: terms ? { dueAt: terms.payment_schedules && terms.payment_schedules[0] && terms.payment_schedules[0].due_at || null, onReceipt: terms.payment_terms_type === 'RECEIPT' || /due on receipt/i.test(terms.payment_terms_name || ''), days: Number(terms.due_in_days) > 0 ? Number(terms.due_in_days) : null, name: terms.payment_terms_name || '' } : { },
    discountCodes: (o.discount_codes || []).map(d => d.code).filter(Boolean)
  };
}

// ── Shopify order-edit arithmetic (mirrors the connector) ─────────────────────
function refundedQty(li, o) { return (o.refunds || []).reduce((s, r) => s + (r.refund_line_items || []).filter(x => x.line_item_id === li.id).reduce((q, x) => q + Number(x.quantity || 0), 0), 0); }
function editedQty(li, o) { if (li.current_quantity === undefined || li.current_quantity === null) return Number(li.quantity) || 0; return Number(li.current_quantity) + refundedQty(li, o); }
export function isEdited(o) { return (o.line_items || []).some(li => editedQty(li, o) !== (Number(li.quantity) || 0)); }
function refundedMoney(o) { return money((o.refunds || []).reduce((s, r) => s + (r.transactions || []).filter(t => t.kind === 'refund' && (t.status || 'success') === 'success').reduce((a, t) => a + Number(t.amount || 0), 0), 0)); }
function refundedTax(o) { return money((o.refunds || []).reduce((s, r) => s + (r.refund_line_items || []).reduce((a, x) => a + Number(x.total_tax || 0), 0), 0)); }
export function invoiceTotals(o) {
  if (!isEdited(o) || o.current_total_price === undefined || o.current_total_price === null) return { total: money(o.total_price), tax: money(o.total_tax), discounts: money(o.total_discounts), edited: false };
  return { total: money(Number(o.current_total_price) + refundedMoney(o)), tax: money(Number(o.current_total_tax != null ? o.current_total_tax : o.total_tax) + refundedTax(o)), discounts: money(o.current_total_discounts != null ? o.current_total_discounts : o.total_discounts), edited: true };
}
function lineIsTaxed(li) { if (li.taxable === false) return false; if (Array.isArray(li.tax_lines)) return li.tax_lines.reduce((s, t) => s + Number(t.price || 0), 0) > 0; return true; }
function lineRate(li) { const r = Number(((li.tax_lines || []).find(t => Number(t.rate) > 0) || {}).rate); return Number.isFinite(r) && r > 0 ? r : DEFAULTS.vatRate; }

// ── Customer ──────────────────────────────────────────────────────────────────
// Native orders: the HQ account (the clinic). Shopify orders: the company on the order,
// else "First Last (email)", else Anonymous — the same name the old connector used, so
// QuickBooks does not grow a second customer for every clinic at cutover.
export function customerName(n, cfg = DEFAULTS) {
  const c = n.customer || {};
  if (n.source !== 'shopify') return String(c.name || c.company || '').slice(0, 100);
  if (c.anonymous) return cfg.anonymousName || DEFAULTS.anonymousName;
  if (c.company) return c.company.slice(0, 100);
  const name = [c.first, c.last].filter(Boolean).join(' ').trim();
  if (name && c.email) return (name + ' (' + c.email + ')').slice(0, 100);
  return (name || c.email || ('Shopify Customer ' + (c.key || n.ref))).slice(0, 100);
}

// ── Money helpers ─────────────────────────────────────────────────────────────
export const vatIn = (gross, rate = DEFAULTS.vatRate) => money(gross - gross / (1 + rate));          // VAT inside a VAT-inclusive amount
function grossAndNet(amount, n, rate, taxable, cfg) {
  const a = money(amount);
  if (!taxable) return { gross: a, net: a };
  if (n.taxesIncluded !== false) return { gross: a, net: money(a / (1 + rate)) };
  return { gross: money(a * (1 + rate)), net: a };
}
function itemLine({ itemKey, description, qty, gross, net, taxable, cfg }) {
  const detail = { ItemRef: { value: itemKey }, Qty: Number(qty) || 1, TaxCodeRef: { value: taxable ? String(cfg.taxCode) : String(cfg.nonTaxCode) } };
  if (cfg.classId) detail.ClassRef = { value: String(cfg.classId) };
  if (taxable && cfg.taxInclusive !== false) { detail.TaxInclusiveAmt = gross; return { DetailType: 'SalesItemLineDetail', Amount: net, Description: String(description || '').slice(0, 4000), SalesItemLineDetail: detail }; }
  return { DetailType: 'SalesItemLineDetail', Amount: taxable ? net : gross, Description: String(description || '').slice(0, 4000), SalesItemLineDetail: detail };
}
const lineGross = l => money(l.SalesItemLineDetail && l.SalesItemLineDetail.TaxInclusiveAmt != null ? l.SalesItemLineDetail.TaxInclusiveAmt : l.Amount);
// what QuickBooks will show as the document total for these lines
export function documentTotal(lines, cfg = DEFAULTS) {
  const inclusive = cfg.taxInclusive !== false;
  return money(lines.reduce((s, l) => l.DetailType === 'DiscountLineDetail' ? s - (inclusive ? money(l.__gross != null ? l.__gross : l.Amount) : money(l.__net != null ? l.__net : l.Amount)) : s + (inclusive ? lineGross(l) : money(l.Amount)), 0));
}

// native discount row is exact only when every product line shares one VAT treatment and nothing else sits on the invoice
export function discountStyleFor(n, cfg = DEFAULTS) {
  const style = cfg.discountStyle || 'native'; if (style !== 'native') return style;
  const taxed = new Set(n.lines.map(l => !!l.taxable));
  const ship = money((n.shipping || []).reduce((s, l) => s + l.amount, 0));
  return taxed.size <= 1 && ship === 0 && money(n.tip) === 0 ? 'native' : 'line';
}
const discountLabel = n => n.discountCodes && n.discountCodes.length ? ' — ' + n.discountCodes.join(', ') : '';

function productLines(n, cfg, { scaleDiscount, style }) {
  const lines = []; let embedded = 0, listTotal = 0, anyTaxed = false, rateSeen = cfg.vatRate || DEFAULTS.vatRate;
  for (const l of n.lines) {
    const qty = l.qty; if (qty <= 0) continue;
    const taxable = !!l.taxable; const rate = l.rate || cfg.vatRate || DEFAULTS.vatRate; if (taxable) { anyTaxed = true; rateSeen = rate; }
    let allocated = money(l.discount);
    if (scaleDiscount && l.origQty && qty !== l.origQty && l.origQty > 0) allocated = money(allocated * qty / l.origQty);
    const listed = money(l.listUnit * qty); listTotal = money(listTotal + listed);
    const title = l.name + (l.deal ? ' (' + l.deal + ')' : '');
    if (style === 'native' || (style === 'line' && allocated > 0)) {
      const g1 = grossAndNet(listed, n, rate, taxable, cfg);
      lines.push(itemLine({ itemKey: l.key, description: title, qty, gross: g1.gross, net: g1.net, taxable, cfg }));
      if (style === 'line') {
        const g2 = grossAndNet(allocated, n, rate, taxable, cfg);
        lines.push(itemLine({ itemKey: 'special:discount', description: 'Discount' + discountLabel(n) + ' — ' + title, qty: 1, gross: money(-g2.gross), net: money(-g2.net), taxable, cfg }));
        embedded = money(embedded + allocated);
      }
      continue;
    }
    const { gross, net } = grossAndNet(money(listed - allocated), n, rate, taxable, cfg);
    lines.push(itemLine({ itemKey: l.key, description: allocated > 0 ? title + ' (list ' + s2(listed) + ' less discount ' + s2(allocated) + discountLabel(n) + ')' : title, qty, gross, net, taxable, cfg }));
    embedded = money(embedded + allocated);
  }
  return { lines, embedded, listTotal, anyTaxed, rate: rateSeen };
}
function discountRow({ gross, listTotal, n, rate, taxable, cfg, asPercent }) {
  const { net } = grossAndNet(gross, n, rate, taxable, cfg);
  const detail = { TaxCodeRef: { value: taxable ? String(cfg.taxCode) : String(cfg.nonTaxCode) } }; if (cfg.classId) detail.ClassRef = { value: String(cfg.classId) };
  const pct = listTotal > 0 ? Math.round(gross / listTotal * 10000) / 100 : 0;
  const line = asPercent && pct > 0 && money(listTotal * pct / 100) === money(gross)
    ? { DetailType: 'DiscountLineDetail', DiscountLineDetail: Object.assign({}, detail, { PercentBased: true, DiscountPercent: pct }) }
    : { DetailType: 'DiscountLineDetail', Amount: net, DiscountLineDetail: Object.assign({}, detail, { PercentBased: false }) };
  Object.defineProperty(line, '__gross', { value: money(gross), enumerable: false }); Object.defineProperty(line, '__net', { value: net, enumerable: false });
  return line;
}
function finishLines(n, built, cfg, style, { probe }) {
  const lines = built.lines.slice();
  for (const sh of (n.shipping || [])) if (sh.amount > 0) { const { gross, net } = grossAndNet(sh.amount, n, sh.rate, sh.taxed, cfg); lines.push(itemLine({ itemKey: 'special:shipping', description: sh.title || 'Shipping', qty: 1, gross, net, taxable: sh.taxed, cfg })); }
  const discount = money(n.totals.discounts - built.embedded);
  if (discount > 0.005) lines.push(discountRow({ gross: discount, listTotal: built.listTotal, n, rate: built.rate, taxable: built.anyTaxed, cfg, asPercent: style === 'native' }));
  const target = n.totals.total; const residual = money(target - documentTotal(lines, cfg)); const tol = cfg.tolerance != null ? cfg.tolerance : DEFAULTS.tolerance;
  let mismatch = null;
  if (Math.abs(residual) > tol) {
    const explained = money(Number(n.tip || 0) + Number(n.duties || 0));
    if (Math.abs(money(residual - explained)) > tol) { if (probe) return { lines, total: documentTotal(lines, cfg) }; mismatch = { expected: target, got: documentTotal(lines, cfg), residual }; }
    else lines.push(itemLine({ itemKey: 'special:adjustment', description: 'Shopify adjustment (tip / duty / rounding)', qty: 1, gross: residual, net: residual, taxable: false, cfg }));
  }
  return { lines, total: documentTotal(lines, cfg), mismatch };
}

// ── The plan: lines with item KEYS, the predicted total, and what must exist in QBO ─
// The caller resolves every `needs` key to a QuickBooks item id, then calls renderInvoice.
export function planInvoice(n, cfgIn = {}) {
  const cfg = Object.assign({}, DEFAULTS, cfgIn);
  const style = discountStyleFor(n, cfg);
  let built = productLines(n, cfg, { scaleDiscount: !!n.edited, style });
  let fin = finishLines(n, built, cfg, style, { probe: !!n.edited });
  if (n.edited && Math.abs(money(fin.total - n.totals.total)) > (cfg.tolerance != null ? cfg.tolerance : DEFAULTS.tolerance)) {
    const alt = productLines(n, cfg, { scaleDiscount: false, style }); const altFin = finishLines(n, alt, cfg, style, { probe: true });
    if (Math.abs(money(altFin.total - n.totals.total)) < Math.abs(money(fin.total - n.totals.total))) built = alt;
    fin = finishLines(n, built, cfg, style, { probe: false });
  }
  const needs = []; for (const l of fin.lines) { const k = l.SalesItemLineDetail && l.SalesItemLineDetail.ItemRef && l.SalesItemLineDetail.ItemRef.value; if (k && !needs.includes(k)) needs.push(k); }
  const vat = money(fin.lines.reduce((s, l) => s + (l.DetailType === 'SalesItemLineDetail' && l.SalesItemLineDetail.TaxInclusiveAmt != null ? money(lineGross(l) - l.Amount) : l.DetailType === 'DiscountLineDetail' && l.DiscountLineDetail.TaxCodeRef && String(l.DiscountLineDetail.TaxCodeRef.value) === String(cfg.taxCode) && l.__gross != null ? -money(l.__gross - l.__net) : 0), 0));
  const plan = { lines: fin.lines, total: fin.total, vat, style, needs, mismatch: fin.mismatch, docNumber: n.docNumber, customerName: customerName(n, cfg), dueDate: dueDate(n, cfg), classId: cfg.classId || '' };
  if (fin.mismatch && cfg.strictTotals !== false) { const e = new Error('Invoice total mismatch for ' + n.docNumber + ': order ' + s2(fin.mismatch.expected) + ' vs QuickBooks ' + s2(fin.mismatch.got)); e.plan = plan; e.code = 'TOTALS'; throw e; }
  return plan;
}
// resolve keys → ids and produce the request body. refs: { customerId, items: { key → qboId } }
export function renderInvoice(n, plan, refs, cfgIn = {}) {
  const cfg = Object.assign({}, DEFAULTS, cfgIn);
  const Line = plan.lines.map(l => {
    const c = JSON.parse(JSON.stringify(l));
    if (c.SalesItemLineDetail) { const k = c.SalesItemLineDetail.ItemRef.value; const id = refs.items && refs.items[k]; if (!id) throw new Error('No QuickBooks item for ' + k); c.SalesItemLineDetail.ItemRef = { value: String(id) }; }
    return c;
  });
  const body = {
    CustomerRef: { value: String(refs.customerId) }, DocNumber: plan.docNumber, TxnDate: n.date, DueDate: plan.dueDate,
    PrivateNote: privateNote(n).slice(0, 4000), Line, GlobalTaxCalculation: cfg.taxInclusive !== false ? 'TaxInclusive' : 'TaxExcluded'
  };
  if (n.note) body.CustomerMemo = { value: String(n.note).slice(0, 1000) };
  if (n.email) body.BillEmail = { Address: String(n.email).slice(0, 100) };
  if (n.currency) body.CurrencyRef = { value: n.currency };
  if (cfg.classId) body.ClassRef = { value: String(cfg.classId) };
  return body;
}
function privateNote(n) {
  if (n.source === 'shopify') return 'Shopify order ' + (n.docNumber.startsWith('#') ? n.docNumber : '#' + n.docNumber) + ' (id ' + n.ref + '); status ' + (n.financialStatus || '') + (n.terms && n.terms.name ? '; terms ' + n.terms.name : '') + ' · via HQ';
  return ['HQ ' + n.docNumber, n.extra && n.extra.dr_no ? 'DR ' + n.extra.dr_no : '', n.extra && n.extra.spec ? 'PS ' + n.extra.spec : ''].filter(Boolean).join(' · ');
}
export function dueDate(n, cfg = DEFAULTS) {
  const t = n.terms || {};
  if (t.dueAt) return String(t.dueAt).slice(0, 10);
  if (t.onReceipt) return n.date;
  if (t.days != null && t.days >= 0 && Number.isFinite(Number(t.days))) return addDays(n.date, Number(t.days));
  return addDays(n.date, cfg.termsDays != null ? cfg.termsDays : DEFAULTS.termsDays);
}

// ── Compare a plan with an invoice QuickBooks holds (the reconciliation) ─────
// Returns [] when they agree; otherwise one entry per field that differs.
export function diffInvoice(plan, inv, cfg = DEFAULTS, opts = {}) {
  const out = []; const tol = cfg.tolerance != null ? cfg.tolerance : DEFAULTS.tolerance;
  if (!inv) return [{ field: 'invoice', ours: plan.docNumber, theirs: 'not in QuickBooks' }];
  if (String(inv.DocNumber || '') !== String(plan.docNumber)) out.push({ field: 'DocNumber', ours: plan.docNumber, theirs: inv.DocNumber });
  if (Math.abs(money(inv.TotalAmt) - plan.total) > tol) out.push({ field: 'total', ours: plan.total, theirs: money(inv.TotalAmt) });
  const theirVat = inv.TxnTaxDetail && inv.TxnTaxDetail.TotalTax != null ? money(inv.TxnTaxDetail.TotalTax) : null;
  if (theirVat != null && Math.abs(theirVat - plan.vat) > 0.05) out.push({ field: 'VAT', ours: plan.vat, theirs: theirVat });
  if (plan.classId) { const lines = (inv.Line || []).filter(l => l.DetailType === 'SalesItemLineDetail'); const off = lines.filter(l => !(l.SalesItemLineDetail && l.SalesItemLineDetail.ClassRef && String(l.SalesItemLineDetail.ClassRef.value) === String(plan.classId))); if (off.length) out.push({ field: 'class', ours: plan.classId, theirs: off.length + ' line(s) without class ' + plan.classId }); }
  const theirCust = inv.CustomerRef && (inv.CustomerRef.name || inv.CustomerRef.value) || '';
  const sameCustomer = opts.customerId && inv.CustomerRef && String(inv.CustomerRef.value) === String(opts.customerId); // the customer HQ's mapping (e-mail / confirmed match) resolves to
  if (!sameCustomer && theirCust && plan.customerName && norm(theirCust) !== norm(plan.customerName)) out.push({ field: 'customer', ours: plan.customerName, theirs: theirCust });
  if (inv.DueDate && plan.dueDate && String(inv.DueDate).slice(0, 10) !== plan.dueDate) out.push({ field: 'due date', ours: plan.dueDate, theirs: String(inv.DueDate).slice(0, 10) });
  const ourItems = plan.lines.filter(l => l.DetailType === 'SalesItemLineDetail').length, theirItems = (inv.Line || []).filter(l => l.DetailType === 'SalesItemLineDetail').length;
  if (ourItems !== theirItems) out.push({ field: 'lines', ours: ourItems, theirs: theirItems });
  const ourDisc = plan.lines.some(l => l.DetailType === 'DiscountLineDetail'), theirDisc = (inv.Line || []).some(l => l.DetailType === 'DiscountLineDetail');
  if (ourDisc !== theirDisc) out.push({ field: 'discount row', ours: ourDisc ? 'yes' : 'no', theirs: theirDisc ? 'yes' : 'no' });
  return out;
}

// ── Dates ─────────────────────────────────────────────────────────────────────
export function dateInTz(iso, tz = DEFAULTS.timezone) {
  if (!iso) return '';
  const s = String(iso); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s); if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d); const g = t => (p.find(x => x.type === t) || {}).value;
  return g('year') + '-' + g('month') + '-' + g('day');
}
export const monthKey = (v, tz) => dateInTz(v, tz).slice(0, 7);
export function sameMonth(a, b, tz = DEFAULTS.timezone) { return !!a && !!b && monthKey(a, tz) === monthKey(b, tz); }
export function addDays(ymd, n) { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + (Number(n) || 0)); return d.toISOString().slice(0, 10); }
export function docLabel(fmt, kind, n) {
  const f = (fmt && fmt[kind]) || { order: { prefix: 'HS-', pad: 0, offset_no: 1000 }, cm: { prefix: 'CM-', pad: 0, offset_no: 1000 } }[kind] || { prefix: '', pad: 0, offset_no: 0 };
  let num = String((f.offset_no || 0) + Number(n || 0)); if (f.pad > 0) while (num.length < f.pad) num = '0' + num; return (f.prefix || '') + num;
}
export const norm = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').replace(/\b(inc|corp|corporation|co|ltd|clinic|clinics|the)\b/g, '').replace(/\s+/g, ' ').trim();
