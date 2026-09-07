// QuickBooks sync — the background worker (15-minute runtime). Guarded by JOB_KEY
// like every other background job; started by qbo-schedule.mjs every 15 minutes
// and by "Sync now" on the QuickBooks page (through qbo-admin.mjs).
import { runSync } from './lib/qbo-sync.mjs';

export const handler = async (event) => {
  const jk = process.env.JOB_KEY || '';
  if (jk) {
    const q = (event.queryStringParameters && event.queryStringParameters.key) || '';
    const h = (event.headers && (event.headers['x-job-key'] || event.headers['X-Job-Key'])) || '';
    if (q !== jk && h !== jk) return { statusCode: 403, body: 'Forbidden — missing or wrong job key' };
  }
  let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) {}
  try { const S = await runSync({ by: body.by || 'schedule', force: !!body.force }); console.log('[qbo-sync]', S.mode, JSON.stringify({ inv: S.invoices, cm: S.creditmemos, pay: S.payments, errors: S.errors.length, ms: S.ms })); }
  catch (e) { console.error('[qbo-sync] failed', e); }
  return { statusCode: 202, body: '' };
};
