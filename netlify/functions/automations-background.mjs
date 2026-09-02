// WORKFLOW AUTOMATION RULES — the nightly sweep (triggered from nightly.mjs).
// Eleven rules, each deduped via auto_log (unique rule+entity, insert-ignore):
//  1. fulfilled order (~14d ago)      → follow-up task + ping for the owner
//  2. first-ever order (last 2 days)  → welcome-call task + ping for the owner
//  3. balance >60d past terms         → collection ping to finance + owner (monthly per account)
//  4. account gone dormant (60–90d)   → owner alert (monthly per account)
//  5. campaign/promo starts today     → ping sales + marketing
//  6. Monday digest                   → per specialist + a team digest for managers
//  7. Monday next-best-action         → each specialist's 3 best calls
//  8. quote 'sent' 7+ days            → chase ping for the quote's specialist (once per quote)
//  9. birthday / clinic anniversary   → owner ping 3 days ahead (once per year)
// 10. the 1st of the month           → freeze-the-valuation nudge to finance + admin
// 11. loaner past its due-back date   → ping whoever checked the unit out
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
  const fired = { followup: 0, welcome: 0, collection: 0, dormant: 0, campaign: 0, digest: 0, nba: 0, quotechase: 0, occasion: 0, closenudge: 0 };
  const errors = [];

  // shared lookups
  const profiles = await q('profiles?select=id,specialist_tag,role');
  const tag2uid = {};
  for (const p of profiles) if (p.specialist_tag) tag2uid[p.specialist_tag.toLowerCase()] = p.id;
  const accounts = await q('accounts?select=name,owner_tag,tier&owner_tag=not.is.null');
  const owner = {}; const tier = {};
  for (const a of accounts) { owner[a.name] = a.owner_tag; tier[a.name] = a.tier || null; }
  const quietDays = name => tier[name] === 'A' ? 30 : tier[name] === 'B' ? 45 : 60; // cadence by tier
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
      const t = quietDays(name); // tiered cadence: A=30d, B=45d, C/untiered=60d
      if (d > daysAgo(t) || d < daysAgo(t + 30)) continue; // fire inside the t..t+30 window
      if (!(await fresh('dormant', name + '@' + ym))) continue;
      const uid = ownerUid(name);
      if (uid) await notif({ user_id: uid }, 'auto', 'Going quiet: ' + name + (tier[name] ? ' (tier ' + tier[name] + ')' : ''), 'No order or visit since ' + d + ' — a tier-' + (tier[name] || 'C') + ' account should be touched every ' + t + ' days', '#/v/salesdue');
      fired.dormant++;
    }
    globalThis._lastMap = last; // reused by rule 7
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
        for (const role of ['manager']) await notif({ role }, 'auto', 'Team week: ₱' + Math.round(tV).toLocaleString() + ' booked',
          tO + ' orders · ' + tVis + ' visits across the team — pace and coverage have the detail', '#/v/salespace');
        fired.digest = (fired.digest || 0) + 1;
      }
    }
  } catch (e) { errors.push('digest: ' + e.message); }

  // 7 · Monday next-best-action: each specialist's 3 highest-value quiet accounts
  try {
    const dow = manila().getUTCDay();
    if (dow === 1) {
      const last = globalThis._lastMap || {};
      // 180d booked value per account (native + migrated)
      const val = {};
      for (let page = 0; page < 10; page++) {
        const os = await q('orders?select=account,total&deleted_at=is.null&status=neq.cancelled&date=gte.' + daysAgo(180) + '&order=id&limit=1000&offset=' + page * 1000);
        for (const o of os) val[o.account] = (val[o.account] || 0) + (o.total || 0);
        if (os.length < 1000) break;
      }
      const perSpec = {};
      for (const [name, own] of Object.entries(owner)) {
        const d = last[name]; if (!d) continue;
        const quiet = Math.floor((manila().getTime() - new Date(d).getTime()) / 864e5);
        const t = quietDays(name);
        if (quiet <= t * 0.8) continue; // only accounts approaching or past their cadence
        const score = (val[name] || 0) * Math.min(3, quiet / t);
        (perSpec[own.toLowerCase()] = perSpec[own.toLowerCase()] || []).push({ name, quiet, v: val[name] || 0, score });
      }
      const key = process.env.ANTHROPIC_API_KEY;
      for (const p of profiles) {
        if (!p.specialist_tag) continue;
        const list = (perSpec[p.specialist_tag.toLowerCase()] || []).sort((a, b) => b.score - a.score).slice(0, 3);
        if (!list.length) continue;
        if (!(await fresh('nba', p.specialist_tag.toLowerCase() + '@' + today))) continue;
        let body = list.map((x, i) => (i + 1) + ') ' + x.name + ' — P' + Math.round(x.v).toLocaleString() + ' in 6mo, quiet ' + x.quiet + 'd').join(' · ');
        if (key) { // let the model phrase the nudge (fallback = the plain list)
          try {
            const r = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
              body: JSON.stringify({ model: process.env.STOCKBOT_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 200,
                system: 'You write ONE short, motivating sentence (max 30 words) telling a pharma sales specialist which clinics to visit this week and why. Peso values matter. No emojis, no preamble.',
                messages: [{ role: 'user', content: body }] })
            });
            const out = await r.json();
            const txt = ((out.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ') || '').trim();
            if (txt) body = txt + ' (' + list.map(x => x.name).join(', ') + ')';
          } catch (e) {}
        }
        await notif({ user_id: p.id }, 'auto', 'Your 3 best calls this week', body, '#/v/salesdue');
        fired.nba = (fired.nba || 0) + 1;
      }
    }
  } catch (e) { errors.push('nba: ' + e.message); }

  // 8 · quote sitting at 'sent' for 7+ days → chase it (owner only, once per quote)
  try {
    const qs = await q("quotes?select=id,num,account,spec,total,date,expiry&status=eq.sent&date=lte." + daysAgo(7) + "&date=gte." + daysAgo(120));
    for (const t of qs) {
      if (!(await fresh('quotechase', t.id))) continue;
      // the quote's own specialist if we know them, else whoever owns the account
      const uid = tag2uid[String(t.spec || '').toLowerCase()] || ownerUid(t.account);
      if (!uid) continue;
      const age = Math.floor((manila().getTime() - new Date(t.date).getTime()) / 864e5);
      const dead = t.expiry && t.expiry < today;
      await notif({ user_id: uid }, 'auto', 'Quote waiting: ' + t.account,
        'QT-' + String(1000 + Number(t.num)).slice(-4) + ' · ₱' + Math.round(t.total || 0).toLocaleString() + ' · sent ' + age + ' days ago' +
        (dead ? ' — the validity date has passed, requote or close it' : ' — chase it or mark it lost'), '#/v/quotes');
      fired.quotechase = (fired.quotechase || 0) + 1;
    }
  } catch (e) { errors.push('quotechase: ' + e.message); }

  // 9 · birthday / clinic anniversary — ping the owner 3 days ahead (month-day match, any year)
  try {
    const md = d => String(d || '').slice(5, 10); // MM-DD
    const soon = iso(new Date(manila().getTime() + 3 * 864e5));
    const dates = await q('accounts?select=name,owner_tag,birthday,anniversary&owner_tag=not.is.null&or=(birthday.not.is.null,anniversary.not.is.null)');
    for (const a of dates) {
      const uid = tag2uid[String(a.owner_tag || '').toLowerCase()];
      if (!uid) continue;
      for (const [field, label] of [['birthday', 'Birthday'], ['anniversary', 'Clinic anniversary']]) {
        if (!a[field] || md(a[field]) !== md(soon)) continue;
        if (!(await fresh('occasion', field + ':' + a.name + '@' + today.slice(0, 4))) ) continue; // once per year
        await notif({ user_id: uid }, 'auto', label + ' in 3 days: ' + a.name,
          md(soon).replace('-', '/') + ' — a greeting or a small gesture lands well; worth planning a visit around it', '#/v/customers');
        fired.occasion = (fired.occasion || 0) + 1;
      }
    }
  } catch (e) { errors.push('occasion: ' + e.message); }

  // 10 · month-end close nudge: on the 1st, remind finance + admin to freeze the
  //      month's inventory valuation and close the books once accounting signs off
  try {
    if (manila().getUTCDate() === 1) {
      const d = manila(); d.setUTCDate(0);                 // last day of last month
      const lastYm = iso(d).slice(0, 7);
      const snaps = await q('valuation_snapshots?select=month&month=eq.' + lastYm);
      if (!snaps.length && await fresh('closenudge', lastYm)) {
        for (const role of ['finance', 'admin']) {
          await notif({ role }, 'auto', 'Month-end: freeze ' + lastYm,
            lastYm + ' has no valuation snapshot yet. Freeze it on Landed cost & valuation before costs move, then close the period on the Cutover page once accounting signs off.',
            '#/v/valuation');
        }
        fired.closenudge = (fired.closenudge || 0) + 1;
      }
    }
  } catch (e) { errors.push('closenudge: ' + e.message); }

  // 11 · overdue loaners: a demo unit past its due-back date pings whoever
  //      checked it out — once per loan per due date, so a renegotiated due date
  //      pings again but nobody gets nagged nightly for the same lapse
  try {
    const od = await q('loans?select=id,serial,sku,account,due_date,out_by&status=eq.out&due_date=lt.' + today);
    for (const l of od) {
      if (!l.out_by) continue;
      if (!await fresh('loanover', l.id + ':' + l.due_date)) continue;
      await notif({ user_id: l.out_by }, 'auto', 'Loaner overdue: ' + l.serial,
        l.serial + ' (' + l.sku + ') was due back from ' + l.account + ' on ' + l.due_date +
        '. Collect it, extend the due date, or convert the demo to a sale.',
        '#/v/loans');
      fired.loanover = (fired.loanover || 0) + 1; // eslint-disable-line
    }
  } catch (e) { errors.push('loanover: ' + e.message); }

  console.log('automations', today, JSON.stringify(fired), errors.length ? 'errors: ' + JSON.stringify(errors) : 'clean');
  return { statusCode: 200, body: JSON.stringify({ ok: true, fired, errors }) };
};
