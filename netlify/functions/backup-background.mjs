// NIGHTLY BACKUP — exports every Supabase table to a dated JSON blob in
// Netlify Blobs (store: "backups"), keeps the last 14 days. The free-tier
// safety net until Supabase Pro backups take over at cutover.
// Guarded by JOB_KEY (triggered from nightly.mjs). Download via backup.mjs.
import { connectLambda, getStore } from '@netlify/blobs';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_KEY || '';

// table → stable order column (for deterministic paging)
const TABLES = {
  profiles: 'id', accounts: 'name', account_links: 'from_key', account_contacts: 'id',
  visits: 'id', orders: 'id', order_lines: 'id', order_overrides: 'ref',
  audit_log: 'id', spec_targets: 'id', spec_roster: 'id', app_settings: 'key',
  campaigns: 'id', pdcs: 'id', returns: 'id', items: 'sku',
  pos: 'id', po_lines: 'id', opportunities: 'id', stock_moves: 'id',
  approvals: 'id', comm_rules: 'id', quotes: 'id', quote_lines: 'id',
  promos: 'id', count_sessions: 'id', count_lines: 'id', forecast_snapshots: 'id'
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
  if ((event.headers['x-job-key'] || '') !== (process.env.JOB_KEY || 'x')) {
    return { statusCode: 403, body: 'nope' };
  }
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
