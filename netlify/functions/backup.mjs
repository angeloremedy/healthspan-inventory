// Download the latest nightly backup (super admin only).
// GET /.netlify/functions/backup           → latest full backup JSON (attachment)
// GET /.netlify/functions/backup?info=1    → { day, exported_at, counts }
import { connectLambda, getStore } from '@netlify/blobs';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_KEY || '';

export const handler = async (event) => {
  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Sign in first' }) };
  let caller;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SVC, Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error('bad session');
    caller = await r.json();
  } catch (e) { return { statusCode: 401, body: JSON.stringify({ error: 'Session invalid' }) }; }
  try {
    const r = await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + caller.id + '&select=is_super', {
      headers: { apikey: SVC, Authorization: 'Bearer ' + SVC }
    });
    const prof = await r.json();
    if (!prof || !prof[0] || !prof[0].is_super) return { statusCode: 403, body: JSON.stringify({ error: 'Super admin only' }) };
  } catch (e) { return { statusCode: 403, body: JSON.stringify({ error: 'Super admin only' }) }; }

  connectLambda(event);
  const store = getStore('backups');
  const meta = await store.get('latest', { type: 'json' });
  if (!meta) return { statusCode: 404, body: JSON.stringify({ error: 'No backup yet — the nightly job runs at 2am Manila (or trigger backup-background with the JOB_KEY).' }) };
  if ((event.queryStringParameters || {}).info) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta) };
  }
  const full = await store.get('backup-' + meta.day, { type: 'text' });
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="healthspan-hq-backup-' + meta.day + '.json"'
    },
    body: full || '{}'
  };
};
