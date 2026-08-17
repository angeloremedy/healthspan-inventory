// Background worker for the dashboard's Ask AI box (up to 15 min runtime — no timeouts).
// Receives { id, question, catalog, history }, asks Claude (smart model with a
// fast-model safety net), and writes the result to Blobs for ask.mjs to serve.
import { connectLambda, getStore } from '@netlify/blobs';

const FAST_MODEL = process.env.STOCKBOT_MODEL || 'claude-haiku-4-5-20251001';
const SMART_MODEL = process.env.STOCKBOT_SMART_MODEL || 'claude-sonnet-5';

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
  'Sections may include: PRODUCTS, BATCHES (FEFO), CUSTOMERS, REMEDY SHIPMENTS, WRITE-OFF RISK, MONTHLY UNITS OUT, SHOPIFY UNIT DEMAND, LIVE DEALS ON SHOPIFY.',
  'When SHOPIFY UNIT DEMAND is present, prefer it as the demand signal for ordering questions - it is physical units booked at the store, with free +1 deal units included (shown in parentheses); MONTHLY UNITS OUT is warehouse outflow and runs longer historically.',
  'SALES PER SPECIALIST, when present, shows each product specialist\'s booked units and revenue per month (from Shopify order tags).',
  '',
  'Rules:',
  '- Answer ONLY from this data. Match product names fuzzily (misspellings, partial names, brand variants).',
  '- For expiry questions, check BOTH the BATCHES section (batch-level, earliest-first - the primary source) AND the expiry column in PRODUCTS (master data). Say which source each date came from, and note when a product is not batch-tracked.',
  '- Treat expiry dates more than ~10 years out, or expiry on non-perishables (brushes, bags, marketing items), as likely data-entry placeholders - mention but flag them.',
  '- For "what should we order" questions: use demand, days_to_stockout and stock. Suggested qty ~ demand x months of cover wanted (assume supplier lead time ~2 months if unstated) minus stock. Show your arithmetic briefly.',
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
  try { connectLambda(event); } catch (e) {} // wire Blobs context into this handler-style function

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (e) {}
  const id = String(payload.id || '');
  const question = String(payload.question || '').slice(0, 2000).trim();
  const catalog = String(payload.catalog || '').slice(0, 500000);
  const history = Array.isArray(payload.history) ? payload.history.slice(-4) : [];
  if (!id) return { statusCode: 400, body: 'no id' };

  let store = null;
  try { store = getStore('ask'); } catch (e) {}
  const finish = async (obj) => { if (store) { try { await store.setJSON('res-' + id, { ...obj, at: new Date().toISOString() }); } catch (e) {} } };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!question || !catalog) { await finish({ error: 'Missing question or catalog' }); return { statusCode: 200, body: 'bad input' }; }
  if (!key) { await finish({ error: 'ANTHROPIC_API_KEY not configured' }); return { statusCode: 200, body: 'no key' }; }

  const msgs = [];
  for (const h of history) {
    if (h && h.q && h.a) {
      msgs.push({ role: 'user', content: String(h.q).slice(0, 2000) });
      msgs.push({ role: 'assistant', content: String(h.a).slice(0, 4000) });
    }
  }
  msgs.push({ role: 'user', content: question });

  const model = pickModel(question);
  const t0 = Date.now();

  const callModel = async (m, maxTok) => {
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: m,
          max_tokens: maxTok, // generous: reasoning models spend output tokens thinking before writing
          system: SYSTEM + '\n\nLIVE DATA:\n' + catalog,
          messages: msgs
        })
      });
      if (!resp.ok) {
        const t = await resp.text();
        return { answer: '', errMsg: 'Claude API ' + resp.status + ': ' + t.slice(0, 200) };
      }
      const out = await resp.json();
      return { answer: (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim(), errMsg: '' };
    } catch (err) {
      return { answer: '', errMsg: String(err.message || err) };
    }
  };

  let usedModel = model;
  let res = await callModel(model, model === SMART_MODEL ? 8000 : 2000);
  if (!res.answer && model === SMART_MODEL) {           // safety net: never leave the user empty-handed
    usedModel = FAST_MODEL;
    res = await callModel(FAST_MODEL, 2000);
  }

  // Question log (fire-and-forget)
  try {
    await fetch((process.env.URL || '') + '/api/asklog', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src: 'web', q: question, ok: !!res.answer, model: usedModel, ms: Date.now() - t0 })
    });
  } catch (e) {}

  if (res.answer) await finish({ answer: res.answer, model: usedModel });
  else await finish({ error: res.errMsg || 'No answer produced' });
  return { statusCode: 200, body: 'ok' };
};
