// In-app account management (admin only).
// The browser can't hold the service key, so this function does the privileged
// work — but ONLY after verifying the caller's own Supabase session belongs to
// a profile with role='admin'.
// Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (already set for the backfill).
// New people are INVITED (2026-09-23): Supabase e-mails them a link to set their own
// password, which lands on HQ (URL, or HQ_AUTH_REDIRECT) where the app asks for the
// password. `link` sends a fresh one — a new invitation while they have never
// accepted, a password-reset link after. Needs Supabase Auth → URL configuration to
// allow the HQ URL, and custom SMTP (the default sender only mails project members).
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_KEY || '';

const HDRS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json'
};
const out = (code, body) => ({ statusCode: code, headers: HDRS, body: JSON.stringify(body) });
// where the invitation / password link sends people back to — never the Host header
const authRedirect = () => (process.env.HQ_AUTH_REDIRECT || process.env.URL || 'https://hq.healthspan.ph').replace(/\/$/, '') + '/';
const gotrueError = (t) => { let j = null; try { j = JSON.parse(t); } catch (e) {} const m = (j && (j.msg || j.message || j.error_description || j.error)) || String(t || '').slice(0, 160);
  if (/already been registered|already registered|exists/i.test(m)) return 'That e-mail already has an HQ account — use send link on their row.';
  if (/rate limit/i.test(m)) return 'Supabase is rate-limiting e-mails — wait a minute and try again (custom SMTP lifts the limit).';
  if (/smtp|sending|mail/i.test(m)) return 'Supabase could not send the e-mail: ' + m + ' — check Auth → SMTP settings.';
  return m; };

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
  let callerSuper = false, callerScoped = false;
  try {
    const prof = await svc('/rest/v1/profiles?id=eq.' + caller.id + '&select=role,name,is_super,can_manage_ps');
    const isAdmin = prof && prof[0] && prof[0].role === 'admin';
    const isScoped = prof && prof[0] && !!prof[0].can_manage_ps; // e.g. Justine: PS accounts only
    if (!isAdmin && !isScoped) return out(403, { error: 'Admins only' });
    callerName = (prof[0] && prof[0].name) || callerName;
    callerSuper = !!(prof[0] && prof[0].is_super);
    callerScoped = !isAdmin;
  } catch (e) { return out(403, { error: 'Admins only' }); }
  // audit trail (best-effort; the table may not exist yet)
  const log = async (action, detail) => {
    try { await svc('/rest/v1/audit_log', 'POST', { user_id: caller.id, who: callerName, action, detail: JSON.stringify(detail || {}).slice(0, 900) }); } catch (e) {}
  };

  let p = {};
  try { p = JSON.parse(event.body || '{}'); } catch (e) {}
  const act = p.action;
  // a target id is a UUID or nothing: it is spliced into PostgREST filters and GoTrue
  // paths below, and a crafted value could otherwise add its own &select=… to the
  // protective lookups or walk the path (audit 2026-09-17)
  if (p.id != null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(p.id))) return out(400, { error: 'Bad id' });

  // ── scoped PS-admin (can_manage_ps): only list/create/disable/enable, and only specialists
  if (callerScoped) {
    if (!['list', 'create', 'disable', 'enable', 'link'].includes(act)) return out(403, { error: 'Your access covers product-specialist accounts only' });
    if (act === 'create' && p.role !== 'sales') return out(403, { error: 'You can only create product-specialist (sales) accounts' });
    if ((act === 'disable' || act === 'enable' || act === 'link') && p.id) {
      try {
        const t = await svc('/rest/v1/profiles?id=eq.' + p.id + '&select=role');
        if (!t || !t[0] || t[0].role !== 'sales') return out(403, { error: 'You can only disable/enable product-specialist accounts' });
      } catch (e) { return out(403, { error: 'Target check failed' }); }
    }
  }

  // ── SUPER ADMIN PROTECTION: nobody may disable, delete, demote, or reset the
  // password of the super admin account except the super admin themself.
  if (['disable', 'delete', 'password', 'update', 'link'].includes(act) && p.id && p.id !== caller.id) {
    try {
      const t = await svc('/rest/v1/profiles?id=eq.' + p.id + '&select=is_super');
      if (t && t[0] && t[0].is_super) {
        await log('user.PROTECTED', { attempted: act, target: p.id.slice(0, 8) });
        return out(403, { error: 'The super admin account is protected — only Angelo can modify it.' });
      }
    } catch (e) {}
  }

  try {
    if (act === 'list') {
      const users = await svc('/auth/v1/admin/users?per_page=200');
      let profs = await svc('/rest/v1/profiles?select=id,name,role,specialist_tag,is_super,can_manage_ps,team,sort_order,view_grants,view_denies');
      if (!Array.isArray(profs)) profs = await svc('/rest/v1/profiles?select=id,name,role,specialist_tag,is_super,can_manage_ps,team,sort_order'); // before the page-access SQL
      const pm = {}; for (const x of (profs || [])) pm[x.id] = x;
      const list = ((users && users.users) || []).map(u => ({
        id: u.id, email: u.email,
        name: (pm[u.id] && pm[u.id].name) || '',
        role: (pm[u.id] && pm[u.id].role) || '(no profile)',
        tag: (pm[u.id] && pm[u.id].specialist_tag) || '',
        team: (pm[u.id] && pm[u.id].team) || '',
        order: (pm[u.id] && pm[u.id].sort_order != null) ? pm[u.id].sort_order : '',
        is_super: !!(pm[u.id] && pm[u.id].is_super),
        ps: !!(pm[u.id] && pm[u.id].can_manage_ps),
        grants: (pm[u.id] && pm[u.id].view_grants) || [], denies: (pm[u.id] && pm[u.id].view_denies) || [],
        last: u.last_sign_in_at || '',
        invited: !u.last_sign_in_at && !u.email_confirmed_at && !!u.invited_at, // invited, has not set a password yet
        banned: !!(u.banned_until && new Date(u.banned_until) > new Date())
      })).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
      return out(200, { users: list });
    }
    if (act === 'create') {
      const { password, name, role, tag, team } = p;
      const email = String(p.email || '').trim().toLowerCase();
      if (!email || !name || !['admin','manager','sales','supply_chain','finance','marketing','viewer'].includes(role)) return out(400, { error: 'Need e-mail, name and role' });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return out(400, { error: 'That is not an e-mail address' });
      let u;
      if (password) { // legacy path: a starter password set by the admin
        if (String(password).length < 8) return out(400, { error: 'Password must be 8+ characters' });
        u = await svc('/auth/v1/admin/users', 'POST', { email, password, email_confirm: true });
      } else {        // the default: Supabase e-mails an invitation; they set their own password
        const r = await fetch(SB_URL + '/auth/v1/invite?redirect_to=' + encodeURIComponent(authRedirect()), { method: 'POST', headers: { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, data: { name } }) });
        const t = await r.text(); if (!r.ok) return out(400, { error: gotrueError(t) });
        try { u = JSON.parse(t); } catch (e) { u = null; }
        if (!u || !u.id) return out(502, { error: 'Supabase did not return the new account' });
      }
      // can_manage_ps (the "IT" role): admin callers only; scoped callers can never grant it
      const ps = !callerScoped && role === 'viewer' && !!p.can_manage_ps;
      await svc('/rest/v1/profiles', 'POST', { id: u.id, name, role, specialist_tag: tag || null, can_manage_ps: ps, team: (tag && team) ? String(team).trim() : null });
      await log(password ? 'user.create' : 'user.invite', { email, name, role, tag: tag || '' });
      return out(200, { ok: true, id: u.id, invited: !password });
    }
    if (act === 'update') {
      const { id, name, role, tag, team, order } = p;
      if (!id) return out(400, { error: 'Need id' });
      // an admin may reshape staff access, never another admin's (super admin only) — same rule as passwords
      if (id !== caller.id && !callerSuper && (role != null || p.email != null || p.grants !== undefined || p.denies !== undefined)) {
        try { const t = await svc('/rest/v1/profiles?id=eq.' + id + '&select=role,is_super');
          if (t && t[0] && (t[0].role === 'admin' || t[0].is_super)) { await log('user.PROTECTED', { attempted: 'update', target: id.slice(0, 8) }); return out(403, { error: 'Only the super admin can change another admin’s role, email or page access.' }); }
        } catch (e) { return out(403, { error: 'Target check failed' }); }
      }
      // e-mail lives in Auth, not profiles
      if (p.email != null) {
        const em = String(p.email).trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return out(400, { error: 'That is not an e-mail address' });
        const r = await fetch(SB_URL + '/auth/v1/admin/users/' + id, { method: 'PUT', headers: { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, email_confirm: true }) });
        if (!r.ok) { const t = await r.text(); return out(400, { error: /already/i.test(t) ? 'That e-mail is already used by another account' : ('Auth refused the e-mail change: ' + t.slice(0, 160)) }); }
        await log('user.email', { id: id.slice(0, 8), email: em });
      }
      const patch = {};
      // per-person page overrides: grant a page the role lacks, or deny one it has.
      // Cost and system pages are never grantable — those rules are the company's, not the admin's.
      const NEVER_GRANT = ['valuation', 'poscore', 'qbo', 'users', 'audit', 'cutover', 'archive', 'numbering', 'routes', 'codelists', 'commissions', 'payments'];
      const cleanViews = (a) => Array.isArray(a) ? [...new Set(a.map(v => String(v || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)).filter(Boolean))].slice(0, 200) : [];
      if (p.grants !== undefined) patch.view_grants = cleanViews(p.grants).filter(v => !NEVER_GRANT.includes(v));
      if (p.denies !== undefined) patch.view_denies = cleanViews(p.denies);
      if (team !== undefined) patch.team = String(team || '').trim() || null;
      if (order !== undefined) { const n = parseInt(order, 10); patch.sort_order = isNaN(n) ? null : n; }
      if (name != null) patch.name = name;
      if (role != null) { if (!['admin','manager','sales','supply_chain','finance','marketing','viewer'].includes(role)) return out(400, { error: 'Bad role' }); patch.role = role; }
      if (tag !== undefined) patch.specialist_tag = tag || null;
      if (p.can_manage_ps !== undefined && !callerScoped) patch.can_manage_ps = !!p.can_manage_ps && (role == null || role === 'viewer');
      if (Object.keys(patch).length) {
        const pr = await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + id, {
          method: 'PATCH', headers: { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(patch)
        });
        if (!pr.ok) { const t = await pr.text(); return out(400, { error: /view_grants|view_denies/.test(t) ? 'Run the page-access SQL from SUPABASE-SETUP.md first (profiles.view_grants / view_denies).' : ('Could not save the profile: ' + t.slice(0, 160)) }); }
        await log('user.update', { id: id.slice(0, 8), ...patch });
      }
      return out(200, { ok: true });
    }
    if (act === 'password') {
      const { id, password } = p;
      if (!id || !password || password.length < 8) return out(400, { error: 'Need id and an 8+ character password' });
      // an admin may reset staff passwords, never another admin's — that would be
      // a quiet account takeover. Only the super admin resets an admin.
      if (id !== caller.id && !callerSuper) {
        try { const t = await svc('/rest/v1/profiles?id=eq.' + id + '&select=role,is_super');
          if (t && t[0] && (t[0].role === 'admin' || t[0].is_super)) { await log('user.PROTECTED', { attempted: 'password', target: id.slice(0, 8) }); return out(403, { error: 'Only the super admin can reset another admin’s password.' }); }
        } catch (e) { return out(403, { error: 'Target check failed' }); }
      }
      await svc('/auth/v1/admin/users/' + id, 'PUT', { password });
      await log('user.password', { id: id.slice(0, 8) });
      return out(200, { ok: true });
    }
    if (act === 'link') {
      const { id } = p;
      if (!id) return out(400, { error: 'Need id' });
      // same rule as setting a password: another admin's account is the super admin's to touch
      if (id !== caller.id && !callerSuper) {
        try { const t = await svc('/rest/v1/profiles?id=eq.' + id + '&select=role,is_super');
          if (t && t[0] && (t[0].role === 'admin' || t[0].is_super)) { await log('user.PROTECTED', { attempted: 'link', target: id.slice(0, 8) }); return out(403, { error: 'Only the super admin can send a password link to another admin.' }); }
        } catch (e) { return out(403, { error: 'Target check failed' }); }
      }
      const u = await svc('/auth/v1/admin/users/' + id);
      if (!u || !u.email) return out(404, { error: 'No such account' });
      const never = !u.last_sign_in_at && !u.email_confirmed_at;
      const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
      const r = never
        ? await fetch(SB_URL + '/auth/v1/invite?redirect_to=' + encodeURIComponent(authRedirect()), { method: 'POST', headers: H, body: JSON.stringify({ email: u.email }) })
        : await fetch(SB_URL + '/auth/v1/recover?redirect_to=' + encodeURIComponent(authRedirect()), { method: 'POST', headers: H, body: JSON.stringify({ email: u.email }) });
      if (!r.ok) return out(400, { error: gotrueError(await r.text()) });
      await log('user.link', { id: id.slice(0, 8), kind: never ? 'invite' : 'recovery' });
      return out(200, { ok: true, kind: never ? 'invite' : 'recovery' });
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
