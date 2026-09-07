/* The 2026-09-08 audit fixes, server side. Run from the repo root:
     node tools/test/security-guard.test.mjs
   Covers lib/guard.mjs behaviour (fail closed, constant-time compare, Slack host
   check, session lookup) and source-level checks that every background worker,
   the question log, the upload reader and the user admin actually use them. */
import fs from 'node:fs';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + x : '')); };

// ── guard.mjs, live ─────────────────────────────────────────────────────────────
delete process.env.JOB_KEY;
const G = await import('../../netlify/functions/lib/guard.mjs');
let r = G.requireJobKey({ headers: { 'x-job-key': 'anything' } });
ok('no JOB_KEY in env → 503, never open', r && r.statusCode === 503, JSON.stringify(r));
ok('v2 flavour too', G.requireJobKeyReq(new Request('https://x/f?key=abc')).status === 503);
process.env.JOB_KEY = 'secret-key-1';
ok('wrong key → 403', G.requireJobKey({ headers: { 'x-job-key': 'x' } }).statusCode === 403);
ok('the old "x" default no longer opens anything', G.requireJobKey({ headers: { 'x-job-key': 'x' } }).statusCode === 403);
ok('empty header → 403', G.requireJobKey({ headers: {} }).statusCode === 403);
ok('right key in header → pass', G.requireJobKey({ headers: { 'x-job-key': 'secret-key-1' } }) === null);
ok('right key in ?key= → pass', G.requireJobKey({ headers: {}, queryStringParameters: { key: 'secret-key-1' } }) === null);
ok('v2: header pass, wrong fail', G.requireJobKeyReq(new Request('https://x/f', { headers: { 'x-job-key': 'secret-key-1' } })) === null && G.requireJobKeyReq(new Request('https://x/f?key=nope')).status === 403);
ok('safeEq: different lengths and empties are false', !G.safeEq('a', 'ab') && !G.safeEq('', '') && G.safeEq('abc', 'abc'));
ok('isSlackHook accepts only https://hooks.slack.com', G.isSlackHook('https://hooks.slack.com/commands/T1/B2/xyz') && !G.isSlackHook('https://evil.example/hooks.slack.com') && !G.isSlackHook('http://hooks.slack.com/x') && !G.isSlackHook('https://hooks.slack.com.evil.io/x') && !G.isSlackHook(''));

// sessionUser: fails closed without env, then resolves role/tag/super via a mocked Supabase
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY;
let u = await G.sessionUser({ headers: { authorization: 'Bearer t' } });
ok('sessionUser without Supabase env → 503 (not "allow")', u.code === 503);
process.env.SUPABASE_URL = 'https://sb.test'; process.env.SUPABASE_SERVICE_KEY = 'svc';
u = await G.sessionUser({ headers: {} });
ok('no token → 401', u.code === 401);
globalThis.fetch = async (url, opt) => {
  if (String(url).includes('/auth/v1/user')) { const t = (opt.headers.Authorization || '').replace('Bearer ', ''); return t === 'good' ? { ok: true, json: async () => ({ id: 'u-1', email: 'a@hs.ph' }) } : { ok: false, json: async () => ({}) }; }
  if (String(url).includes('/rest/v1/profiles')) return { ok: true, json: async () => [{ role: 'finance', specialist_tag: '', is_super: false, name: 'Tal' }] };
  return { ok: false, json: async () => ({}) };
};
u = await G.sessionUser({ headers: { authorization: 'Bearer bad' } });
ok('bad token → 401', u.code === 401);
u = await G.sessionUser({ headers: { Authorization: 'Bearer good' } });
ok('good token → id, role, name, super flag', u.id === 'u-1' && u.role === 'finance' && u.name === 'Tal' && u.super === false && !u.code, JSON.stringify(u));

