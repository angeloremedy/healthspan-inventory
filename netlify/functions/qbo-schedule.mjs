// Every 15 minutes: kick the QuickBooks sync worker. Cheap when nothing is
// connected or enabled — the worker checks both and returns in one query.
export default async () => {
  const base = process.env.URL || 'https://hq.healthspan.ph';
  try { const r = await fetch(base + '/.netlify/functions/qbo-sync-background', { method: 'POST', headers: { 'x-job-key': process.env.JOB_KEY || '', 'Content-Type': 'application/json' }, body: JSON.stringify({ by: 'schedule' }) }); return new Response('qbo-sync ' + r.status); }
  catch (e) { return new Response('qbo-sync error: ' + e.message, { status: 500 }); }
};
export const config = { schedule: '*/15 * * * *' };
