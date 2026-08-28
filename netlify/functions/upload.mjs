// ATTACHMENTS → Google Drive (Shared Drive), via a service account.
//
// Supabase stores only the file id and a little metadata; Drive holds the bytes.
// Three actions, all requiring a signed-in HQ session:
//
//   POST {action:'session', name, mime}  → a resumable upload URL the browser
//        PUTs the file straight to. Keeps big receipts off the function's
//        6 MB request limit entirely.
//   POST {action:'put', name, mime, data} → small-file fallback (base64, <4 MB)
//        for when a browser or network blocks the direct PUT.
//   GET  ?id=<fileId>                    → streams the file back THROUGH this
//        function, so HQ's own permissions decide who can see it rather than
//        who happens to have Drive access.
//
// Env: GDRIVE_CLIENT_EMAIL · GDRIVE_PRIVATE_KEY · GDRIVE_FOLDER_ID
import { createSign } from 'node:crypto';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_KEY || '';
const CLIENT_EMAIL = process.env.GDRIVE_CLIENT_EMAIL || '';
const FOLDER_ID = process.env.GDRIVE_FOLDER_ID || '';
// Netlify may hold the key with literal \n (as it appears in the JSON) or with
// real newlines, depending on how it was pasted. Accept both.
const PRIVATE_KEY = (process.env.GDRIVE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

const b64url = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Service-account access token. Cached across warm invocations — a token lasts
// an hour and minting one costs a round-trip to Google on every upload.
let _tok = null, _tokExp = 0;
async function driveToken() {
  if (_tok && Date.now() < _tokExp - 60000) return _tok;
  if (!CLIENT_EMAIL || !PRIVATE_KEY) throw new Error('Drive is not configured — set GDRIVE_CLIENT_EMAIL and GDRIVE_PRIVATE_KEY in Netlify.');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: CLIENT_EMAIL,
    // NOT drive.file: that scope only covers files this robot created, so it
    // cannot see the HQ folder a person made in the Shared Drive — every upload
    // would 404 on the parent. The robot is still confined to what the Shared
    // Drive shares with it, which is one folder.
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(header + '.' + claim);
  let sig;
  try { sig = signer.sign(PRIVATE_KEY); }
  catch (e) { throw new Error('The Drive private key could not be read — re-paste GDRIVE_PRIVATE_KEY exactly as it appears in the JSON key file.'); }
  const jwt = header + '.' + claim + '.' + sig.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google refused the service account: ' + (j.error_description || j.error || 'unknown'));
  _tok = j.access_token; _tokExp = Date.now() + (j.expires_in || 3600) * 1000;
  return _tok;
}

async function caller(event) {
  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SVC, Authorization: 'Bearer ' + token } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}
const out = (code, body, headers) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', ...(headers || {}) }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const safeName = n => String(n || 'file').replace(/[\r\n"\\]/g, '').slice(0, 180) || 'file';

