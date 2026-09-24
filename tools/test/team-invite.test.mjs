/* Team & access — adding people by invitation (2026-09-23). admin-users.mjs against a
   fake Supabase (Auth + PostgREST): create without a password sends an INVITE with the
   HQ redirect and writes the profile; send link re-invites someone who never accepted
   and sends a password-reset link to someone who has; a scoped PS-admin may only reach
   specialists; a plain admin cannot send a link to another admin. Run from the repo root. */
process.env.SUPABASE_URL = 'https://sb.test'; process.env.SUPABASE_SERVICE_KEY = 'svc'; process.env.URL = 'https://hq.healthspan.ph';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + x : '')); };
const U = (n) => '00000000-0000-4000-8000-00000000000' + n;
const DB = { profiles: [{ id: U(1), role: 'admin', is_super: true, name: 'Super' }, { id: U(2), role: 'admin', name: 'Other admin' }, { id: U(3), role: 'sales', name: 'PS' }, { id: U(4), role: 'viewer', can_manage_ps: true, name: 'IT' }, { id: U(5), role: 'finance', name: 'Fin' }],
  users: [{ id: U(1), email: 'super@x.ph', last_sign_in_at: '2026-09-01' }, { id: U(2), email: 'admin@x.ph', last_sign_in_at: '2026-09-01' }, { id: U(3), email: 'ps@x.ph', invited_at: '2026-09-20' }, { id: U(4), email: 'it@x.ph', last_sign_in_at: '2026-09-01' }, { id: U(5), email: 'fin@x.ph', email_confirmed_at: '2026-09-02', last_sign_in_at: '2026-09-02' }], sent: [], audit: [] };
