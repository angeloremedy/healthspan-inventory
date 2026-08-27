// WORKFLOW AUTOMATION RULES — the nightly sweep (triggered from nightly.mjs).
// Five rules, each deduped via auto_log (unique rule+entity, insert-ignore):
//  1. fulfilled order (~14d ago)      → follow-up task + ping for the owner
//  2. first-ever order (last 2 days)  → welcome-call task + ping for the owner
//  3. balance >60d past terms         → collection ping to finance + owner (monthly per account)
//  4. account gone dormant (60–90d)   → owner alert (monthly per account)
//  5. campaign/promo starts today     → ping sales + marketing
// Tasks land in Follow-ups & plans (visits status='planned'); pings hit the bell.
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_KEY || '';
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };

const manila = () => new Date(Date.now() + 8 * 3600e3);
const iso = d => d.toISOString().slice(0, 10);
const daysAgo = n => iso(new Date(manila().getTime() - n * 864e5));

async function q(path) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, { headers: H });
  if (!r.ok) throw new Error(path.split('?')[0] + ': HTTP ' + r.status);
  return r.json();
}
async function ins(table, rows, prefer) {
  if (!rows.length) return [];
  const r = await fetch(SB_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: { ...H, Prefer: prefer || 'return=representation' },
    body: JSON.stringify(rows)
  });
  if (!r.ok) throw new Error(table + ': HTTP ' + r.status + ' ' + (await r.text()).slice(0, 150));
  const t = await r.text();
  return t ? JSON.parse(t) : [];
}
// dedup gate: true = first time we've seen rule+entity
async function fresh(rule, entity) {
  const got = await ins('auto_log', [{ rule, entity: String(entity) }],
    'resolution=ignore-duplicates,return=representation');
  return got.length > 0;
}

