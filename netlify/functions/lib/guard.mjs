// Shared gates for the Netlify functions. Two rules, applied everywhere:
//   1. FAIL CLOSED. A missing env var means "refuse", never "let everyone in".
//   2. Compare secrets in constant time.
//
//   requireJobKey(event)  → null when the caller carries the JOB_KEY (header
//                            x-job-key or ?key=), otherwise a ready-made response.
//   sessionUser(event)    → { id, email, role, tag, super } for a valid Supabase
//                            session, or { code, error } to return as-is.
//   isSlackHook(url)      → only Slack's own response_url hosts.
import crypto from 'node:crypto';

export function safeEq(a, b) {
  const A = Buffer.from(String(a || ''), 'utf8'), B = Buffer.from(String(b || ''), 'utf8');
  if (A.length !== B.length || A.length === 0) return false;
  return crypto.timingSafeEqual(A, B);
}

export function requireJobKey(event) {
  const jk = process.env.JOB_KEY || '';
  if (!jk) return { statusCode: 503, body: 'JOB_KEY is not set in the Netlify environment — background jobs stay closed until it is' };
  const h = event && event.headers ? (event.headers['x-job-key'] || event.headers['X-Job-Key'] || '') : '';
  const q = event && event.queryStringParameters ? (event.queryStringParameters.key || '') : '';
  if (safeEq(h, jk) || safeEq(q, jk)) return null;
  return { statusCode: 403, body: 'Forbidden — missing or wrong job key' };
}

// v2 (Request) flavour of the same gate
export function requireJobKeyReq(req) {
  const jk = process.env.JOB_KEY || '';
  if (!jk) return new Response('JOB_KEY is not set', { status: 503 });
  let q = ''; try { q = new URL(req.url).searchParams.get('key') || ''; } catch (e) {}
  const h = req.headers.get('x-job-key') || '';
  if (safeEq(h, jk) || safeEq(q, jk)) return null;
  return new Response('Forbidden', { status: 403 });
}

export async function sessionUser(event) {
  const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const SVC = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SB_URL || !SVC) return { code: 503, error: 'Auth is not configured on the server' };
  const raw = event && event.headers ? (event.headers.authorization || event.headers.Authorization || '') : '';
  const token = String(raw).replace(/^Bearer\s+/i, '');
  if (!token) return { code: 401, error: 'Sign in required' };
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SVC, Authorization: 'Bearer ' + token } });
    if (!r.ok) return { code: 401, error: 'Session invalid — sign in again' };
    const u = await r.json();
    let prof = {};
    try {
      const pr = await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(u.id) + '&select=role,specialist_tag,is_super,name', { headers: { apikey: SVC, Authorization: 'Bearer ' + SVC } });
      prof = (await pr.json())[0] || {};
    } catch (e) {}
    return { id: u.id, email: u.email || '', name: prof.name || '', role: prof.role || 'viewer', tag: prof.specialist_tag || '', super: !!prof.is_super };
  } catch (e) { return { code: 401, error: 'Could not verify the session' }; }
}

export function isSlackHook(url) {
  try { const u = new URL(String(url || '')); return u.protocol === 'https:' && u.hostname === 'hooks.slack.com'; } catch (e) { return false; }
}