const TOK = { 'tok-super': U(1), 'tok-admin': U(2), 'tok-it': U(4) };
globalThis.fetch = async (url, opt = {}) => {
  const u = new URL(url); const m = (opt.method || 'GET').toUpperCase(); const body = opt.body ? JSON.parse(opt.body) : null;
  const res = (s, b) => ({ ok: s < 300, status: s, text: async () => JSON.stringify(b), json: async () => b });
  const auth = (opt.headers || {}).Authorization || '';
  if (u.pathname === '/auth/v1/user') { const id = TOK[auth.replace('Bearer ', '')]; return id ? res(200, { id, email: 'x' }) : res(401, {}); }
  if (u.pathname === '/auth/v1/invite') { DB.sent.push({ kind: 'invite', email: body.email, redirect: u.searchParams.get('redirect_to') });
    const ex = DB.users.find(x => x.email === body.email); if (ex && (ex.email_confirmed_at || ex.last_sign_in_at)) return res(422, { msg: 'A user with this email address has already been registered' });
    const nu = ex || { id: '00000000-0000-4000-8000-0000000000' + (10 + DB.users.length), email: body.email, invited_at: 'now' }; if (!ex) DB.users.push(nu); return res(200, nu); }
  if (u.pathname === '/auth/v1/recover') { DB.sent.push({ kind: 'recovery', email: body.email, redirect: u.searchParams.get('redirect_to') }); return res(200, {}); }
  if (u.pathname === '/auth/v1/admin/users' && m === 'GET') return res(200, { users: DB.users });
  if (u.pathname.startsWith('/auth/v1/admin/users/') && m === 'GET') { const x = DB.users.find(y => y.id === u.pathname.split('/').pop()); return x ? res(200, x) : res(404, {}); }
  if (u.pathname === '/rest/v1/profiles') {
    if (m === 'POST') { DB.profiles.push(body); return res(201, [body]); }
    const id = (u.searchParams.get('id') || '').replace('eq.', ''); return res(200, id ? DB.profiles.filter(p => p.id === id) : DB.profiles);
  }
  if (u.pathname === '/rest/v1/audit_log') { DB.audit.push(body); return res(201, [body]); }
  return res(404, { msg: 'no route ' + u.pathname });
};
const { handler } = await import('../../netlify/functions/admin-users.mjs');
const call = async (tok, body) => { const r = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer ' + tok }, body: JSON.stringify(body) }); return { code: r.statusCode, j: JSON.parse(r.body || '{}') }; };

{ const r = await call('tok-admin', { action: 'create', email: ' New.Person@Healthspan.ph ', name: 'New Person', role: 'finance' });
  const inv = DB.sent.find(x => x.email === 'new.person@healthspan.ph');
  ok('create without a password → an invitation e-mail with the HQ redirect, e-mail lower-cased', r.code === 200 && r.j.invited === true && inv && inv.kind === 'invite' && inv.redirect === 'https://hq.healthspan.ph/', JSON.stringify([r, inv]));
  ok('…and the profile is written with the chosen role', DB.profiles.some(p => p.id === r.j.id && p.role === 'finance' && p.name === 'New Person'));
  ok('…audited as user.invite', DB.audit.some(a => a.action === 'user.invite')); }
{ const r = await call('tok-admin', { action: 'create', email: 'fin@x.ph', name: 'Dup', role: 'finance' });
  ok('an e-mail that already has an account → a plain message, no second account', r.code === 400 && /already has an HQ account/.test(r.j.error), JSON.stringify(r)); }
{ const r = await call('tok-admin', { action: 'create', email: 'not-an-email', name: 'X', role: 'sales' });
  ok('a malformed e-mail is refused before Supabase is asked', r.code === 400 && /not an e-mail/.test(r.j.error)); }
{ const r = await call('tok-admin', { action: 'create', email: 'pw@x.ph', name: 'PW', role: 'sales', password: 'short' });
  ok('the legacy starter-password path still checks the length', r.code === 400 && /8\+/.test(r.j.error)); }
{ DB.sent.length = 0; const r = await call('tok-admin', { action: 'link', id: U(3) });
  ok('send link to someone who never accepted → a fresh invitation', r.code === 200 && r.j.kind === 'invite' && DB.sent[0].kind === 'invite' && DB.sent[0].email === 'ps@x.ph', JSON.stringify([r, DB.sent])); }
{ DB.sent.length = 0; const r = await call('tok-admin', { action: 'link', id: U(5) });
  ok('send link to someone who has signed in → a password-reset e-mail', r.code === 200 && r.j.kind === 'recovery' && DB.sent[0].kind === 'recovery'); }
{ const r = await call('tok-admin', { action: 'link', id: U(1) });
  ok('nobody but the super admin touches the super admin', r.code === 403 && /protected/.test(r.j.error)); }
{ DB.profiles.push({ id: U(6), role: 'admin', name: 'Third admin' }); DB.users.push({ id: U(6), email: 'a3@x.ph', last_sign_in_at: '2026-09-01' });
  const r = await call('tok-admin', { action: 'link', id: U(6) });
  ok('a plain admin cannot send a password link to another admin', r.code === 403 && /super admin/.test(r.j.error), JSON.stringify(r));
  const s = await call('tok-super', { action: 'link', id: U(6) });
  ok('…the super admin can', s.code === 200); }
{ const r1 = await call('tok-it', { action: 'link', id: U(3) }); const r2 = await call('tok-it', { action: 'link', id: U(5) });
  ok('the IT (specialist-accounts) role may send links to specialists only', r1.code === 200 && r2.code === 403, JSON.stringify([r1.code, r2.code]));
  const r3 = await call('tok-it', { action: 'create', email: 'ps2@x.ph', name: 'PS2', role: 'finance' });
  ok('…and may invite specialists only', r3.code === 403); }
{ const r = await call('tok-admin', { action: 'list' });
  const ps = r.j.users.find(u => u.email === 'ps@x.ph'), fin = r.j.users.find(u => u.email === 'fin@x.ph');
  ok('list marks who is invited but has not set a password yet', ps && ps.invited === true && fin && fin.invited === false); }
console.log('\n' + pass + '/' + (pass + fail) + ' passed'); process.exit(fail ? 1 : 0);