// ── source checks: the gate is actually used ────────────────────────────────────
const F = f => fs.readFileSync('netlify/functions/' + f, 'utf8');
for (const f of ['automations-background.mjs', 'backup-background.mjs', 'backfill-background.mjs', 'shopify-build-background.mjs', 'qbo-sync-background.mjs', 'ask-work-background.mjs', 'stockbot-work-background.mjs']) {
  const s = F(f);
  ok(f + ' gates on requireJobKey', /requireJobKey\(event\)/.test(s) && /from '\.\/lib\/guard\.mjs'/.test(s) && !/JOB_KEY \|\| 'x'/.test(s) && !/if\s*\(\s*_?jk\s*\)\s*\{/.test(s));
}
ok('ask.mjs sends the key to its worker and forwards the caller id', /'x-job-key': process\.env\.JOB_KEY \|\| ''/.test(F('ask.mjs')) && /who: \{ \.\.\.who, uid: auth\.id/.test(F('ask.mjs')));
ok('ask.mjs: answers are readable only by the person who asked', /res\.uid && res\.uid !== auth\.id/.test(F('ask.mjs')) && /uid: String\(who\.uid/.test(F('ask-work-background.mjs')));
ok('ask.mjs auth fails closed (sessionUser)', /sessionUser\(event\)/.test(F('ask.mjs')) && !/don't brick the app/.test(F('ask.mjs')));
ok('stockbot dispatcher carries the key; the worker only posts to Slack', /'x-job-key': process\.env\.JOB_KEY/.test(F('stockbot.mjs')) && /isSlackHook\(response_url\)/.test(F('stockbot-work-background.mjs')));
ok('asklog: workers write with the key, admins read with a session', /requireJobKeyReq\(req\)/.test(F('asklog.mjs')) && /u\.super \|\| u\.role === 'admin'/.test(F('asklog.mjs')) && !/ASKLOG_KEY/.test(F('asklog.mjs')));
for (const f of ['refresh.mjs', 'shopify.mjs', 'visits.mjs']) ok(f + ' fails closed when Supabase env is missing', /code:\s*503/.test(F(f)) && !/don't brick the app/.test(F(f)));
ok('upload.mjs: the attachment lookup runs as the caller (RLS decides)', /Authorization: 'Bearer ' \+ who\._token/.test(F('upload.mjs')) && /u\._token = token/.test(F('upload.mjs')));
ok('admin-users: only the super admin resets another admin', /Only the super admin can reset another admin/.test(F('admin-users.mjs')) && /t\[0\]\.role === 'admin' \|\| t\[0\]\.is_super/.test(F('admin-users.mjs')));
ok('deck-to-drive: shares only with HQ accounts or the company domain', /hq\.has\(e\) \|\| \(myDom && e\.endsWith/.test(F('deck-to-drive.mjs')));
const bk = F('backup-background.mjs');
for (const t of ['fin_requests', 'fin_lines', 'serials', 'loans', 'waves', 'approval_routes', 'code_lists', 'review_snapshots', 'ask_chats', 'user_prefs', 'qbo_map', 'qbo_sync', 'auto_log', 'review_notes', 'review_commentary'])
  ok('backup covers ' + t, new RegExp('\\b' + t + ": '").test(bk));
ok('backup never exports qbo_tokens', !/qbo_tokens: '/.test(bk));
const toml = fs.readFileSync('netlify.toml', 'utf8');
ok('security headers present, CSP in report-only first', /X-Frame-Options = "DENY"/.test(toml) && /X-Content-Type-Options = "nosniff"/.test(toml) && /Content-Security-Policy-Report-Only = "default-src 'self'/.test(toml) && /connect-src 'self' https:\/\/lesjigujcajxurmsmwwc\.supabase\.co/.test(toml));
const sql = fs.readFileSync('SUPABASE-SETUP.md', 'utf8');
ok('SQL hardening block: hs_role(), accounts/opps/contacts, audit, notification link check', /create or replace function public\.hs_role\(\)/.test(sql) && /create policy "update accounts" on public\.accounts for update to authenticated\s+using \(public\.hs_role\(\) in/.test(sql) && /create policy "read audit" on public\.audit_log for select to authenticated\s+using \(public\.hs_role\(\) in \('super','admin'\)\)/.test(sql) && /notifications_link_route/.test(sql));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
