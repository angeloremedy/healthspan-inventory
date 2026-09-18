// The QuickBooks sync pass. Scan-based and idempotent: every run looks at what HQ
// has (orders, payments, credit memos) against what qbo_sync says is already in
// QuickBooks, and posts only the difference. No triggers, no queue — a run that
// dies halfway simply finishes the job next time.
//
//   pass 1  orders on/after qbo_post_from (native, or native + Shopify when
//           qbo_sources = all)                     → Invoice at ORDER CREATION (Sean's rule);
//                                                    update when the order changed; void when
//                                                    cancelled unpaid in the SAME Manila month
//   pass 2  credit memos (returns)                 → CreditMemo, applied to the invoice it names
//   pass 3  HQ payments on posted invoices         → Payment — ONLY when qbo_sync_payments = 1
//                                                    (off: Collections records payments in QBO by hand)
//   pass 4  payments recorded in QuickBooks        → HQ payments rows (CDC since the last cursor)
//
// The document itself comes from lib/qbo-map.mjs (list price + Discount row, tax codes
// 11/10, class Sales, TaxInclusiveAmt, strict totals) — the same mapping the old
// Shopify→QuickBooks connector used, so HQ can take over its invoices seamlessly.
// Shopify orders are posted from orders.qbo_src (the snapshot backfill-background keeps).
//
// PREVIEW MODE: while app_settings.qbo_enabled is not '1' the pass computes
// everything, writes the rows as 'pending' with the amount it would post, and
// posts nothing. Finance can see the whole first batch before the switch flips.
import { loadTokens, refreshIfNeeded, client, sb, setting, setSetting, ensureCustomer, ensureItem,
  buildPayment, buildCreditMemo, buildCreditApplication, postInvoice, updateInvoice, voidInvoice, deleteInvoice, readInvoice,
  postPayment, postCreditMemo, changedPayments, fingerprint, docLabel, round2 } from './qbo.mjs';
import { normalizeNative, normalizeShopify, planInvoice, renderInvoice, sameMonth, dateInTz, money, INTERNAL_RE, TEST_RE, DEFAULTS } from './qbo-map.mjs';

const MAX_PER_RUN = 150;      // invoices per pass — well inside the 15-minute background window
const MAX_ATTEMPTS = 5;       // an erroring row stops retrying until finance presses Retry
export const SPECIAL_ITEMS = { // the connector's three service items, found or created by SKU/name
  'special:discount': { sku: '', name: 'Discount', type: 'Service' },
  'special:shipping': { sku: 'SHOPIFY-SHIPPING', name: 'Shopify Shipping', type: 'NonInventory' },
  'special:adjustment': { sku: 'SHOPIFY-ADJUSTMENT', name: 'Shopify Adjustment', type: 'NonInventory' }
};

