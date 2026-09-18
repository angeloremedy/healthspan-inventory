// Shadow reconciliation — the go/no-go check before HQ takes over QuickBooks posting
// from the old Shopify connector. For every Shopify order HQ has imported since the
// cutoff, HQ builds the invoice IT would post (lib/qbo-map.mjs, Sean's rules) and
// compares it with the invoice the old connector actually posted — by DocNumber, total,
// VAT, class, customer, due date, line count and the discount row. Nothing is written
// to QuickBooks. Results go to Netlify Blobs (store 'qbo': 'reconcile' = the latest run
// with its rows, 'reconcile-history' = the last 60 summaries) and the QuickBooks page
// shows them. A week of runs with zero differences is the signal to switch.
import { getStore as _netlifyStore } from '@netlify/blobs';
import { loadTokens, refreshIfNeeded, client, sb, setting, invoicesByDocNumber, mapGet } from './qbo.mjs';
import { cfgLoad, mapCfg } from './qbo-sync.mjs';
import { normalizeShopify, planInvoice, diffInvoice, INTERNAL_RE, TEST_RE, money } from './qbo-map.mjs';

let storeFactory = _netlifyStore;
export function _useStore(fn) { storeFactory = fn || _netlifyStore; }
const getStore = name => storeFactory(name);
const MAX_ROWS = 400;
const isVoidedInv = inv => money(inv.TotalAmt) === 0 && /void/i.test(String(inv.PrivateNote || ''));

export async function runReconcile(opts = {}) {
  const started = Date.now();
  const since = /^\d{4}-\d{2}-\d{2}$/.test(opts.since || '') ? opts.since : ((await setting('qbo_reconcile_from')) || '2026-09-14');
  const S = { at: new Date().toISOString(), since, by: opts.by || 'schedule', orders: 0, matched: 0, differences: 0, missing: 0, voided: 0, cancelled: 0, noSnapshot: 0, skipped: 0, errors: [], rows: [] };
  let api, cfg;
  try {
    cfg = await cfgLoad(); const tok = await refreshIfNeeded(await loadTokens()); api = client(tok); S.company = tok.company_name || tok.realm_id;
  } catch (e) { S.errors.push(String(e.message || e)); return save(S, started); }
  const mc = Object.assign(mapCfg(cfg), { strictTotals: false });
  let orders = [];
  try { orders = await sb('orders?select=id,ext_ref,date,account,status,total,qbo_src&source=eq.shopify&deleted_at=is.null&date=gte.' + since + '&order=date.asc&limit=2000'); }
  catch (e) { S.errors.push('orders: ' + String(e.message || e)); return save(S, started); }
  const plans = [];
  for (const o of orders) {
    if (TEST_RE.test(o.account) || INTERNAL_RE.test(o.account)) { S.skipped++; continue; }
    if (!o.qbo_src) { S.noSnapshot++; continue; }
    S.orders++;
    try {
      const n = normalizeShopify(typeof o.qbo_src === 'string' ? JSON.parse(o.qbo_src) : o.qbo_src);
      const plan = planInvoice(n, mc);
      plans.push({ o, n, plan });
    } catch (e) { S.differences++; S.rows.push(row(o, null, null, 'error', [{ field: 'plan', ours: String(e.message || e).slice(0, 200), theirs: '' }])); }
  }
  let inQbo = {};
  try { inQbo = await invoicesByDocNumber(api, plans.map(p => p.plan.docNumber)); } catch (e) { S.errors.push('QuickBooks query: ' + String(e.message || e)); return save(S, started); }
  for (const { o, n, plan } of plans) {
    const inv = inQbo[plan.docNumber] || null;
    if (n.cancelledAt || o.status === 'cancelled') {
      if (!inv) { S.cancelled++; S.rows.push(row(o, plan, null, 'cancelled', [])); continue; }
      if (isVoidedInv(inv)) { S.voided++; S.rows.push(row(o, plan, inv, 'voided', [])); continue; }
      S.differences++; S.rows.push(row(o, plan, inv, 'diff', [{ field: 'status', ours: 'cancelled ' + String(n.cancelledAt || '').slice(0, 10), theirs: 'invoice still open, ' + money(inv.TotalAmt).toFixed(2) }])); continue;
    }
    if (!inv) { S.missing++; S.rows.push(row(o, plan, null, 'missing', [{ field: 'invoice', ours: money(plan.total).toFixed(2), theirs: 'not in QuickBooks' }])); continue; }
    let customerId = null; try { const m = await mapGet('customer', plan.customerName); if (m && m.confirmed !== false) customerId = m.qbo_id; } catch (e) {}
    const diffs = diffInvoice(plan, inv, mc, { customerId });
    if (plan.mismatch) diffs.unshift({ field: 'lines', ours: 'lines add up to ' + money(plan.mismatch.got).toFixed(2), theirs: 'order says ' + money(plan.mismatch.expected).toFixed(2) });
    if (diffs.length) { S.differences++; S.rows.push(row(o, plan, inv, 'diff', diffs)); } else { S.matched++; if (S.rows.length < MAX_ROWS) S.rows.push(row(o, plan, inv, 'match', [])); }
  }
  // differences first, then everything else; cap the stored rows
  S.rows.sort((a, b) => (a.state === 'match' ? 1 : 0) - (b.state === 'match' ? 1 : 0) || String(a.date).localeCompare(String(b.date)));
  S.rows = S.rows.slice(0, MAX_ROWS);
  S.clean = S.differences === 0 && S.missing === 0 && S.errors.length === 0 && S.orders > 0;
  return save(S, started);
}
function row(o, plan, inv, state, diffs) {
  return { doc: plan ? plan.docNumber : String(o.ext_ref || '').replace('#', ''), date: o.date, account: o.account, ours: plan ? money(plan.total) : null, theirs: inv ? money(inv.TotalAmt) : null, vatOurs: plan ? plan.vat : null, vatTheirs: inv && inv.TxnTaxDetail ? money(inv.TxnTaxDetail.TotalTax) : null, customer: inv && inv.CustomerRef ? (inv.CustomerRef.name || '') : '', style: plan ? plan.style : '', state, diffs };
}
async function save(S, started) {
  S.ms = Date.now() - started;
  try {
    const store = getStore('qbo');
    await store.setJSON('reconcile', S);
    let hist = []; try { hist = (await store.get('reconcile-history', { type: 'json' })) || []; } catch (e) {}
    const summary = Object.assign({}, S); delete summary.rows; delete summary.errors; summary.errorCount = S.errors.length;
    hist.unshift(summary); await store.setJSON('reconcile-history', hist.slice(0, 60));
    S.history = hist.slice(0, 60);
  } catch (e) { S.errors.push('blobs: ' + String(e.message || e)); }
  return S;
}
// consecutive clean runs at the head of the history, and the span of days they cover
export function cleanStreak(hist) {
  let n = 0, first = null, last = null;
  for (const h of hist || []) { if (!h.clean) break; n++; if (!last) last = h.at; first = h.at; }
  const days = first && last ? Math.max(1, Math.round((Date.parse(last) - Date.parse(first)) / 86400000) + 1) : 0;
  return { runs: n, days };
}
