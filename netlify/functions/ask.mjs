// Ask AI dispatcher for the dashboard web app.
// POST { question, catalog, history } → hands the job to ask-work-background
//   (no timeout limits there) and returns { id } immediately.
// GET ?id=... → returns the finished { answer, model } / { error }, or { pending:true }.
import crypto from 'node:crypto';
import { connectLambda, getStore } from '@netlify/blobs';
import { llm, provider, hasKey, keysPresent, setProviderPref } from './lib/llm.mjs';

const HDRS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json'
};


// ── AUTH: only signed-in Healthspan accounts (session token verified with Supabase)
async function requireUser(event){
  const SB_URL=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const SVC=process.env.SUPABASE_SERVICE_KEY||'';
  if(!SB_URL||!SVC)return null; // lockdown env missing — don't brick the app
  const token=((event.headers&&(event.headers.authorization||event.headers.Authorization))||'').replace(/^Bearer\s+/i,'');
  if(!token)return{code:401,error:'Sign in required'};
  try{
    const r=await fetch(SB_URL+'/auth/v1/user',{headers:{apikey:SVC,Authorization:'Bearer '+token}});
    if(!r.ok)return{code:401,error:'Session invalid — sign in again'};
    const u=await r.json();
    try{
      const pr=await fetch(SB_URL+'/rest/v1/profiles?id=eq.'+u.id+'&select=role,specialist_tag,is_super',{headers:{apikey:SVC,Authorization:'Bearer '+SVC}});
      const prof=(await pr.json())[0]||{};
      return{ok:true,role:prof.is_super?'super':(prof.role||'viewer'),tag:prof.specialist_tag||''};
    }catch(e){return{ok:true,role:'viewer',tag:''};}
  }catch(e){return{code:401,error:'Could not verify the session'};}
}

export const handler = async (event) => {
  // Handler-style functions need the Blobs context wired in explicitly
  // (v2 functions get it automatically — this is the v1 equivalent).
  try { connectLambda(event); } catch (e) {}

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HDRS, body: '' };
  const auth=await requireUser(event);
  if(auth&&auth.code)return{statusCode:auth.code,headers:HDRS,body:JSON.stringify({error:auth.error})};
  const who=auth&&auth.ok?{role:auth.role,tag:auth.tag}:{role:'viewer',tag:''}; // server-derived — the client can't spoof it

  // ── Diagnostic: is the model door open? (manager/admin only) — one tiny call, timed
  if (event.httpMethod === 'GET' && event.queryStringParameters && event.queryStringParameters.diag) {
    if (!['admin', 'manager', 'super'].includes(who.role)) return { statusCode: 403, headers: HDRS, body: JSON.stringify({ error: 'Admin or sales manager only' }) };
    try { const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), SVC = process.env.SUPABASE_SERVICE_KEY || '';
      const r = await fetch(SB_URL + '/rest/v1/app_settings?select=value&key=eq.ai_provider', { headers: { apikey: SVC, Authorization: 'Bearer ' + SVC } }).then(x => x.json()); setProviderPref((r[0] || {}).value || ''); } catch (e) {}
    if (event.queryStringParameters.diag === 'keys') return { statusCode: 200, headers: HDRS, body: JSON.stringify({ provider: provider(), keys: keysPresent() }) };
    // ?provider=mistral tests THAT provider alone — no falling back, so the answer names the one you asked about
    const want = String(event.queryStringParameters.provider || '').toLowerCase(); if (want) setProviderPref(want);
    const t0 = Date.now();
    const out = hasKey() ? await llm({ system: 'Reply with exactly: OK', messages: [{ role: 'user', content: 'ping' }], maxTokens: 20, only: !!want }) : { text: '', model: '', provider: provider(), wanted: provider(), error: 'no API key configured for ' + provider() };
    return { statusCode: 200, headers: HDRS, body: JSON.stringify({ provider: out.provider, wanted: out.wanted || provider(), fellBack: !!out.fellBack, errors: out.errors || [], model: out.model, ms: Date.now() - t0, ok: !!out.text, reply: (out.text || '').slice(0, 60), error: out.error || '' }) };
  }

  // ── Poll for a result
  if (event.httpMethod === 'GET') {
    const id = (event.queryStringParameters && event.queryStringParameters.id) || '';
    if (!id || !/^[a-f0-9-]{10,40}$/.test(id)) return { statusCode: 400, headers: HDRS, body: JSON.stringify({ error: 'Bad id' }) };
    try {
      const store = getStore('ask');
      const res = await store.get('res-' + id, { type: 'json' });
      if (res) return { statusCode: 200, headers: HDRS, body: JSON.stringify(res) };
    } catch (e) {
      return { statusCode: 503, headers: HDRS, body: JSON.stringify({ error: 'Result storage unavailable: ' + e.message }) };
    }
    return { statusCode: 200, headers: HDRS, body: JSON.stringify({ pending: true }) };
  }

  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HDRS, body: JSON.stringify({ error: 'POST only' }) };

  // ── Dispatch a new question
  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (e) {}
  const question = String(payload.question || '').slice(0, 2000).trim();
  const catalog = String(payload.catalog || '').slice(0, 500000);
  if (!question) return { statusCode: 400, headers: HDRS, body: JSON.stringify({ error: 'No question' }) };
  if (!catalog) return { statusCode: 400, headers: HDRS, body: JSON.stringify({ error: 'No catalog - wait for the dashboard to finish syncing' }) };

  const id = crypto.randomUUID();
  const base = process.env.URL || ('https://' + event.headers.host);
  try {
    // Background functions ack with 202 immediately; the await is quick.
    const t = await fetch(base + '/.netlify/functions/ask-work-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, question, catalog, history: payload.history || [], who, mode: String(payload.mode || '').slice(0, 20) })
    });
    // a 404/5xx here means the worker never started — say so now instead of letting the UI poll into a timeout
    if (!t.ok && t.status !== 202) return { statusCode: 502, headers: HDRS, body: JSON.stringify({ error: 'The answer job did not start (worker returned ' + t.status + '). Check the ask-work-background function deploy.' }) };
  } catch (e) {
    return { statusCode: 502, headers: HDRS, body: JSON.stringify({ error: 'Could not start the answer job: ' + e.message }) };
  }
  return { statusCode: 200, headers: HDRS, body: JSON.stringify({ id }) };
};
