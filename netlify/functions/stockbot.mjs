// Slack slash-command receiver for /stock.
// Verifies the request came from Slack, acks within 3 seconds,
// and hands the real work to stockbot-work-background.mjs.
import crypto from 'node:crypto';

function verifySlack(event, secret) {
  const ts = event.headers['x-slack-request-timestamp'];
  const sig = event.headers['x-slack-signature'];
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false; // replay guard
  const base = 'v0:' + ts + ':' + (event.body || '');
  const h = 'v0=' + crypto.createHmac('sha256', secret).update(base).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(sig)); } catch { return false; }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };
  const secret = process.env.SLACK_SIGNING_SECRET || '';
  if (!secret) return { statusCode: 500, body: 'SLACK_SIGNING_SECRET not set' };
  if (!verifySlack(event, secret)) return { statusCode: 401, body: 'Bad signature' };

  const params = new URLSearchParams(event.body || '');
  const text = (params.get('text') || '').trim();
  const responseUrl = params.get('response_url');

  if (!text) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_type: 'ephemeral',
        text: 'Ask me about inventory, e.g. `/stock how many HA Densimatrix do we have?` — I answer from the live Healthspan dashboard.'
      })
    };
  }

  // Hand off to the background worker (background functions ack immediately with 202).
  const base = process.env.URL || ('https://' + event.headers.host);
  await fetch(base + '/.netlify/functions/stockbot-work-background', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, response_url: responseUrl })
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      response_type: 'in_channel',
      text: ':mag: Checking the live inventory for: "' + text + '"...'
    })
  };
};
