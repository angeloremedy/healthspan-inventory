// In-app account management (admin only).
// The browser can't hold the service key, so this function does the privileged
// work — but ONLY after verifying the caller's own Supabase session belongs to
// a profile with role='admin'.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (already set for the backfill).
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_KEY || '';

const HDRS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json'
};
const out = (code, body) => ({ statusCode: code, headers: HDRS, body: JSON.stringify(body) });

async function svc(path, method, body) {
  const r = await fetch(SB_URL + path, {
    method: method || 'GET',
    headers: { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!r.ok) throw new Error((j && (j.msg || j.message || j.error_description)) || ('HTTP ' + r.status));
  return j;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HDRS, body: '' };
  if (event.httpMethod !== 'POST') return out(405, { error: 'POST only' });
  if (!SB_URL || !SVC) return out(500, { error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not set in Netlify env' });

  // ── verify the CALLER is an admin
  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return out(401, { error: 'Sign in first' });
  let caller;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SVC, Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error('bad session');
    caller = await r.json();
  } catch (e) { return out(401, { error: 'Session invalid — sign in again' }); }
  let callerName = caller.email || '';
  let callerSuper = false;
  try {
    const prof = await svc('/rest/v1/profiles?id=eq.' + caller.id + '&select=role,name,is_super');
    if (!prof || !prof[0] || prof[0].role !== 'admin') return out(403, { error: 'Admins only' });
    callerName = prof[0].name || callerName;
    callerSuper = !!prof[0].is_super;
  } catch (e) { return out(403, { error: 'Admins only' }); }
  // audit trail (best-effort; the table may not exist yet)
  const log = async (action, detail) => {
    try { await svc('/rest/v1/audit_log', 'POST', { user_id: caller.id, who: callerName, action, detail: JSON.stringify(detail || {}).slice(0, 900) }); } catch (e) {}
  };

  let p = {};
  try { p = JSON.parse(event.body || '{}'); } catch (e) {}
  const act = p.action;

  try {
    if (act === 'list') {
      const users = await svc('/auth/v1/admin/users?per_page=200');
      const profs = await svc('/rest/v1/profiles?select=id,name,role,specialist_tag');
      const pm = {}; for (const x of (profs || [])) pm[x.id] = x;
      const list = ((users && users.users) || []).map(u => ({
        id: u.id, email: u.email,
        name: (pm[u.id] && pm[u.id].name) || '',
        role: (pm[u.id] && pm[u.id].role) || '(no profile)',
        tag: (pm[u.id] && pm[u.id].specialist_tag) || '',
        last: u.last_sign_in_at || '',
        banned: !!(u.banned_until && new Date(u.banned_until) > new Date())
      })).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
      return out(200, { users: list });
    }
    if (act === 'create') {
      const { email, password, name, role, tag } = p;
      if (!email || !password || !name || !['admin','manager','sales','supply_chain','finance','marketing','viewer'].includes(role)) return out(400, { error: 'Need email, password, name, role' });
      if (password.length < 8) return out(400, { error: 'Password must be 8+ characters' });
      const u = await svc('/auth/v1/admin/users', 'POST', { email, password, email_confirm: true });
      await svc('/rest/v1/profiles', 'POST', { id: u.id, name, role, specialist_tag: tag || null });
      await log('user.create', { email, name, role, tag: tag || '' });
      return out(200, { ok: true, id: u.id });
    }
    if (act === 'update') {
      const { id, name, role, tag } = p;
      if (!id) return out(400, { error: 'Need id' });
      const patch = {};
      if (name != null) patch.name = name;
      if (role != null) { if (!['admin','manager','sales','supply_chain','finance','marketing','viewer'].includes(role)) return out(400, { error: 'Bad role' }); patch.role = role; }
      if (tag !== undefined) patch.specialist_tag = tag || null;
      await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + id, {
        method: 'PATCH', headers: { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' }, body: JSON.stringify(patch)
      });
      await log('user.update', { id: id.slice(0, 8), ...patch });
      return out(200, { ok: true });
    }
    if (act === 'password') {
      const { id, password } = p;
      if (!id || !password || password.length < 8) return out(400, { error: 'Need id and an 8+ character password' });
      await svc('/auth/v1/admin/users/' + id, 'PUT', { password });
      await log('user.password', { id: id.slice(0, 8) });
      return out(200, { ok: true });
    }
    if (act === 'delete') { // SUPER ADMIN ONLY: permanent removal of a login
      if (!callerSuper) return out(403, { error: 'Super admin only — deletion is reserved to Angelo' });
      const { id } = p;
      if (!id) return out(400, { error: 'Need id' });
      if (id === caller.id) return out(400, { error: 'You can’t delete your own account' });
      try {
        await svc('/rest/v1/profiles?id=eq.' + id, 'DELETE');
        const r = await fetch(SB_URL + '/auth/v1/admin/users/' + id, {
          method: 'DELETE', headers: { apikey: SVC, Authorization: 'Bearer ' + SVC }
        });
        if (!r.ok) {
          const t = await r.text();
          return out(400, { error: 'Could not delete — they likely have orders/visits on record (history is protected). Use disable instead. (' + t.slice(0, 120) + ')' });
        }
      } catch (e) {
        return out(400, { error: 'Could not delete — use disable instead: ' + String(e.message || e).slice(0, 150) });
      }
      await log('user.DELETE', { id: id.slice(0, 8) });
      return out(200, { ok: true });
    }
    if (act === 'disable' || act === 'enable') {
      const { id } = p;
      if (!id) return out(400, { error: 'Need id' });
      if (id === caller.id) return out(400, { error: 'You can’t disable your own account' });
      await svc('/auth/v1/admin/users/' + id, 'PUT', { ban_duration: act === 'disable' ? '876000h' : 'none' });
      await log('user.' + act, { id: id.slice(0, 8) });
      return out(200, { ok: true });
    }
    return out(400, { error: 'Unknown action' });
  } catch (e) {
    return out(500, { error: String(e.message || e) });
  }
};
