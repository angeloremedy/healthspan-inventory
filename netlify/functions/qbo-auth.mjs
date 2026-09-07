// QuickBooks Online — connect / disconnect (OAuth 2). Super admin only.
//
//   GET  ?action=start        (signed-in super admin, fetch with Authorization)
//        → { url }  — the Intuit consent page; the browser navigates there
//   GET  ?code=…&realmId=…&state=…   (Intuit sends the browser back here)
//        → exchanges the code, stores the tokens (service key), redirects to /#/v/qbo
//   POST { action:'disconnect' }      (super admin) → revokes and forgets the tokens
//
// The state parameter is an HMAC over who-started-it + expiry, so a callback we
// did not start is refused. Tokens never travel to the browser.
import crypto from 'node:crypto';
import { hasClient, authorizeUrl, exchangeCode, loadTokens, revoke, client, sb, qboEnv } from './lib/qbo.mjs';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_KEY || '';
const HDRS = { 'Content-Type': 'application/json' };
const out = (code, body) => ({ statusCode: code, headers: HDRS, body: JSON.stringify(body) });
const redirectUri = () => process.env.QBO_REDIRECT_URI || ((process.env.URL || 'https://hq.healthspan.ph').replace(/\/$/, '') + '/.netlify/functions/qbo-auth');
const appUrl = () => (process.env.URL || 'https://hq.healthspan.ph').replace(/\/$/, '');

async function caller(event) {
  const token = ((event.headers && (event.headers.authorization || event.headers.Authorization)) || '').replace(/^Bearer\s+/i, '');
  if (!token || !SB_URL || !SVC) return null;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SVC, Authorization: 'Bearer ' + token } });
    if (!r.ok) return null; const u = await r.json();
    const pr = await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + u.id + '&select=role,is_super', { headers: { apikey: SVC, Authorization: 'Bearer ' + SVC } });
    const p = (await pr.json())[0] || {};
    return { id: u.id, role: p.role || 'viewer', super: !!p.is_super };
  } catch (e) { return null; }
}
function sign(s) { return crypto.createHmac('sha256', process.env.QBO_CLIENT_SECRET || 'x').update(s).digest('base64url'); }
function makeState(uid) { const body = uid + '|' + (Date.now() + 10 * 60 * 1000) + '|' + crypto.randomBytes(6).toString('hex'); return Buffer.from(body).toString('base64url') + '.' + sign(body); }
function readState(state) {
  const [b, sig] = String(state || '').split('.'); if (!b || !sig) return null;
  const body = Buffer.from(b, 'base64url').toString(); if (sign(body) !== sig) return null;
  const [uid, exp] = body.split('|'); if (+exp < Date.now()) return null; return { uid };
}

export const handler = async (event) => {
  const qs = event.queryStringParameters || {};
  if (event.httpMethod === 'GET' && qs.code && qs.realmId) {
    // ── Intuit callback: no session header here (it is a top-level navigation), the signed state is the proof
    const st = readState(qs.state);
    const back = (msg, ok) => ({ statusCode: 302, headers: { Location: appUrl() + '/#/v/qbo?' + (ok ? 'connected=1' : 'error=' + encodeURIComponent(msg)) }, body: '' });
    if (!st) return back('The connection request expired or was not started from HQ — try Connect again.');
    try {
      const row = await exchangeCode(qs.code, redirectUri(), qs.realmId, st.uid);
      try { const api = client(row); const ci = await api.companyInfo(); await sb('qbo_tokens?realm_id=eq.' + encodeURIComponent(row.realm_id), 'PATCH', { company_name: ci.CompanyName || ci.LegalName || null }); } catch (e) {}
      try { await sb('audit_log', 'POST', { action: 'qbo.connect', who: 'QuickBooks sync', detail: JSON.stringify({ realm: qs.realmId, env: qboEnv() }), user_id: st.uid }); } catch (e) {}
      return back('', true);
    } catch (e) { return back(String(e.message || e)); }
  }
  if (event.httpMethod === 'GET' && qs.error) return { statusCode: 302, headers: { Location: appUrl() + '/#/v/qbo?error=' + encodeURIComponent(qs.error_description || qs.error) }, body: '' };

  const who = await caller(event);
  if (!who) return out(401, { error: 'Sign in first' });
  if (!who.super) return out(403, { error: 'Super admin only' });
  if (!hasClient()) return out(500, { error: 'QBO_CLIENT_ID / QBO_CLIENT_SECRET are not set in Netlify.' });

  if (event.httpMethod === 'GET' && qs.action === 'start') {
    return out(200, { url: authorizeUrl(redirectUri(), makeState(who.id)), redirectUri: redirectUri(), env: qboEnv() });
  }
  if (event.httpMethod === 'POST') {
    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) {}
    if (body.action === 'disconnect') {
      const tok = await loadTokens(); if (tok) await revoke(tok);
      try { await sb('app_settings?on_conflict=key', 'POST', { key: 'qbo_enabled', value: '0', updated_by: who.id, updated_at: new Date().toISOString() }); } catch (e) {}
      try { await sb('audit_log', 'POST', { action: 'qbo.disconnect', who: 'QuickBooks sync', detail: JSON.stringify({ realm: tok && tok.realm_id }), user_id: who.id }); } catch (e) {}
      return out(200, { ok: true });
    }
  }
  return out(400, { error: 'Unknown action' });
};
