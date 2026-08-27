// Serves the cached Shopify data (prices, deals, unit demand) to the dashboard.
// Triggers a background rebuild when the cache is missing, stale (>6h), or ?refresh=1.
import { getStore } from '@netlify/blobs';

// ── AUTH: only signed-in Healthspan accounts may read the sales cache
async function requireUser(req) {
  const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const SVC = process.env.SUPABASE_SERVICE_KEY || '';
  if (!SB_URL || !SVC) return null; // lockdown env missing — don't brick the app
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { code: 401, error: 'Sign in required' };
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SVC, Authorization: 'Bearer ' + token } });
    if (!r.ok) return { code: 401, error: 'Session invalid — sign in again' };
    return null;
  } catch (e) { return { code: 401, error: 'Could not verify the session' }; }
}

export default async (req) => {
  const authFail = await requireUser(req);
  if (authFail) return Response.json({ error: authFail.error }, { status: authFail.code });

  let store;
  try { store = getStore('shopify'); }
  catch (e) { return Response.json({ error: 'storage unavailable: ' + e.message }, { status: 503 }); }

  const url = new URL(req.url);
  const force = url.searchParams.get('refresh') === '1';

  let data = null, status = null;
  try { data = await store.get('data', { type: 'json' }); } catch (e) {}
  try { status = await store.get('status', { type: 'json' }); } catch (e) {}

  const ageH = data ? (Date.now() - new Date(data.synced).getTime()) / 36e5 : Infinity;
  if (force || !data || ageH > 6) {
    // internal trigger authenticates with the job key so the build endpoint can stay locked
    try { await fetch(new URL('/.netlify/functions/shopify-build-background', url.origin), { method: 'POST', headers: { 'x-job-key': process.env.JOB_KEY || '' } }); } catch (e) {}
  }

  if (data) return Response.json({ ...data, stale: ageH > 6, status });
  return Response.json({ building: true, status });
};

export const config = { path: '/api/shopify' };
