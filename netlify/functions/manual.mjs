// Serve the signed-in user THEIR role manual (PDF).
// GET /.netlify/functions/manual  (Authorization: Bearer <session>)
// Role → file mapping mirrors PERMISSIONS.md; the PDFs ship with the deploy
// via [functions."manual"] included_files in netlify.toml.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_KEY || '';

const FILE = {
  super: 'HQ-Manual-7-Super-Admin.pdf',
  admin: 'HQ-Manual-6-Admin.pdf',
  manager: 'HQ-Manual-2-Sales-Manager.pdf',
  sales: 'HQ-Manual-1-Product-Specialist.pdf',
  supply_chain: 'HQ-Manual-3-Supply-Chain.pdf',
  finance: 'HQ-Manual-4-Finance.pdf',
  marketing: 'HQ-Manual-5-Marketing.pdf',
  it: 'HQ-Manual-9-IT.pdf',
  viewer: 'HQ-Manual-8-Viewer.pdf'
};

export const handler = async (event) => {
  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Sign in first' }) };
  let caller;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SVC, Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error('bad session');
    caller = await r.json();
  } catch (e) { return { statusCode: 401, body: JSON.stringify({ error: 'Session invalid' }) }; }
  let prof = null;
  try {
    const r = await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + caller.id + '&select=role,is_super,can_manage_ps', {
      headers: { apikey: SVC, Authorization: 'Bearer ' + SVC }
    });
    prof = (await r.json())[0];
  } catch (e) {}
  if (!prof) return { statusCode: 403, body: JSON.stringify({ error: 'No profile' }) };
  const key = prof.is_super ? 'super' : (prof.role === 'viewer' && prof.can_manage_ps) ? 'it' : prof.role;
  const file = FILE[key] || FILE.viewer;
  let buf;
  try {
    buf = readFileSync(join(process.env.LAMBDA_TASK_ROOT || process.cwd(), 'manuals', file));
  } catch (e) {
    try { buf = readFileSync(join(process.cwd(), 'manuals', file)); }
    catch (e2) { return { statusCode: 404, body: JSON.stringify({ error: 'Manual not bundled — check netlify.toml included_files' }) }; }
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="' + file + '"' },
    body: buf.toString('base64'),
    isBase64Encoded: true
  };
};