export const handler = async (event) => {
  if ((event.headers['x-job-key'] || '') !== (process.env.JOB_KEY || 'x')) {
    return { statusCode: 403, body: 'nope' };
  }
  const today = iso(manila());
  const ym = today.slice(0, 7);
  const fired = { followup: 0, welcome: 0, collection: 0, dormant: 0, campaign: 0 };
  const errors = [];

  // shared lookups
  const profiles = await q('profiles?select=id,specialist_tag,role');
  const tag2uid = {};
  for (const p of profiles) if (p.specialist_tag) tag2uid[p.specialist_tag.toLowerCase()] = p.id;
  const accounts = await q('accounts?select=name,owner_tag&owner_tag=not.is.null');
  const owner = {}; for (const a of accounts) owner[a.name] = a.owner_tag;
  const ownerUid = name => tag2uid[String(owner[name] || '').toLowerCase()] || null;
  const notif = (target, kind, title, body, link) =>
    ins('notifications', [Object.assign({ kind, title, body, link }, target)], 'return=minimal');
  const task = async (name, type, note) => { // planned visit owned by the account's specialist
    const uid = ownerUid(name); if (!uid) return false;
    await ins('visits', [{ user_id: uid, spec: owner[name], account: name, date: today, type, notes: note, status: 'planned' }], 'return=minimal');
    return true;
  };

  // 1 · fulfilled ~14d ago → follow-up
  try {
    const os = await q("orders?select=id,num,account&status=eq.fulfilled&source=eq.native&deleted_at=is.null&date=lte." + daysAgo(14) + "&date=gte." + daysAgo(45));
    for (const o of os) {
      if (!(await fresh('followup', o.id))) continue;
      await task(o.account, 'Follow-up', 'Auto: post-delivery follow-up for HS-' + o.num);
      const uid = ownerUid(o.account);
      if (uid) await notif({ user_id: uid }, 'auto', 'Follow-up due: ' + o.account, 'HS-' + o.num + ' was fulfilled 2 weeks ago — how did it go? Anything running low?', '#/v/followups');
      fired.followup++;
    }
  } catch (e) { errors.push('followup: ' + e.message); }

  // 2 · first-ever order → welcome call
  try {
    const recent = await q("orders?select=id,num,account&source=eq.native&deleted_at=is.null&created_at=gte." + daysAgo(2));
    for (const o of recent) {
      const all = await q('orders?select=id&account=eq.' + encodeURIComponent(o.account) + '&deleted_at=is.null&status=neq.cancelled&limit=2');
      if (all.length !== 1) continue;
      if (!(await fresh('welcome', o.account))) continue;
      await task(o.account, 'Welcome call', 'Auto: first order (HS-' + o.num + ') — onboard them properly');
      const uid = ownerUid(o.account);
      if (uid) await notif({ user_id: uid }, 'auto', 'New account: ' + o.account, 'Their FIRST order just landed (HS-' + o.num + ') — schedule the welcome call', '#/v/followups');
      fired.welcome++;
    }
  } catch (e) { errors.push('welcome: ' + e.message); }

  // 3 · balance >60 days past terms → collection ping (monthly per account)
  try {
    const per = {};
    for (let page = 0; page < 10; page++) {
      const os = await q('orders?select=account,date,terms_days,balance&balance=gt.0&deleted_at=is.null&status=neq.cancelled&order=id&limit=1000&offset=' + page * 1000);
      for (const o of os) {
        const due = new Date(o.date).getTime() + ((o.terms_days || 0) + 60) * 864e5;
        if (due < manila().getTime()) per[o.account] = (per[o.account] || 0) + (o.balance || 0);
      }
      if (os.length < 1000) break;
    }
    for (const [name, amt] of Object.entries(per)) {
      if (!(await fresh('collection', name + '@' + ym))) continue;
      const body = name + ' — ₱' + Math.round(amt).toLocaleString() + ' is more than 60 days past terms';
      await notif({ role: 'finance' }, 'auto', 'Collection needed: ' + name, body, '#/v/ar');
      const uid = ownerUid(name);
      if (uid) await notif({ user_id: uid }, 'auto', 'Collection needed: ' + name, body + ' — follow up on your next visit', '#/v/ar');
      fired.collection++;
    }
  } catch (e) { errors.push('collection: ' + e.message); }

  // 4 · dormant: last activity 60–90 days ago (monthly per account)
  try {
    const last = {};
    for (let page = 0; page < 10; page++) {
      const os = await q('orders?select=account,date&deleted_at=is.null&status=neq.cancelled&date=gte.' + daysAgo(200) + '&order=id&limit=1000&offset=' + page * 1000);
      for (const o of os) if (!last[o.account] || o.date > last[o.account]) last[o.account] = o.date;
      if (os.length < 1000) break;
    }
    const vs = await q('visits?select=account,date&date=gte.' + daysAgo(200) + '&order=id&limit=1000');
    for (const v of vs) if (!last[v.account] || v.date > last[v.account]) last[v.account] = v.date;
    for (const [name, d] of Object.entries(last)) {
      if (!owner[name]) continue;
      if (d > daysAgo(60) || d < daysAgo(90)) continue; // only the 60–90d window
      if (!(await fresh('dormant', name + '@' + ym))) continue;
      const uid = ownerUid(name);
      if (uid) await notif({ user_id: uid }, 'auto', 'Going quiet: ' + name, 'No order or visit since ' + d + ' — reach out before they drift', '#/v/salesdue');
      fired.dormant++;
    }
  } catch (e) { errors.push('dormant: ' + e.message); }

  // 5 · campaign / promo starts today → sales + marketing
  try {
    const cs = await q('campaigns?select=id,name&from_date=eq.' + today);
    for (const c of cs) {
      if (!(await fresh('campaign', 'c' + c.id))) continue;
      await notif({ role: 'sales' }, 'auto', 'Campaign live: ' + c.name, 'Starts today — offer it on this week’s visits', '#/v/campaigns');
      await notif({ role: 'marketing' }, 'auto', 'Campaign live: ' + c.name, 'Started today — watch uptake in Sales overview', '#/v/campaigns');
      fired.campaign++;
    }
    const ps = await q('promos?select=id,name&start_date=eq.' + today + '&active=eq.true');
    for (const c of ps) {
      if (!(await fresh('campaign', 'p' + c.id))) continue;
      await notif({ role: 'sales' }, 'auto', 'Promo live: ' + c.name, 'Applies automatically at order entry from today', '#/v/promos');
      fired.campaign++;
    }
  } catch (e) { errors.push('campaign: ' + e.message); }

  // 6 · Monday weekly digest — per specialist + a team digest for managers/admin
  try {
    const dow = manila().getUTCDay(); // manila() is already +8, so UTC fields are Manila-local
    if (dow === 1) {
      const week = today; // Monday's date identifies the week
      const since = daysAgo(7);
      const os = await q('orders?select=spec,total,account&source=eq.native&deleted_at=is.null&status=neq.cancelled&created_at=gte.' + since);
      const vs = await q('visits?select=spec,status,outcome,fu_done,date&date=gte.' + since);
      const open = await q('visits?select=spec&or=(and(status.eq.planned),and(outcome.eq.Follow-up needed,fu_done.eq.false))&limit=1000');
      const agg = {};
      const T = t => String(t || '').toLowerCase();
      for (const o of os) { const k = T(o.spec); if (!k) continue; (agg[k] = agg[k] || { o: 0, v: 0, vis: 0, open: 0 }); agg[k].o++; agg[k].v += o.total || 0; }
      for (const v of vs) { const k = T(v.spec); if (!k) continue; (agg[k] = agg[k] || { o: 0, v: 0, vis: 0, open: 0 }); if (v.status !== 'planned') agg[k].vis++; }
      for (const v of open) { const k = T(v.spec); if (!k) continue; (agg[k] = agg[k] || { o: 0, v: 0, vis: 0, open: 0 }); agg[k].open++; }
      let tO = 0, tV = 0, tVis = 0;
      for (const p of profiles) {
        if (!p.specialist_tag) continue;
        const a = agg[T(p.specialist_tag)] || { o: 0, v: 0, vis: 0, open: 0 };
        tO += a.o; tV += a.v; tVis += a.vis;
        if (!(await fresh('digest', T(p.specialist_tag) + '@' + week))) continue;
        await notif({ user_id: p.id }, 'auto', 'Your week: ₱' + Math.round(a.v).toLocaleString() + ' booked',
          a.o + ' orders · ' + a.vis + ' visits logged · ' + a.open + ' open follow-ups waiting', '#/v/followups');
        fired.digest = (fired.digest || 0) + 1;
      }
      if (await fresh('digest', 'team@' + week)) {
        for (const role of ['manager', 'admin']) await notif({ role }, 'auto', 'Team week: ₱' + Math.round(tV).toLocaleString() + ' booked',
          tO + ' orders · ' + tVis + ' visits across the team — pace and coverage have the detail', '#/v/salespace');
        fired.digest = (fired.digest || 0) + 1;
      }
    }
  } catch (e) { errors.push('digest: ' + e.message); }

  console.log('automations', today, JSON.stringify(fired), errors.length ? 'errors: ' + JSON.stringify(errors) : 'clean');
  return { statusCode: 200, body: JSON.stringify({ ok: true, fired, errors }) };
};
