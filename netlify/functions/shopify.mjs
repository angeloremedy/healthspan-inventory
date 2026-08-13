// Serves the cached Shopify data (prices, deals, unit demand) to the dashboard.
// Triggers a background rebuild when the cache is missing, stale (>6h), or ?refresh=1.
import { getStore } from '@netlify/blobs';

export default async (req) => {
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
    try { await fetch(new URL('/.netlify/functions/shopify-build-background', url.origin), { method: 'POST' }); } catch (e) {}
  }

  if (data) return Response.json({ ...data, stale: ageH > 6, status });
  return Response.json({ building: true, status });
};

export const config = { path: '/api/shopify' };