export const handler = async (event) => {
  const who = await caller(event);
  if (!who) return out(401, { error: 'Sign in first' });

  // ── read a file back, gated by the HQ session rather than Drive membership ──
  if (event.httpMethod === 'GET') {
    const id = (event.queryStringParameters || {}).id || '';
    if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return out(400, { error: 'Bad file id' });
    // only serve files HQ has a record of — the robot can reach the whole
    // folder, so without this a guessed id would be readable
    try {
      const chk = await fetch(SB_URL + '/rest/v1/attachments?select=id&limit=1&file_id=eq.' + encodeURIComponent(id),
        { headers: { apikey: SVC, Authorization: 'Bearer ' + SVC } });
      const rows = await chk.json();
      if (!Array.isArray(rows) || !rows.length) return out(404, { error: 'Not an HQ attachment' });
    } catch (e) { return out(500, { error: 'Could not verify the file' }); }
    try {
      const tok = await driveToken();
      const meta = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?fields=name,mimeType,size&supportsAllDrives=true',
        { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.json());
      if (meta.error) return out(404, { error: 'That file is no longer in Drive' });
      // Netlify caps a function response at 6 MB and base64 adds a third, so
      // anything past ~4 MB must be opened in Drive instead of streamed here.
      if (Number(meta.size || 0) > 4 * 1024 * 1024) return out(413, { error: 'Too big to open through HQ — use "open in Drive".', tooBig: true });
      const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media&supportsAllDrives=true',
        { headers: { Authorization: 'Bearer ' + tok } });
      if (!r.ok) return out(502, { error: 'Drive returned ' + r.status });
      const buf = Buffer.from(await r.arrayBuffer());
      return {
        statusCode: 200,
        headers: {
          'Content-Type': meta.mimeType || 'application/octet-stream',
          'Content-Disposition': 'inline; filename="' + safeName(meta.name) + '"',
          'Cache-Control': 'private, max-age=300'
        },
        body: buf.toString('base64'),
        isBase64Encoded: true
      };
    } catch (e) { return out(500, { error: String(e.message || e) }); }
  }

  if (event.httpMethod !== 'POST') return out(405, { error: 'POST or GET' });
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return out(400, { error: 'Bad JSON' }); }
  const name = safeName(body.name);
  const mime = String(body.mime || 'application/octet-stream').replace(/[\r\n]/g, '').slice(0, 100);

  if (!FOLDER_ID) return out(500, { error: 'Drive is not configured — set GDRIVE_FOLDER_ID in Netlify.' });

  try {
    const tok = await driveToken();
    const metadata = { name, parents: [FOLDER_ID] };

    // ── resumable session: the browser uploads the bytes directly to Google ──
    if (body.action === 'session') {
      const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime },
        body: JSON.stringify(metadata)
      });
      if (!r.ok) {
        const t = await r.text();
        return out(502, { error: 'Drive would not start the upload: ' + t.slice(0, 300) });
      }
      const url = r.headers.get('location');
      if (!url) return out(502, { error: 'Drive did not return an upload URL' });
      return out(200, { uploadUrl: url });
    }

    // ── small-file fallback: base64 through here (Netlify caps the body at 6 MB) ──
    if (body.action === 'put') {
      const data = String(body.data || '');
      if (!data) return out(400, { error: 'No file data' });
      const bytes = Buffer.from(data, 'base64');
      if (bytes.length > 4 * 1024 * 1024) return out(413, { error: 'That file is over 4 MB — the direct upload handles bigger files, so try again or use a smaller copy.' });
      const boundary = 'hqb' + Date.now();
      const pre = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
        '\r\n--' + boundary + '\r\nContent-Type: ' + mime + '\r\n\r\n';
      const post = '\r\n--' + boundary + '--';
      const payload = Buffer.concat([Buffer.from(pre), bytes, Buffer.from(post)]);
      const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,size,mimeType', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'multipart/related; boundary=' + boundary, 'Content-Length': String(payload.length) },
        body: payload
      });
      const j = await r.json();
      if (!j.id) return out(502, { error: 'Drive rejected the upload: ' + JSON.stringify(j).slice(0, 300) });
      return out(200, { id: j.id, name: j.name, size: j.size, mime: j.mimeType });
    }

    // ── a Drive link, for files too big to stream back through here ──
    if (body.action === 'link') {
      const id = String(body.id || '');
      if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return out(400, { error: 'Bad file id' });
      const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?fields=webViewLink,name&supportsAllDrives=true',
        { headers: { Authorization: 'Bearer ' + tok } });
      const j = await r.json();
      if (!j.webViewLink) return out(404, { error: 'No link for that file' });
      return out(200, { url: j.webViewLink, name: j.name });
    }

    // ── remove a file from Drive (the app deletes the row separately) ──
    if (body.action === 'remove') {
      const id = String(body.id || '');
      if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return out(400, { error: 'Bad file id' });
      const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?supportsAllDrives=true',
        { method: 'DELETE', headers: { Authorization: 'Bearer ' + tok } });
      // 404 means it is already gone, which is the outcome we wanted anyway
      if (!r.ok && r.status !== 404) return out(502, { error: 'Drive would not delete it (' + r.status + ')' });
      return out(200, { ok: true });
    }

    // ── configuration check, for the Cutover page ──
    if (body.action === 'check') {
      const r = await fetch('https://www.googleapis.com/drive/v3/files/' + FOLDER_ID + '?fields=id,name,driveId&supportsAllDrives=true',
        { headers: { Authorization: 'Bearer ' + tok } });
      const j = await r.json();
      if (j.error) return out(200, { ok: false, error: (j.error.message || 'cannot see the folder') + ' — check the folder id, and that the service account is a Content manager on the Shared Drive.' });
      return out(200, { ok: true, folder: j.name, sharedDrive: !!j.driveId });
    }

    return out(400, { error: 'Unknown action' });
  } catch (e) { return out(500, { error: String(e.message || e) }); }
};
