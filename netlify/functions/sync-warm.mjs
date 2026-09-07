// SYNC WARMER — every 15 minutes, read the whole Google Sheets feed once and park
// the result in Netlify Blobs (store 'sync', key 'data'). /api/sync (refresh.mjs)
// serves that snapshot to every page load instead of hitting Sheets itself, so
// opening the app costs one blob read (~100 ms) rather than ~10 sequential Sheets
// calls. The Refresh button sends ?force=1 and still reads Sheets live.
//
// Scheduled functions are invoked by Netlify with no request body and no auth;
// the `config.schedule` export below is all it takes — nothing in netlify.toml.
// Requires: GOOGLE_API_KEY (same variable refresh.mjs already reads). Never throws:
// a failed run is logged and the previous snapshot stays in place.
import { getStore } from '@netlify/blobs';
import { buildSnapshot } from './refresh.mjs';

export default async (req) => {
  const KEY = process.env.GOOGLE_API_KEY || '';
  if (!KEY) {
    console.log('[sync-warm] GOOGLE_API_KEY not set — nothing to warm');
    return new Response('GOOGLE_API_KEY not set', { status: 500 });
  }
  const t0 = Date.now();
  try {
    const data = await buildSnapshot(KEY);
    let stored = false;
    try { await getStore('sync').setJSON('data', data); stored = true; }
    catch (e) { console.log('[sync-warm] blobs unavailable: ' + e.message); }
    console.log('[sync-warm] ' + (stored ? 'snapshot stored' : 'built but NOT stored') + ' — ' + data.products.length + ' products, ' + data.elapsed + 's sheets, ' + ((Date.now() - t0) / 1000).toFixed(1) + 's total');
    return new Response(stored ? 'ok' : 'built but not stored', { status: stored ? 200 : 500 });
  } catch (e) {
    console.log('[sync-warm] FAILED after ' + ((Date.now() - t0) / 1000).toFixed(1) + 's: ' + (e && e.message || e));
    return new Response('failed: ' + (e && e.message || e), { status: 500 });
  }
};

export const config = { schedule: '*/15 * * * *' };
