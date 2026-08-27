// NIGHTLY AUTO-SYNC — runs at 2:00 AM Manila (18:00 UTC) every day.
// Triggers the Shopify → Supabase backfill (new orders, payment statuses,
// shipment tracking) so AR aging and the register are always fresh without
// anyone remembering to hit the URL. Also warms the sales cache.
// Requires: JOB_KEY in Netlify env (same key that guards the background jobs).

export default async () => {
  const base = process.env.URL || 'https://healthspan-inventory.netlify.app';
  const key = process.env.JOB_KEY || '';
  const results = {};
  try {
    const r = await fetch(base + '/.netlify/functions/backfill-background', {
      method: 'POST', headers: { 'x-job-key': key }
    });
    results.backfill = r.status;
  } catch (e) { results.backfill = 'error: ' + e.message; }
  try {
    const r = await fetch(base + '/.netlify/functions/shopify-build-background', {
      method: 'POST', headers: { 'x-job-key': key }
    });
    results.salesCache = r.status;
  } catch (e) { results.salesCache = 'error: ' + e.message; }
  console.log('nightly sync dispatched', JSON.stringify(results));
  return new Response(JSON.stringify(results), { status: 200 });
};

export const config = { schedule: '0 18 * * *' }; // 18:00 UTC = 2:00 AM Asia/Manila