export async function cfgLoad() {
  const rows = await sb("app_settings?select=key,value&key=like.qbo_*");
  const c = {}; for (const r of rows) c[r.key] = r.value;
  return {
    enabled: c.qbo_enabled === '1', postFrom: c.qbo_post_from || '2099-01-01', postMode: c.qbo_post_mode === 'fulfilled' ? 'fulfilled' : 'created',
    taxCode: c.qbo_tax_code || DEFAULTS.taxCode, nonTaxCode: c.qbo_non_tax_code || DEFAULTS.nonTaxCode, classId: c.qbo_class_id || '',
    discountStyle: ['native', 'line', 'net'].includes(c.qbo_discount_style) ? c.qbo_discount_style : 'native', strictTotals: c.qbo_strict !== '0',
    depositAccount: c.qbo_deposit_account || '', incomeAccount: c.qbo_income_account || '',
    sources: c.qbo_sources || 'native', cdcSince: c.qbo_cdc_since || '', returnsItem: c.qbo_returns_item || '', requireConfirm: c.qbo_require_confirm !== '0',
    syncPayments: c.qbo_sync_payments === '1', termsDays: Number(c.qbo_terms_days) > 0 ? Number(c.qbo_terms_days) : DEFAULTS.termsDays, anonymousName: c.qbo_anonymous_name || DEFAULTS.anonymousName
  };
}
// the subset the mapper reads
export const mapCfg = cfg => ({ taxCode: cfg.taxCode, nonTaxCode: cfg.nonTaxCode, classId: cfg.classId, discountStyle: cfg.discountStyle, strictTotals: cfg.strictTotals, termsDays: cfg.termsDays, anonymousName: cfg.anonymousName });
async function docFormats() { try { const rows = await sb('doc_formats?select=kind,prefix,pad,offset_no'); const f = {}; for (const r of rows) f[r.kind] = r; return f; } catch (e) { return {}; } }
export async function catalog() { // sku → { line, price } for list prices and the VAT line of native orders
  try { const rows = await sb('items?select=sku,line,price&limit=5000'); const m = {}; for (const r of rows) m[r.sku] = { line: r.line || '', price: r.price }; return m; } catch (e) { return {}; }
}
async function syncRows(kind) { const rows = await sb('qbo_sync?select=*&kind=eq.' + encodeURIComponent(kind) + '&limit=5000'); const m = {}; for (const r of rows) m[r.hq_ref] = r; return m; }
async function upsertSync(row) { row.updated_at = new Date().toISOString(); return sb('qbo_sync?on_conflict=kind,hq_ref', 'POST', row); }
const errText = e => String((e && e.message) || e).slice(0, 900);

// One HQ order → the normalised order the mapper reads. Shopify orders need their snapshot.
export function normalizeOrder(o, lines, items, fmt) {
  if (o.source === 'shopify') { if (!o.qbo_src) return null; const n = normalizeShopify(typeof o.qbo_src === 'string' ? JSON.parse(o.qbo_src) : o.qbo_src); n.hqStatus = o.status; return n; }
  const n = normalizeNative(Object.assign({}, o, { label: docLabel(fmt, 'order', o.num) }), lines, items, fmt); n.hqStatus = o.status; return n;
}
// resolve every item key the plan needs → QuickBooks item id (preview: lookups only, report what is missing)
async function resolveItems(api, n, plan, cfg, live) {
  const info = {}; for (const l of n.lines) info[l.key] = { sku: l.sku, name: l.name }; Object.assign(info, SPECIAL_ITEMS);
  const items = {}, missing = [];
  for (const k of plan.needs) {
    const i = info[k] || { sku: '', name: k };
    const it = await ensureItem(api, i.sku, i.name, cfg.incomeAccount, i.type === 'Service' ? '' : cfg.taxCode, { create: live, type: i.type });
    if (it) items[k] = it.qbo_id; else { items[k] = 'new'; missing.push(i.sku || i.name); }
  }
  return { items, missing };
}
const isVoidedInv = inv => money(inv && inv.TotalAmt) === 0 && /void/i.test(String((inv && inv.PrivateNote) || ''));

