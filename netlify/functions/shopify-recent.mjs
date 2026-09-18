// Every 15 minutes: import the Shopify orders changed in the last two days
// (backfill-background in `recent` mode) so HQ — and QuickBooks through HQ — sees a
// new or edited Shopify order within minutes. The full nightly import stays in
// nightly.mjs. Cheap: one small Shopify query when nothing changed.
export default async () => {
  const base = process.env.URL || 'https://hq.healthspan.ph'; // never the Host header
  try { const r = await fetch(base + '/.netlify/functions/backfill-background?recent=1', { method: 'POST', headers: { 'x-job-key': process.env.JOB_KEY || '', 'Content-Type': 'application/json' }, body: JSON.stringify({ recent: true, by: 'schedule' }) }); return new Response('shopify-recent ' + r.status); }
  catch (e) { return new Response('shopify-recent error: ' + e.message, { status: 500 }); }
};
export const config = { schedule: '5,20,35,50 * * * *' }; // offset from qbo-schedule (*/15) so the import lands before the QuickBooks pass
