// Runs a saved report on the server with the SAME engine the browser previews
// with (js/15-report-engine.js — plain functions, loaded here as CommonJS). Used
// by the 6am schedule and by "Run on the server now". The run is made AS the
// report's owner (role and specialist tag looked up fresh), so a schedule can
// never widen what its owner could see on screen; the CSV goes to Netlify Blobs
// (store 'reports') and a report_runs row points at it.
import { getStore as _netlifyStore } from '@netlify/blobs';
let storeFactory = _netlifyStore;            // tests swap in an in-memory store
export function _useStore(fn) { storeFactory = fn || _netlifyStore; }
const getStore = (name) => storeFactory(name);
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../../../js/15-report-engine.js');

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_KEY || '';
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
async function q(path) { const r = await fetch(SB_URL + '/rest/v1/' + path, { headers: H }); if (!r.ok) throw new Error(path.split('?')[0] + ' ' + r.status); return r.json(); }
async function qAll(path, order) { // page through PostgREST in 1000s
  const out = []; let from = 0;
  while (true) { const r = await fetch(SB_URL + '/rest/v1/' + path + (path.includes('?') ? '&' : '?') + 'order=' + (order || 'id') + '&limit=1000&offset=' + from, { headers: H }); if (!r.ok) throw new Error(path.split('?')[0] + ' ' + r.status); const rows = await r.json(); out.push(...rows); if (rows.length < 1000 || out.length >= 20000) break; from += 1000; }
  return out;
}

export async function loadSourceRows(source) {
  if (source === 'stock' || source === 'batches') {
    const snap = await getStore('sync').get('data', { type: 'json' });
    if (!snap) throw new Error('No sync snapshot yet');
    if (source === 'stock') return (snap.products || []).map(p => ({ sku: p.sku, name: p.name, line: p.line, category: p.category, supplier: p.supplier, received: p.received, sold: p.sold, stock: p.stock, price: p.price, batch: p.batch, expiry: p.expiry, bin: p.bin }));
    return E.rptFlattenBatches(snap.batches || []);
  }
  if (source === 'sales') { const sh = await getStore('shopify').get('data', { type: 'json' }); return E.rptFlattenSales((sh && sh.recent) || []); }
  if (source === 'order_lines') { const [o, l] = await Promise.all([qAll('orders?select=id,date,account,spec,status&deleted_at=is.null'), qAll('order_lines?select=*')]); return E.rptFlattenOrderLines(o, l); }
  if (source === 'orders') return qAll('orders?select=*&deleted_at=is.null');
  if (!E.RPT_SOURCES[source]) throw new Error('Unknown source ' + source);
  return qAll(source + '?select=*');
}

export async function runSavedReport(reportId, by) {
  const rep = (await q('saved_reports?select=*&id=eq.' + encodeURIComponent(reportId)))[0];
  if (!rep) throw new Error('Report not found');
  const prof = (await q('profiles?select=role,is_super,specialist_tag,name&id=eq.' + encodeURIComponent(rep.owner_id)))[0] || {};
  const role = prof.is_super ? 'super' : (prof.role || 'viewer');
  const def = rep.def || {};
  const store = getStore('reports');
  const runRow = { report_id: rep.id, by_user: (by && by.id) || null, by_name: (by && by.name) || 'schedule', status: 'ok' };
  try {
    if (!E.rptSourceAllowed(def.source, role)) throw new Error('The owner\'s role cannot read ' + def.source);
    const rows = await loadSourceRows(def.source);
    const res = E.rptRun(def, rows, role, { ownTag: role === 'sales' ? (prof.specialist_tag || '') : '' });
    if (res.error) throw new Error(res.error);
    const csv = '﻿' + E.rptCSV(res);
    const key = 'run-' + rep.id + '-' + Date.now();
    await store.set(key, csv, { metadata: { report: String(rep.id), rows: String(res.rows.length) } });
    Object.assign(runRow, { rows: res.rows.length, blob_key: key });
  } catch (e) { Object.assign(runRow, { status: 'error', error: String(e.message || e).slice(0, 300) }); }
  const ins = await fetch(SB_URL + '/rest/v1/report_runs', { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(runRow) });
  const saved = ins.ok ? (await ins.json())[0] : null;
  // tell the owner (and, for a shared scheduled report, nobody else — they open it from the page)
  try {
    if (!by || !by.id) await fetch(SB_URL + '/rest/v1/notifications', { method: 'POST', headers: H, body: JSON.stringify({ user_id: rep.owner_id, kind: 'auto', title: (runRow.status === 'ok' ? 'Report ready: ' : 'Report failed: ') + rep.name, body: runRow.status === 'ok' ? (runRow.rows + ' row' + (runRow.rows === 1 ? '' : 's') + ' · download it from Saved reports → runs') : (runRow.error || 'unknown error'), link: '#/v/savedreports', created_by: rep.owner_id }) });
  } catch (e) {}
  return { run: saved || runRow, report: { id: rep.id, name: rep.name, owner_id: rep.owner_id, shared: !!rep.shared, source: def.source } };
}

export async function dueReports(dateISO) {
  const reps = await q('saved_reports?select=id,name,schedule&schedule=not.is.null');
  return reps.filter(r => E.rptDue(r.schedule, dateISO));
}

export { E as engine };