export async function runSync(opts = {}) {
  const started = new Date();
  const S = { started: started.toISOString(), mode: 'preview', by: opts.by || 'schedule', invoices: { posted: 0, updated: 0, voided: 0, held: 0, errors: 0, preview: 0, skipped: 0 }, creditmemos: { posted: 0, errors: 0, preview: 0 }, payments: { posted: 0, skipped: 0, pulled: 0, errors: 0, preview: 0, off: false }, errors: [], ms: 0 };
  const finish = async () => { S.ms = Date.now() - started.getTime(); S.finished = new Date().toISOString(); try { await setSetting('qbo_last_run', JSON.stringify(S)); } catch (e) {} try { await setSetting('qbo_lock', ''); } catch (e) {} return S; };
  // one run at a time — a second trigger inside 12 minutes is ignored
  const lock = await setting('qbo_lock'); if (lock && Date.now() - Date.parse(lock) < 12 * 60 * 1000 && !opts.force) { S.errors.push('another sync is still running — skipped'); S.skipped = true; return S; }
  await setSetting('qbo_lock', started.toISOString());
  let api, cfg;
  try {
    cfg = await cfgLoad(); S.mode = cfg.enabled ? 'live' : 'preview';
    const tok = await refreshIfNeeded(await loadTokens()); api = client(tok); S.company = tok.company_name || tok.realm_id; S.env = tok.env;
  } catch (e) { S.errors.push(errText(e)); return finish(); }
  const live = cfg.enabled; const fmt = await docFormats(); const items = await catalog(); const mc = mapCfg(cfg);
  const refsCfg = { taxCode: cfg.taxCode, nonTaxCode: cfg.nonTaxCode, classId: cfg.classId, depositAccount: cfg.depositAccount };
  const today = dateInTz(started.toISOString());

  // ── pass 1: invoices ──────────────────────────────────────────────────────
  const invRows = await syncRows('invoice'); const invoiceByOrder = {}; // order_id → qbo invoice row (posted)
  for (const k in invRows) if (invRows[k].qbo_id && !['voided', 'skipped'].includes(invRows[k].status)) invoiceByOrder[k] = invRows[k];
  let orders = [];
  try {
    const src = cfg.sources === 'all' ? '' : '&source=eq.native';
    const when = cfg.postMode === 'fulfilled' ? '&fulfilled_at=gte.' + cfg.postFrom + 'T00:00:00&order=fulfilled_at.asc' : '&date=gte.' + cfg.postFrom + '&order=date.asc,num.asc';
    orders = await sb('orders?select=id,num,date,account,spec,status,total,terms_days,notes,order_note,dr_no,fulfilled_at,deleted_at,source,ext_ref,approved,qbo_src,created_at,updated_at&deleted_at=is.null&approved=is.true' + src + when + '&limit=' + (MAX_PER_RUN * 3));
  } catch (e) { S.errors.push('orders: ' + errText(e)); }
  let handled = 0;
  for (const o of orders) {
    if (handled >= MAX_PER_RUN) break;
    const ex = invRows[o.id]; const label = o.source === 'shopify' && o.ext_ref ? String(o.ext_ref).replace('#', '') : docLabel(fmt, 'order', o.num);
    const base = { kind: 'invoice', hq_ref: o.id, order_id: o.id, order_label: label };
    if (TEST_RE.test(o.account) || INTERNAL_RE.test(o.account)) { if (!ex) await upsertSync(Object.assign({}, base, { status: 'skipped', last_error: 'internal or test account — never a sale', amount: o.total })); continue; }
    if (ex && ex.status === 'error' && ex.attempts >= MAX_ATTEMPTS && !opts.force) continue;
    if (ex && ['voided', 'skipped'].includes(ex.status)) continue;
    if (cfg.postMode === 'fulfilled' && o.status === 'pending') continue;
    // ── cancelled: void in the same Manila month when unpaid; otherwise a person issues the credit note
    if (o.status === 'cancelled') {
      if (!(ex && ex.qbo_id)) { if (!ex || ex.status === 'pending') await upsertSync(Object.assign({}, base, { status: 'skipped', last_error: 'cancelled before it was posted', amount: 0 })); continue; }
      handled++;
      try {
        const cur = live ? await readInvoice(api, ex.qbo_id) : null;
        const cancelledAt = (o.qbo_src && (typeof o.qbo_src === 'string' ? JSON.parse(o.qbo_src) : o.qbo_src).cancelled_at) || o.updated_at || started.toISOString();
        const invDate = (cur && cur.TxnDate) || ex.posted_at || o.date;
        if (cur && isVoidedInv(cur)) { await upsertSync(Object.assign({}, base, { status: 'voided', qbo_id: ex.qbo_id, qbo_doc_no: ex.qbo_doc_no, last_error: 'already void in QuickBooks', amount: 0 })); S.invoices.voided++; continue; }
        if (cur && money(cur.Balance) !== money(cur.TotalAmt)) { await upsertSync(Object.assign({}, base, { status: 'skipped', qbo_id: ex.qbo_id, qbo_doc_no: ex.qbo_doc_no, last_error: 'cancelled but money was received — refund / credit note by hand in QuickBooks', amount: ex.amount })); S.invoices.skipped++; continue; }
        if (!sameMonth(invDate, cancelledAt)) { await upsertSync(Object.assign({}, base, { status: 'skipped', qbo_id: ex.qbo_id, qbo_doc_no: ex.qbo_doc_no, last_error: 'cancelled in a later month than its invoice (' + dateInTz(invDate).slice(0, 7) + ') — issue a credit note in QuickBooks; the invoice is not voided', amount: ex.amount })); S.invoices.skipped++; continue; }
        if (live) await voidInvoice(api, ex.qbo_id, cur.SyncToken);
        await upsertSync(Object.assign({}, base, { status: live ? 'voided' : 'pending', qbo_id: ex.qbo_id, qbo_doc_no: ex.qbo_doc_no, last_error: live ? null : 'would void (cancelled in the same month)', amount: 0 })); S.invoices.voided++;
      } catch (e) { S.invoices.errors++; S.errors.push(label + ': ' + errText(e)); await upsertSync(Object.assign({}, base, { status: 'error', qbo_id: ex.qbo_id, last_error: errText(e), attempts: (ex.attempts || 0) + 1 })); }
      continue;
    }
    handled++;
    let plan = null;
    try {
      const lines = o.source === 'shopify' ? [] : await sb('order_lines?select=id,sku,name,qty,price,amount,is_free,deal&order_id=eq.' + o.id + '&order=id.asc');
      const n = normalizeOrder(o, lines, items, fmt);
      if (!n) { await upsertSync(Object.assign({}, base, { status: 'pending', last_error: 'no Shopify snapshot for this order yet — the next import brings it', amount: o.total, attempts: ex ? ex.attempts : 0 })); S.invoices.held++; continue; }
      if (!n.lines.length) throw new Error('order has no lines');
      try { plan = planInvoice(n, mc); } catch (e) { if (e.code === 'TOTALS') { plan = e.plan; throw e; } throw e; }
      // preview never writes to QuickBooks: lookups only, and what is missing is reported instead of created
      const cust = await ensureCustomer(api, plan.customerName, { create: live, email: n.email });
      if (!cust) { S.invoices.preview++; await upsertSync(Object.assign({}, base, { status: 'pending', last_error: 'would post ' + money(plan.total).toFixed(2) + ' — and create the customer "' + plan.customerName + '" in QuickBooks', amount: plan.total, attempts: 0 })); continue; }
      if (cfg.requireConfirm && cust.confirmed === false) { S.invoices.held++; await upsertSync(Object.assign({}, base, { status: 'pending', last_error: 'customer match needs confirmation: ' + plan.customerName + ' → ' + (cust.qbo_name || cust.qbo_id), amount: plan.total, attempts: ex ? ex.attempts : 0 })); continue; }
      const { items: itemIds, missing } = await resolveItems(api, n, plan, cfg, live);
      const wouldCreate = missing.length ? ' — and create ' + missing.length + ' item' + (missing.length > 1 ? 's' : '') + ' (' + missing.slice(0, 4).join(', ') + (missing.length > 4 ? '…' : '') + ')' : '';
      const body = renderInvoice(n, plan, { customerId: cust.qbo_id, items: itemIds }, mc);
      const hash = fingerprint(body);
      if (ex && ex.qbo_id && !['voided', 'skipped'].includes(ex.status)) { // already in QuickBooks (even if the last attempt errored) → never post twice
        if (ex.hash === hash && ex.status !== 'error') continue;          // nothing changed
        if (!live) { S.invoices.preview++; await upsertSync(Object.assign({}, base, { status: ex.status, qbo_id: ex.qbo_id, qbo_doc_no: ex.qbo_doc_no, hash: ex.hash, amount: plan.total, last_error: 'would update (order changed)' })); continue; }
        const cur = await readInvoice(api, ex.qbo_id);
        if (isVoidedInv(cur)) { await upsertSync(Object.assign({}, base, { status: 'voided', qbo_id: ex.qbo_id, qbo_doc_no: ex.qbo_doc_no, last_error: 'void in QuickBooks — not rewritten', amount: 0 })); continue; }
        const paidSoFar = money(money(cur.TotalAmt) - money(cur.Balance));
        if (paidSoFar > 0 && Math.abs(money(cur.TotalAmt) - plan.total) > DEFAULTS.tolerance) throw new Error('invoice already has ' + paidSoFar.toFixed(2) + ' applied and the total would change ' + money(cur.TotalAmt).toFixed(2) + ' → ' + plan.total.toFixed(2) + ' — adjust it in QuickBooks by hand');
        const inv = await updateInvoice(api, body, ex.qbo_id, cur.SyncToken);
        await upsertSync(Object.assign({}, base, { status: 'updated', qbo_id: inv.Id, qbo_doc_no: inv.DocNumber, sync_token: inv.SyncToken, hash, amount: plan.total, last_error: null, attempts: 0, posted_at: ex.posted_at || new Date().toISOString() }));
        invoiceByOrder[o.id] = { qbo_id: inv.Id, customer: cust.qbo_id }; S.invoices.updated++; continue;
      }
      if (!live) { S.invoices.preview++; await upsertSync(Object.assign({}, base, { status: 'pending', hash, amount: plan.total, last_error: 'would post ' + money(plan.total).toFixed(2) + ' (' + plan.style + ' discount' + (plan.lines.some(l => l.DetailType === 'DiscountLineDetail') ? ' row' : ', none') + ') — enable the sync to send' + wouldCreate, attempts: 0 })); continue; }
      const inv = await postInvoice(api, body);
      // strict totals: never leave a wrong invoice in the books
      if (Math.abs(money(inv.TotalAmt) - plan.total) > DEFAULTS.tolerance) {
        let removed = ''; try { await deleteInvoice(api, inv.Id, inv.SyncToken); removed = ' — deleted again'; } catch (e) { removed = ' — could NOT delete it: ' + errText(e); }
        throw new Error('QuickBooks computed ' + money(inv.TotalAmt).toFixed(2) + ' but the order is ' + plan.total.toFixed(2) + removed);
      }
      await upsertSync(Object.assign({}, base, { status: 'posted', qbo_id: inv.Id, qbo_doc_no: inv.DocNumber, sync_token: inv.SyncToken, hash, amount: plan.total, last_error: null, attempts: 0, posted_at: new Date().toISOString() }));
      invoiceByOrder[o.id] = { qbo_id: inv.Id, customer: cust.qbo_id }; S.invoices.posted++;
    } catch (e) {
      S.invoices.errors++; S.errors.push(label + ': ' + errText(e));
      await upsertSync(Object.assign({}, base, { status: 'error', last_error: errText(e), attempts: ((ex && ex.attempts) || 0) + 1, amount: plan ? plan.total : o.total, qbo_id: ex ? ex.qbo_id : null }));
    }
  }
  if (!live) return finish(); // preview stops here: nothing below is worth pretending

  // ── pass 2: credit memos ──────────────────────────────────────────────────
  try {
    const cmRows = await syncRows('creditmemo');
    const cms = await sb('returns?select=id,account,order_ref,items,amount,action,reason,date,spec&date=gte.' + cfg.postFrom + '&order=id.asc&limit=500');
    let retItem = cfg.returnsItem;
    for (const cm of cms) {
      const ex = cmRows[String(cm.id)]; if (ex && ex.status !== 'error') continue; if (ex && ex.attempts >= MAX_ATTEMPTS && !opts.force) continue;
      const label = docLabel(fmt, 'cm', cm.id);
      try {
        if (!retItem) retItem = (await ensureItem(api, 'RETURNS', 'Returns & credit memos', cfg.incomeAccount, cfg.taxCode)).qbo_id;
        const cust = await ensureCustomer(api, cm.account);
        const doc = await postCreditMemo(api, buildCreditMemo(cm, cust.qbo_id, retItem, refsCfg, label));
        // apply to the invoice it names, if that invoice is ours
        const m = String(cm.order_ref || '').match(/(\d+)\s*$/); let applied = '';
        if (m) { const num = +m[1] - ((fmt.order && fmt.order.offset_no) || 1000); const o = num > 0 ? (await sb('orders?select=id&num=eq.' + num))[0] : null; const inv = o && invoiceByOrder[o.id];
          if (inv) { await postPayment(api, buildCreditApplication(cust.qbo_id, inv.qbo_id, doc.Id, cm.amount, cm.date)); applied = ' · applied to ' + cm.order_ref; } }
        await upsertSync({ kind: 'creditmemo', hq_ref: String(cm.id), order_id: null, order_label: label, status: 'posted', qbo_id: doc.Id, qbo_doc_no: doc.DocNumber, sync_token: doc.SyncToken, amount: cm.amount, last_error: applied || null, posted_at: new Date().toISOString(), attempts: 0 });
        S.creditmemos.posted++;
      } catch (e) { S.creditmemos.errors++; S.errors.push(label + ': ' + errText(e)); await upsertSync({ kind: 'creditmemo', hq_ref: String(cm.id), order_label: label, status: 'error', last_error: errText(e), attempts: ((ex && ex.attempts) || 0) + 1, amount: cm.amount }); }
    }
  } catch (e) { S.errors.push('credit memos: ' + errText(e)); }

  // ── pass 3: HQ payments → QuickBooks (only when finance turns it on) ──────
  if (!cfg.syncPayments) S.payments.off = true;
  else try {
    const payRows = await syncRows('payment');
    const ids = Object.keys(invoiceByOrder); const pays = [];
    for (let i = 0; i < ids.length; i += 80) pays.push(...await sb('payments?select=id,order_id,order_label,account,amount,date,method,ref,note,qbo_id&order_id=in.(' + ids.slice(i, i + 80).join(',') + ')&order=id.asc'));
    for (const p of pays) {
      if (p.qbo_id) continue;                                           // came FROM QuickBooks — never send it back
      const ex = payRows[String(p.id)]; if (ex && ex.status !== 'error') continue; if (ex && ex.attempts >= MAX_ATTEMPTS && !opts.force) continue;
      const inv = invoiceByOrder[p.order_id];
      if (+p.amount <= 0) { await upsertSync({ kind: 'payment', hq_ref: String(p.id), order_id: p.order_id, order_label: p.order_label, status: 'skipped', last_error: 'negative (correction) payment — reverse it in QuickBooks by hand', amount: p.amount }); S.payments.skipped++; continue; }
      try {
        const custId = inv.customer || (await ensureCustomer(api, p.account || (await sb('orders?select=account&id=eq.' + p.order_id))[0].account)).qbo_id;
        const doc = await postPayment(api, buildPayment(p, custId, inv.qbo_id, refsCfg));
        await upsertSync({ kind: 'payment', hq_ref: String(p.id), order_id: p.order_id, order_label: p.order_label, status: 'posted', qbo_id: doc.Id, qbo_doc_no: doc.PaymentRefNum || doc.Id, sync_token: doc.SyncToken, amount: p.amount, last_error: null, attempts: 0, posted_at: new Date().toISOString() });
        S.payments.posted++;
      } catch (e) { S.payments.errors++; S.errors.push((p.order_label || p.order_id) + ' payment #' + p.id + ': ' + errText(e)); await upsertSync({ kind: 'payment', hq_ref: String(p.id), order_id: p.order_id, order_label: p.order_label, status: 'error', last_error: errText(e), attempts: ((ex && ex.attempts) || 0) + 1, amount: p.amount }); }
    }
  } catch (e) { S.errors.push('payments out: ' + errText(e)); }

  // ── pass 4: QuickBooks payments → HQ ──────────────────────────────────────
  try {
    const since = cfg.cdcSince; const cursor = new Date(started.getTime() - 5 * 60 * 1000).toISOString();
    if (!since) { await setSetting('qbo_cdc_since', cursor); }                 // first live run: start the clock, pull from now on
    else {
      const ours = {}; for (const oid in invoiceByOrder) ours[invoiceByOrder[oid].qbo_id] = oid;       // qbo invoice id → order id
      const sentByUs = new Set(Object.values(await syncRows('payment')).filter(r => !String(r.hq_ref).startsWith('qbo:')).map(r => r.qbo_id).filter(Boolean)); // ours, not the ones we pulled
      const changed = await changedPayments(api, since);
      for (const p of changed) {
        if (sentByUs.has(p.id)) continue;                                        // our own payment echoing back
        if (p.deleted) { // a QuickBooks payment we had pulled was deleted there → offsetting row (payments are append-only)
          const prev = (await sb('payments?select=id,order_id,order_label,account,amount&qbo_id=eq.' + encodeURIComponent(p.id)))[0]; if (!prev) continue;
          try { await sb('payments', 'POST', { order_id: prev.order_id, order_label: prev.order_label, account: prev.account, amount: -prev.amount, date: today, method: 'QuickBooks', ref: 'reversal of QBO ' + p.id, note: 'Payment deleted in QuickBooks', created_name: 'QuickBooks', qbo_id: p.id + ':void' }); await rollup(prev.order_id); S.payments.pulled++; } catch (e) { S.payments.errors++; S.errors.push('QBO payment ' + p.id + ' reversal: ' + errText(e)); }
          continue;
        }
        for (const L of p.links) {
          const oid = ours[L.invoiceId]; if (!oid || !L.amount) continue;
          const already = await sb('payments?select=id&qbo_id=eq.' + encodeURIComponent(p.id)); if (already.length) continue;
          try {
            const o = (await sb('orders?select=account,num,source,ext_ref&id=eq.' + oid))[0] || {};
            const olabel = o.source === 'shopify' && o.ext_ref ? String(o.ext_ref).replace('#', '') : docLabel(fmt, 'order', o.num);
            await sb('payments', 'POST', { order_id: oid, order_label: olabel, account: o.account || null, amount: money(L.amount), date: p.date, method: p.method || 'QuickBooks', ref: (p.ref || ('QBO ' + p.id)).slice(0, 80), note: 'Recorded in QuickBooks' + (p.note ? ' · ' + p.note : ''), created_name: 'QuickBooks', qbo_id: p.id });
            if (o.source !== 'shopify') await rollup(oid); // Shopify orders keep Shopify's paid/balance until cutover (the import owns them)
            S.payments.pulled++;
            await upsertSync({ kind: 'payment', hq_ref: 'qbo:' + p.id, order_id: oid, order_label: olabel, status: 'posted', qbo_id: p.id, qbo_doc_no: p.ref || p.id, amount: money(L.amount), last_error: 'pulled from QuickBooks', posted_at: new Date().toISOString() });
          } catch (e) { S.payments.errors++; S.errors.push('QBO payment ' + p.id + ' → HQ: ' + errText(e)); }
        }
      }
      await setSetting('qbo_cdc_since', cursor);
    }
  } catch (e) { S.errors.push('payments in: ' + errText(e)); }
  return finish();
}

// orders.paid / balance / pay_status stay the rollup of the payments rows (same rule as the app)
async function rollup(orderId) {
  const o = (await sb('orders?select=id,total,pay_status&id=eq.' + orderId))[0]; if (!o) return;
  const ps = await sb('payments?select=amount&order_id=eq.' + orderId);
  const paid = round2(ps.reduce((s, p) => s + (+p.amount || 0), 0)); const balance = round2((+o.total || 0) - paid);
  await sb('orders?id=eq.' + orderId, 'PATCH', { paid, balance, pay_status: balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending' });
}
