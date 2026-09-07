// Saved reports on the server.
//   POST { id }  → run report <id> now, as its owner, exactly as the schedule would
//   GET  ?id=<runId> → download that run's CSV
// Who may: the report's owner, an admin / super admin, or — for a shared report —
// anyone whose role may read the report's source. (A shared run was produced with
// the OWNER's visibility, so a shared report is opened to a whole role group only
// when the owner meant it to be: the checkbox says so.)
import { connectLambda, getStore } from '@netlify/blobs';
import { sessionUser } from './lib/guard.mjs';
import { runSavedReport, engine as E } from './lib/report-runner.mjs';
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_KEY || '';
const H = { apikey: SVC, Authorization: 'Bearer ' + SVC };
const out = (code, body, headers) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', ...(headers || {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) });

function mayOpen(rep, u) {
  const role = u.super ? 'super' : u.role;
  if (u.super || role === 'admin' || rep.owner_id === u.id) return true;
  return !!rep.shared && E.rptSourceAllowed((rep.def || {}).source, role);
}

export const handler = async (event) => {
  try { connectLambda(event); } catch (e) {}
  const u = await sessionUser(event);
  if (u.code) return out(u.code, { error: u.error });
  if (u.role === 'viewer' && !u.super) return out(403, { error: 'Viewers cannot run reports' });

  if (event.httpMethod === 'POST') {
    let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) {}
    const id = parseInt(body.id, 10); if (!id) return out(400, { error: 'Need a report id' });
    const rep = (await fetch(SB_URL + '/rest/v1/saved_reports?select=id,owner_id,shared,def&id=eq.' + id, { headers: H }).then(r => r.json()))[0];
    if (!rep) return out(404, { error: 'Report not found' });
    if (!mayOpen(rep, u)) return out(403, { error: 'Not your report' });
    const r = await runSavedReport(id, { id: u.id, name: u.name || u.email });
    return out(200, r);
  }

  if (event.httpMethod === 'GET') {
    const runId = parseInt((event.queryStringParameters || {}).id, 10); if (!runId) return out(400, { error: 'Need a run id' });
    const run = (await fetch(SB_URL + '/rest/v1/report_runs?select=id,report_id,blob_key,status,ran_at,rows&id=eq.' + runId, { headers: H }).then(r => r.json()))[0];
    if (!run || run.status !== 'ok' || !run.blob_key) return out(404, { error: 'No file for that run' });
    const rep = (await fetch(SB_URL + '/rest/v1/saved_reports?select=id,name,owner_id,shared,def&id=eq.' + run.report_id, { headers: H }).then(r => r.json()))[0];
    if (!rep || !mayOpen(rep, u)) return out(403, { error: 'Not your report' });
    const csv = await getStore('reports').get(run.blob_key, { type: 'text' });
    if (csv == null) return out(410, { error: 'That file has expired' });
    const fname = 'healthspan_' + String(rep.name || 'report').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '_' + String(run.ran_at || '').slice(0, 10) + '.csv';
    return { statusCode: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + fname + '"', 'x-filename': fname, 'Cache-Control': 'private, no-store' }, body: csv };
  }
  return out(405, { error: 'GET or POST' });
};
