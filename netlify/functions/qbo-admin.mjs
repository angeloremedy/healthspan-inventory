// QuickBooks sync — what the Finance → QuickBooks page talks to.
//   GET  ?action=status     admin/finance  connection, settings, last run, counts
//   GET  ?action=lists      admin/finance  QBO tax codes, accounts, payment methods (for the settings dropdowns)
//   GET  ?action=mappings   admin/finance  unconfirmed customer/item matches with candidates
//   GET  ?action=search&q=  admin/finance  QBO customers whose name contains q (to pick a different match)
//   GET  ?action=log&status=&q=            the qbo_sync ledger (latest 300)
//   POST {action:'settings', values:{…}}   super admin  writes qbo_* settings
//   POST {action:'confirm', kind, hq_key, qbo_id?, qbo_name?}   admin/finance  confirms (or re-points) a mapping
//   POST {action:'retry', id}              admin/finance  a row back to pending
//   POST {action:'run', force?}            admin/finance  starts the background worker now
import { hasClient, qboEnv, loadTokens, refreshIfNeeded, client, sb, mapSet } from './lib/qbo.mjs';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_KEY || '';
const HDRS = { 'Content-Type': 'application/json' };
const out = (code, body) => ({ statusCode: code, headers: HDRS, body: JSON.stringify(body) });
const SETTING_KEYS = ['qbo_enabled', 'qbo_post_from', 'qbo_tax_code', 'qbo_deposit_account', 'qbo_income_account', 'qbo_use_class', 'qbo_use_location', 'qbo_sources', 'qbo_returns_item', 'qbo_require_confirm'];

async function caller(event) {
  const token = ((event.headers && (event.headers.authorization || event.headers.Authorization)) || '').replace(/^Bearer\s+/i, '');
  if (!token || !SB_URL || !SVC) return null;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SVC, Authorization: 'Bearer ' + token } });
    if (!r.ok) return null; const u = await r.json();
    const pr = await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + u.id + '&select=role,is_super,name', { headers: { apikey: SVC, Authorization: 'Bearer ' + SVC } });
    const p = (await pr.json())[0] || {};
    return { id: u.id, role: p.role || 'viewer', super: !!p.is_super, name: p.name || u.email || '' };
  } catch (e) { return null; }
}
async function settings() { const rows = await sb("app_settings?select=key,value&key=like.qbo_%"); const c = {}; for (const r of rows) c[r.key] = r.value; return c; }
async function audit(who, action, detail) { try { await sb('audit_log', 'POST', { user_id: who.id, who: who.name, action, detail: JSON.stringify(detail || {}).slice(0, 900) }); } catch (e) {} }

