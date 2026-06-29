// This edge function just serves the pre-built cached JSON from Netlify Blobs.
// The actual Google Sheets fetch + processing happens in netlify/functions/refresh.mjs
// which runs on a schedule every 15 minutes.
import { getStore } from "@netlify/blobs";

export default async function handler(request, context) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const store = getStore('inventory');
    const cached = await store.get('latest', { type: 'json' });

    if (!cached) {
      return new Response(JSON.stringify({
        error: 'No cached data yet. The refresh function may not have run yet. Please wait up to 15 minutes or trigger a manual refresh.',
        products: [], batches: [], monthlyIn: {}, monthlyOut: {}, months: [],
        valueByLine: {}, cashExpiring: {}, expiringItems: [],
        branchTransfers: [], branchExpirySummary: {}, synced: null,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify(cached), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60', // browsers can cache for 60s
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Cache read error: ' + err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

export const config = { path: '/api/sync' };
