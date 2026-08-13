// Ask AI dispatcher for the dashboard web app.
// POST { question, catalog, history } → hands the job to ask-work-background
//   (no timeout limits there) and returns { id } immediately.
// GET ?id=... → returns the finished { answer, model } / { error }, or { pending:true }.
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

const HDRS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HDRS, body: '' };

  // ── Poll for a result
  if (event.httpMethod === 'GET') {
    const id = (event.queryStringParameters && event.queryStringParameters.id) || '';
    if (!id || !/^[a-f0-9-]{10,40}$/.test(id)) return { statusCode: 400, headers: HDRS, body: JSON.stringify({ error: 'Bad id' }) };
    try {
      const store = getStore('ask');
      const res = await store.get('res-' + id, { type: 'json' });
      if (res) return { statusCode: 200, headers: HDRS, body: JSON.stringify(res) };
    } catch (e) {
      return { statusCode: 503, headers: HDRS, body: JSON.stringify({ error: 'Result storage unavailable: ' + e.message }) };
    }
    return { statusCode: 200, headers: HDRS, body: JSON.stringify({ pending: true }) };
  }

  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HDRS, body: JSON.stringify({ error: 'POST only' }) };

  // ── Dispatch a new question
  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (e) {}
  const question = String(payload.question || '').slice(0, 2000).trim();
  const catalog = String(payload.catalog || '').slice(0, 500000);
  if (!question) return { statusCode: 400, headers: HDRS, body: JSON.stringify({ error: 'No question' }) };
  if (!catalog) return { statusCode: 400, headers: HDRS, body: JSON.stringify({ error: 'No catalog - wait for the dashboard to finish syncing' }) };

  const id = crypto.randomUUID();
  const base = process.env.URL || ('https://' + event.headers.host);
  try {
    // Background functions ack with 202 immediately; the await is quick.
    await fetch(base + '/.netlify/functions/ask-work-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, question, catalog, history: payload.history || [] })
    });
  } catch (e) {
    return { statusCode: 502, headers: HDRS, body: JSON.stringify({ error: 'Could not start the answer job: ' + e.message }) };
  }
  return { statusCode: 200, headers: HDRS, body: JSON.stringify({ id }) };
};