export const handler = async (event) => {
  const who = await caller(event);
  if (!who) return out(401, { error: 'Sign in first' });
  const finance = who.super || ['admin', 'finance'].includes(who.role);
  if (!finance) return out(403, { error: 'Finance or admin only' });
  const qs = event.queryStringParameters || {};
  let body = {}; if (event.httpMethod === 'POST') { try { body = JSON.parse(event.body || '{}'); } catch (e) {} }
  const action = event.httpMethod === 'POST' ? String(body.action || '') : String(qs.action || '');

  try {
    if (action === 'status') {
      const tok = await loadTokens(); const c = await settings();
      const counts = {}; try { const rows = await sb('qbo_sync?select=kind,status'); for (const r of rows) { counts[r.kind] = counts[r.kind] || {}; counts[r.kind][r.status] = (counts[r.kind][r.status] || 0) + 1; } } catch (e) {}
      let unconfirmed = 0; try { unconfirmed = (await sb('qbo_map?select=kind&confirmed=is.false')).length; } catch (e) {}
      let lastRun = null; try { lastRun = c.qbo_last_run ? JSON.parse(c.qbo_last_run) : null; } catch (e) {}
      const st = {}; for (const k of SETTING_KEYS) st[k] = c[k] || '';
      return out(200, { configured: hasClient(), env: qboEnv(), connected: !!tok, company: tok && tok.company_name, realm: tok && tok.realm_id,
        refreshExpires: tok && tok.refresh_expires_at, connectedEnv: tok && tok.env, settings: st, counts, unconfirmed, lastRun, lock: c.qbo_lock || '', cdcSince: c.qbo_cdc_since || '', canEdit: who.super });
    }
    if (action === 'lists') {
      const tok = await refreshIfNeeded(await loadTokens()); const api = client(tok);
      const [tax, acc, pm, pref] = await Promise.all([
        api.query('select Id, Name, Active from TaxCode maxresults 200'),
        api.query("select Id, Name, AccountType, AccountSubType from Account where Active = true maxresults 1000"),
        api.query('select Id, Name from PaymentMethod maxresults 100'),
        api.preferences().catch(() => ({}))
      ]);
      const accounts = (acc.Account || []).map(a => ({ id: a.Id, name: a.Name, type: a.AccountType, sub: a.AccountSubType }));
      return out(200, {
        taxCodes: (tax.TaxCode || []).filter(t => t.Active !== false).map(t => ({ id: t.Id, name: t.Name })),
        depositAccounts: accounts.filter(a => ['Bank', 'Other Current Asset'].includes(a.type)),
        incomeAccounts: accounts.filter(a => a.type === 'Income'),
        paymentMethods: (pm.PaymentMethod || []).map(p => ({ id: p.Id, name: p.Name })),
        classTracking: !!(pref.AccountingInfoPrefs && (pref.AccountingInfoPrefs.ClassTrackingPerTxnLine || pref.AccountingInfoPrefs.ClassTrackingPerTxn)),
        locationTracking: !!(pref.AccountingInfoPrefs && pref.AccountingInfoPrefs.TrackDepartments)
      });
    }
    if (action === 'mappings') {
      const rows = await sb('qbo_map?select=*&confirmed=is.false&order=updated_at.desc&limit=300');
      return out(200, { rows });
    }
    if (action === 'search') {
      const term = String(qs.q || '').trim(); if (term.length < 2) return out(200, { rows: [] });
      const tok = await refreshIfNeeded(await loadTokens()); const api = client(tok);
      const r = await api.query("select Id, DisplayName from Customer where DisplayName like '%" + term.replace(/'/g, "\\'").replace(/%/g, '') + "%' maxresults 20");
      return out(200, { rows: (r.Customer || []).map(c => ({ id: c.Id, name: c.DisplayName })) });
    }
    if (action === 'log') {
      let path = 'qbo_sync?select=*&order=updated_at.desc&limit=300';
      if (qs.status) path += '&status=eq.' + encodeURIComponent(qs.status);
      if (qs.q) path += '&order_label=ilike.*' + encodeURIComponent(qs.q) + '*';
      return out(200, { rows: await sb(path) });
    }
    if (action === 'settings') {
      if (!who.super) return out(403, { error: 'Super admin only' });
      const vals = body.values || {}; const written = [];
      for (const k of SETTING_KEYS) if (k in vals) { await sb('app_settings?on_conflict=key', 'POST', { key: k, value: String(vals[k] == null ? '' : vals[k]).slice(0, 200), updated_by: who.id, updated_at: new Date().toISOString() }); written.push(k); }
      await audit(who, 'qbo.settings', vals);
      return out(200, { ok: true, written });
    }
    if (action === 'confirm') {
      const kind = String(body.kind || ''), key = String(body.hq_key || ''); if (!kind || !key) return out(400, { error: 'kind and hq_key required' });
      const cur = (await sb('qbo_map?select=*&kind=eq.' + kind + '&hq_key=eq.' + encodeURIComponent(key)))[0];
      if (!cur && !body.qbo_id) return out(404, { error: 'No such mapping' });
      const row = await mapSet(kind, key, body.qbo_id || cur.qbo_id, body.qbo_name || (body.qbo_id ? null : cur.qbo_name), true, null, who.id);
      // invoices held on this customer go back to pending so the next run posts them
      if (kind === 'customer') { try { await sb('qbo_sync?kind=eq.invoice&status=eq.pending&last_error=like.customer%20match%20needs%20confirmation%25', 'PATCH', { last_error: 'mapping confirmed — will post on the next run' }); } catch (e) {} }
      await audit(who, 'qbo.confirm', { kind, key, qbo_id: row.qbo_id });
      return out(200, { ok: true, row });
    }
    if (action === 'retry') {
      const id = +body.id; if (!id) return out(400, { error: 'id required' });
      await sb('qbo_sync?id=eq.' + id, 'PATCH', { status: 'pending', attempts: 0, last_error: 'retry requested', updated_at: new Date().toISOString() });
      await audit(who, 'qbo.retry', { id });
      return out(200, { ok: true });
    }
    if (action === 'run') {
      const base = process.env.URL || ('https://' + (event.headers.host || 'hq.healthspan.ph'));
      const r = await fetch(base + '/.netlify/functions/qbo-sync-background', { method: 'POST', headers: { 'x-job-key': process.env.JOB_KEY || '', 'Content-Type': 'application/json' }, body: JSON.stringify({ by: who.name || 'manual', force: !!body.force }) });
      if (!r.ok && r.status !== 202) return out(502, { error: 'The sync worker did not start (' + r.status + ')' });
      await audit(who, 'qbo.run', { force: !!body.force });
      return out(200, { ok: true, started: true });
    }
    return out(400, { error: 'Unknown action' });
  } catch (e) { return out(500, { error: String(e.message || e) }); }
};
