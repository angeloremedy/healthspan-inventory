// REVIEW DECKS → Google Slides, through the same Drive service account the
// attachments use. Two steps, both needing a signed-in manager / admin:
//
//   POST {action:'session', name}          → a resumable-upload URL. The browser
//        PUTs the .pptx bytes straight to Drive; the metadata asks Drive to
//        CONVERT it into a Google Slides file in the reports folder, so the
//        team edits a native Slides deck, not an attachment.
//   POST {action:'share', id, emails:[…]}  → gives each address edit access and
//        returns the Slides link.
//
// Env: GDRIVE_CLIENT_EMAIL · GDRIVE_PRIVATE_KEY (shared with upload.mjs) ·
//      GDRIVE_REPORTS_FOLDER_ID (falls back to GDRIVE_FOLDER_ID)
import { createSign } from 'node:crypto';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC = process.env.SUPABASE_SERVICE_KEY || '';
const CLIENT_EMAIL = process.env.GDRIVE_CLIENT_EMAIL || '';
const FOLDER_ID = process.env.GDRIVE_REPORTS_FOLDER_ID || process.env.GDRIVE_FOLDER_ID || '';
const PRIVATE_KEY = (process.env.GDRIVE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
const b64url = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const out = (code, body) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

let _tok = null, _tokExp = 0;
async function driveToken() {
  if (_tok && Date.now() < _tokExp - 60000) return _tok;
  if (!CLIENT_EMAIL || !PRIVATE_KEY) throw new Error('Drive is not configured — set GDRIVE_CLIENT_EMAIL and GDRIVE_PRIVATE_KEY in Netlify.');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: CLIENT_EMAIL, scope: 'https://www.googleapis.com/auth/drive', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const signer = createSign('RSA-SHA256'); signer.update(header + '.' + claim);
  let sig; try { sig = signer.sign(PRIVATE_KEY); } catch (e) { throw new Error('The Drive private key could not be read — re-paste GDRIVE_PRIVATE_KEY exactly as in the JSON key file.'); }
  const jwt = header + '.' + claim + '.' + sig.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google refused the service account: ' + (j.error_description || j.error || 'unknown'));
  _tok = j.access_token; _tokExp = Date.now() + (j.expires_in || 3600) * 1000; return _tok;
}

async function caller(event) { // signed-in manager / admin / super only — these are the company's numbers
  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !SB_URL || !SVC) return null;
  try {
    const r = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SVC, Authorization: 'Bearer ' + token } });
    if (!r.ok) return null; const u = await r.json();
    const pr = await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + u.id + '&select=role,is_super,specialist_tag', { headers: { apikey: SVC, Authorization: 'Bearer ' + SVC } });
    const p = (await pr.json())[0] || {};
    return { id: u.id, email: u.email || '', role: p.is_super ? 'super' : (p.role || 'viewer'), tag: p.specialist_tag || '' };
  } catch (e) { return null; }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return out(405, { error: 'POST only' });
  const who = await caller(event);
  if (!who) return out(401, { error: 'Sign in first' });
  let body = {}; try { body = JSON.parse(event.body || '{}'); } catch (e) { return out(400, { error: 'Bad JSON' }); }
  const act = String(body.action || '');
  // a specialist may push their OWN deck; everything else is manager / admin
  const own = who.role === 'sales' && who.tag && String(body.tag || '').toLowerCase() === who.tag.toLowerCase();
  if (!['admin', 'manager', 'super'].includes(who.role) && !own) return out(403, { error: 'Sales manager or admin only' });
  if (!FOLDER_ID) return out(500, { error: 'Drive is not configured — set GDRIVE_REPORTS_FOLDER_ID (or GDRIVE_FOLDER_ID) in Netlify.' });

  try {
    const tok = await driveToken();
    if (act === 'session') {
      const name = String(body.name || 'Sales review').replace(/[\r\n"\\]/g, '').slice(0, 180);
      // mimeType = Google Slides asks Drive to convert the incoming .pptx on arrival
      const meta = { name, parents: [FOLDER_ID], mimeType: 'application/vnd.google-apps.presentation' };
      const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', Origin: event.headers.origin || '' },
        body: JSON.stringify(meta)
      });
      if (!r.ok) return out(502, { error: 'Drive refused the upload session: ' + (await r.text()).slice(0, 200) });
      return out(200, { url: r.headers.get('location') });
    }
    if (act === 'share') {
      const id = String(body.id || ''); if (!/^[A-Za-z0-9_-]{10,}$/.test(id)) return out(400, { error: 'Bad file id' });
      const emails = [...new Set((Array.isArray(body.emails) ? body.emails : []).concat([who.email]).map(e => String(e || '').trim().toLowerCase()).filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))].slice(0, 25);
      const shared = [], failed = [];
      for (const em of emails) {
        const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '/permissions?supportsAllDrives=true&sendNotificationEmail=false', {
          method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: em }) });
        (r.ok ? shared : failed).push(em);
      }
      const meta = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?fields=webViewLink,name&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.json());
      return out(200, { link: meta.webViewLink || ('https://docs.google.com/presentation/d/' + id), name: meta.name, shared, failed });
    }
    return out(400, { error: 'Unknown action' });
  } catch (e) { return out(500, { error: String(e.message || e) }); }
};
