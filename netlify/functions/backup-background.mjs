// NIGHTLY BACKUP — exports every Supabase table to a dated JSON blob in
// Netlify Blobs (store: "backups"), keeps the last 14 days. The free-tier
// safety net until Supabase Pro backups take over at cutover.
// Guarded by JOB_KEY (triggered from nightly.mjs). Download via backup.mjs.
import { connectLambda, getStore } from '@netlify/blobs';
import { requireJobKey } from './lib/guard.mjs';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_KEY || '';

// table → stable order column (for deterministic paging)
const TABLES = {
  profiles: 'id', accounts: 'name', account_links: 'from_key', account_contacts: 'id',
  visits: 'id', orders: 'id', order_lines: 'id', order_overrides: 'ref',
  audit_log: 'id', spec_targets: 'month', spec_roster: 'spec', app_settings: 'key',
  campaigns: 'id', pdcs: 'id', returns: 'id', items: 'sku',
  pos: 'id', po_lines: 'id', opportunities: 'id', stock_moves: 'id',
  approvals: 'id', comm_rules: 'id', quotes: 'id', quote_lines: 'id',
  promos: 'id', count_sessions: 'id', count_lines: 'id', forecast_snapshots: 'id',
  // tables added after the first backup pass — without these the dated cash
  // detail and the permanent month-end figures would be the only data not backed up
  payments: 'id', valuation_snapshots: 'id', shortdated: 'id',
  attachments: 'id', pullouts: 'id', pullout_lines: 'id', fund_sources: 'class',
  doc_formats: 'kind', archive_bin: 'id',
  backorders: 'id', quarantine: 'id', complaints: 'id', suppliers: 'id',
  transfers: 'id', transfer_lines: 'id', notifications: 'id', doc_series: 'kind',
  // 2026-09-08 audit: sixteen tables had grown up outside the backup — the finance
  // forms ledger, the equipment register, saved chats and preferences among them.
  // qbo_tokens is deliberately NOT here: secrets never leave the database.
  approval_routes: 'id', code_lists: 'id', fin_requests: 'id', fin_lines: 'id',
  serials: 'id', loans: 'id', waves: 'id', auto_log: 'id',
  review_notes: 'spec', review_commentary: 'month', review_snapshots: 'id',
  ask_chats: 'id', user_prefs: 'user_id', qbo_map: 'kind', qbo_sync: 'id'
};

async function dump(table, orderCol) {
  const rows = [];
  for (let page = 0; page < 60; page++) {
    const r = await fetch(SB_URL + '/rest/v1/' + table + '?select=*&order=' + orderCol +
      '&limit=1000&offset=' + (page * 1000), {
      headers: { apikey: SVC, Authorization: 'Bearer ' + SVC }
    });
    if (!r.ok) throw new Error(table + ': HTTP ' + r.status);
    const batch = await r.json();
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}

export const handler = async (event) => {
  { const gate = requireJobKey(event); if (gate) return gate; } // fail closed: no JOB_KEY = no job
  connectLambda(event);
  const store = getStore('backups');
  const out = { exported_at: new Date().toISOString(), tables: {} };
  const errors = {};
  for (const [t, col] of Object.entries(TABLES)) {
    try { out.tables[t] = await dump(t, col); }
    catch (e) { errors[t] = String(e.message || e); } // missing tables are fine — schema grows
  }
  out.errors = errors;
  const day = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // Manila date
  await store.setJSON('backup-' + day, out);
  await store.setJSON('latest', { day, exported_at: out.exported_at, counts: Object.fromEntries(Object.entries(out.tables).map(([k, v]) => [k, v.length])) });
  // prune: keep 14 dated backups
  try {
    const { blobs } = await store.list();
    const dated = blobs.map(b => b.key).filter(k => k.startsWith('backup-')).sort();
    for (const k of dated.slice(0, Math.max(0, dated.length - 14))) await store.delete(k);
  } catch (e) {}
  console.log('backup done', day, JSON.stringify(Object.fromEntries(Object.entries(out.tables).map(([k, v]) => [k, v.length]))), 'errors:', JSON.stringify(errors));
  return { statusCode: 200, body: JSON.stringify({ ok: true, day }) };
};
