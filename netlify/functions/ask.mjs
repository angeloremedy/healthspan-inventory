// "Ask AI" endpoint for the dashboard web app.
// The browser sends { question, catalog } (the catalog it already has from sync),
// we ask Claude and return { answer }. The API key stays server-side.
const MODEL = process.env.STOCKBOT_MODEL || 'claude-haiku-4-5-20251001';

const HDRS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HDRS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HDRS, body: JSON.stringify({ error: 'POST only' }) };

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (e) {}
  const question = String(payload.question || '').slice(0, 2000).trim();
  const catalog = String(payload.catalog || '').slice(0, 200000);
  if (!question) return { statusCode: 400, headers: HDRS, body: JSON.stringify({ error: 'No question' }) };
  if (!catalog) return { statusCode: 400, headers: HDRS, body: JSON.stringify({ error: 'No catalog — wait for the dashboard to finish syncing' }) };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { statusCode: 500, headers: HDRS, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };

  const system = [
    'You are Healthspan Global\'s inventory assistant, answering inside their inventory dashboard.',
    'You are given the live warehouse catalog, one product per line:',
    'sku|name|line|stock|price_php|forecast_units_per_month|months_of_cover',
    '',
    'Rules:',
    '- Answer ONLY from the catalog. Match product names fuzzily (misspellings, partial names, brand variants).',
    '- If a product is not in the catalog, say clearly it is not in the system.',
    '- Stock figures are WAREHOUSE-level. Per-branch on-hand is not tracked; say so if asked about a specific branch.',
    '- Empty price means no Healthspan price on file. Remedy-side pricing is not in this system at all.',
    '- Answer every part of multi-part questions, in the order asked.',
    '- Format: **bold** for product names and key numbers, "-" for bullet lines. Be concise and factual.',
    '- If units are low or zero, note it plainly.'
  ].join('\n');

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: system,
        messages: [{ role: 'user', content: 'CATALOG (live):\n' + catalog + '\n\nQUESTION(S):\n' + question }]
      })
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: 502, headers: HDRS, body: JSON.stringify({ error: 'Claude API ' + resp.status + ': ' + t.slice(0, 200) }) };
    }
    const out = await resp.json();
    const answer = (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return { statusCode: 200, headers: HDRS, body: JSON.stringify({ answer: answer || 'No answer produced.' }) };
  } catch (err) {
    return { statusCode: 500, headers: HDRS, body: JSON.stringify({ error: String(err.message || err) }) };
  }
};
