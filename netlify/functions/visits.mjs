// Field visit log — the first CRM brick.
// POST { spec, account, type, outcome, notes, date } → appends to Netlify Blobs
// GET  ?months=N → returns visits from the last N months (default 3, max 13)
// Storage: blob store "visits", one JSON array per month ("v-2026-08").
import { connectLambda, getStore } from '@netlify/blobs';

const HDRS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json'
};
const clean = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);


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
    return null;
  }catch(e){return{code:401,error:'Could not verify the session'};}
}

export const handler = async (event) => {
  try { connectLambda(event); } catch (e) {}
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HDRS, body: '' };
  const authFail=await requireUser(event);
  if(authFail)return{statusCode:authFail.code,headers:HDRS,body:JSON.stringify({error:authFail.error})};

  let store;
  try { store = getStore('visits'); }
  catch (e) { return { statusCode: 503, headers: HDRS, body: JSON.stringify({ error: 'Storage unavailable: ' + e.message }) }; }

  if (event.httpMethod === 'GET') {
    const n = Math.min(13, Math.max(1, parseInt((event.queryStringParameters || {}).months || '3', 10) || 3));
    const out = [];
    const now = new Date();
    for (let i = 0; i < n; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = 'v-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      try { const arr = await store.get(key, { type: 'json' }); if (Array.isArray(arr)) out.push(...arr); } catch (e) {}
    }
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return { statusCode: 200, headers: HDRS, body: JSON.stringify({ visits: out }) };
  }

  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HDRS, body: JSON.stringify({ error: 'POST or GET only' }) };

  let p = {};
  try { p = JSON.parse(event.body || '{}'); } catch (e) {}
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(p.date || '')) ? p.date : new Date().toISOString().slice(0, 10);
  const rec = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    date,
    ts: new Date().toISOString(),
    spec: clean(p.spec, 60),
    account: clean(p.account, 120),
    type: clean(p.type, 40),
    outcome: clean(p.outcome, 40),
    notes: clean(p.notes, 500)
  };
  if (!rec.spec || !rec.account) return { statusCode: 400, headers: HDRS, body: JSON.stringify({ error: 'Specialist and account are required' }) };

  const key = 'v-' + date.slice(0, 7);
  try {
    let arr = [];
    try { const got = await store.get(key, { type: 'json' }); if (Array.isArray(got)) arr = got; } catch (e) {} // missing month = fresh array
    if (arr.length >= 5000) return { statusCode: 429, headers: HDRS, body: JSON.stringify({ error: 'Month log is full' }) };
    arr.push(rec);
    await store.setJSON(key, arr);
  } catch (e) {
    return { statusCode: 503, headers: HDRS, body: JSON.stringify({ error: 'Could not save: ' + e.message }) };
  }
  return { statusCode: 200, headers: HDRS, body: JSON.stringify({ ok: true, visit: rec }) };
};
