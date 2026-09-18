// QuickBooks shadow reconciliation — the background worker (15-minute runtime).
// Guarded by JOB_KEY like every other background job; started by "Reconcile now" on
// the QuickBooks page (through qbo-admin.mjs) and nightly by nightly.mjs. Reads
// QuickBooks, writes nothing there. See lib/qbo-reconcile.mjs.
import { connectLambda } from '@netlify/blobs';
import { runReconcile } from './lib/qbo-reconcile.mjs';
import { requireJobKey } from './lib/guard.mjs';

export const handler = async (event) => {
  { const gate = requireJobKey(event); if (gate) return gate; } // fail closed
  try { connectLambda(event); } catch (e) {}
  let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) {}
  try { const S = await runReconcile({ by: body.by || 'schedule', since: body.since }); console.log('[qbo-reconcile]', JSON.stringify({ since: S.since, orders: S.orders, matched: S.matched, differences: S.differences, missing: S.missing, voided: S.voided, cancelled: S.cancelled, noSnapshot: S.noSnapshot, clean: S.clean, errors: S.errors.length, ms: S.ms })); }
  catch (e) { console.error('[qbo-reconcile] failed', e); }
  return { statusCode: 202, body: '' };
};
