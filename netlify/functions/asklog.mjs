// Question log for the inventory bot (web + Slack).
// POST /api/asklog  { src, q, ok, model, ms }  — appends to today's log
// GET  /api/asklog?days=7                      — returns recent logs as JSON
import { getStore } from '@netlify/blobs';
import { requireJobKeyReq, sessionUser } from './lib/guard.mjs';

export default async (req) => {
  let store;
  try { store = getStore('asklog'); }
  catch (e) { return Response.json({ error: 'Log storage unavailable: ' + e.message }, { status: 503 }); }

  // Writers are the two answer workers (they carry the JOB_KEY). Readers must be a
  // signed-in admin — the log holds every question staff asked.
  if (req.method === 'POST') { const gate = requireJobKeyReq(req); if (gate) return gate; }
  else {
    const u = await sessionUser({ headers: { authorization: req.headers.get('authorization') || '' } });
    if (u.code) return Response.json({ error: u.error }, { status: u.code });
    if (!(u.super || u.role === 'admin')) return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  if (req.method === 'POST') {
    let e = {};
    try { e = await req.json(); } catch (err) {}
    const day = new Date().toISOString().slice(0, 10);
    const key = 'log-' + day;
    let cur = [];
    try { cur = (await store.get(key, { type: 'json' })) || []; } catch (err) {}
    cur.push({
      ts: new Date().toISOString(),
      src: String(e.src || '').slice(0, 20),
      q: String(e.q || '').slice(0, 500),
      ok: !!e.ok,
      model: String(e.model || '').slice(0, 60),
      ms: Number(e.ms) || 0
    });
    await store.setJSON(key, cur.slice(-500)); // keep at most 500/day
    return new Response('ok');
  }

  // GET: recent days
  const url = new URL(req.url);
  const days = Math.min(14, Math.max(1, parseInt(url.searchParams.get('days') || '7', 10)));
  const out = {};
  let total = 0, failed = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    let v = null;
    try { v = await store.get('log-' + d, { type: 'json' }); } catch (err) {}
    if (v && v.length) {
      out[d] = v;
      total += v.length;
      failed += v.filter(x => !x.ok).length;
    }
  }
  return Response.json({ summary: { days, questions: total, failed }, logs: out });
};

export const config = { path: '/api/asklog' };
