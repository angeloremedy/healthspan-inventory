// "Ask AI" endpoint for the dashboard web app.
// The browser sends { question, catalog, history } (catalog it already has from sync),
// we ask Claude and return { answer }. The API key stays server-side.
const FAST_MODEL = process.env.STOCKBOT_MODEL || 'claude-haiku-4-5-20251001';
const SMART_MODEL = process.env.STOCKBOT_SMART_MODEL || 'claude-sonnet-5';

const HDRS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Two-speed intelligence: simple lookups go to the fast model,
// long / multi-part / analytical questions go to the smart one.
function pickModel(q) {
  const qq = q.toLowerCase();
  const hard = q.length > 250 ||
    (q.match(/\?/g) || []).length >= 3 ||
    /why|analy|compare|recommend|report|plan\b|should we|strategy|trend|breakdown|summar|review|explain/.test(qq);
  return hard ? SMART_MODEL : FAST_MODEL;
}

const SYSTEM = [
  'You are Healthspan Global\'s inventory assistant, answering inside their inventory dashboard.',
  'You are given live data in named sections; each section header describes its columns.',
  'Sections may include: PRODUCTS, BATCHES (FEFO), CUSTOMERS, REMEDY SHIPMENTS, WRITE-OFF RISK, MONTHLY UNITS OUT.',
  '',
  'Rules:',
  '- Answer ONLY from this data. Match product names fuzzily (misspellings, partial names, brand variants).',
  '- For expiry questions, check BOTH the BATCHES section (batch-level, earliest-first - the primary source) AND the expiry column in PRODUCTS (master data). Say which source each date came from, and note when a product is not batch-tracked.',
  '- Treat expiry dates more than ~10 years out, or expiry on non-perishables (brushes, bags, marketing items), as likely data-entry placeholders - mention but flag them.',
  '- For "what should we order" questions: use days_to_stockout, forecast_per_month and stock. Suggested qty ~ forecast x months of cover wanted (assume supplier lead time ~2 months if unstated) minus stock. Show your arithmetic briefly.',
  '- For customer/account questions use CUSTOMERS. Remedy is a sister company AND a customer; its branches (BGC, Vertis North, GH Mall) appear in REMEDY SHIPMENTS.',
  '- Per-branch ON-HAND stock is not tracked - only shipments TO Remedy branches. Say so when asked about branch stock.',
  '- For expiring-unsold value questions use WRITE-OFF RISK.',
  '- If a product is not in the data, say clearly it is not in the system.',
  '- Empty price means no Healthspan price on file. Remedy-side pricing is not in this system at all.',
  '- Answer every part of multi-part questions, in the order asked.',
  '- Format: **bold** for product names and key numbers, "-" for bullet lines. Be concise and factual.',
  '- If units are low or zero, note it plainly.'
].join('\n');

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HDRS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HDRS, body: JSON.stringify({ error: 'POST only' }) };

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (e) {}
  const question = String(payload.question || '').slice(0, 2000).trim();
  const catalog = String(payload.catalog || '').slice(0, 500000);
  const history = Array.isArray(payload.history) ? payload.history.slice(-4) : [];
  if (!question) return { statusCode: 400, headers: HDRS, body: JSON.stringify({ error: 'No question' }) };
  if (!catalog) return { statusCode: 400, headers: HDRS, body: JSON.stringify({ error: 'No catalog - wait for the dashboard to finish syncing' }) };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { statusCode: 500, headers: HDRS, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };

  const model = pickModel(question);
  const t0 = Date.now();

  // Conversation memory: prior Q&A pairs become real turns.
  const msgs = [];
  for (const h of history) {
    if (h && h.q && h.a) {
      msgs.push({ role: 'user', content: String(h.q).slice(0, 2000) });
      msgs.push({ role: 'assistant', content: String(h.a).slice(0, 4000) });
    }
  }
  msgs.push({ role: 'user', content: question });

  let ok = false, answer = '', errMsg = '';
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: model,
        // Smart-model answers are capped tighter: this endpoint is a synchronous
        // function (~10s platform limit), so long generations must stay brief.
        max_tokens: model === SMART_MODEL ? 1000 : 1500,
        system: SYSTEM + '\n\nLIVE DATA:\n' + catalog,
        messages: msgs
      })
    });
    if (!resp.ok) {
      const t = await resp.text();
      errMsg = 'Claude API ' + resp.status + ': ' + t.slice(0, 200);
    } else {
      const out = await resp.json();
      answer = (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      ok = !!answer;
    }
  } catch (err) {
    errMsg = String(err.message || err);
  }

  // Fire-and-forget question log (never blocks or breaks the answer).
  try {
    await fetch((process.env.URL || '') + '/api/asklog', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src: 'web', q: question, ok, model, ms: Date.now() - t0 })
    });
  } catch (e) {}

  if (!ok) return { statusCode: 502, headers: HDRS, body: JSON.stringify({ error: errMsg || 'No answer produced' }) };
  return { statusCode: 200, headers: HDRS, body: JSON.stringify({ answer, model }) };
};
