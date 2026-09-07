// Scheduled reports: every day at 22:00 UTC = 6:00 AM Manila, run each saved
// report whose schedule falls due today (daily / weekly on a weekday / monthly on
// a day or the last day). Each runs as its owner; results land in Blobs with a
// report_runs row and a bell notification. Scheduled functions are invoked by
// Netlify only — they have no public URL.
import { dueReports, runSavedReport } from './lib/report-runner.mjs';
export default async () => {
  const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  let ran = 0, failed = 0;
  try {
    for (const r of await dueReports(today)) {
      try { const x = await runSavedReport(r.id, null); if (x.run.status === 'ok') ran++; else failed++; } catch (e) { failed++; console.log('[reports] ' + r.name + ': ' + e.message); }
    }
  } catch (e) { console.log('[reports] ' + e.message); }
  return new Response('reports ' + today + ' ran=' + ran + ' failed=' + failed);
};
export const config = { schedule: '0 22 * * *' };
