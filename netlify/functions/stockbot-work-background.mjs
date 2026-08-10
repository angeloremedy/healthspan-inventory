// Background worker for the /stock Slack command (up to 15 min runtime).
// Fetches the live inventory feed, asks Claude to answer the question
// from the catalog, and posts the answer back to Slack via response_url.
const MODEL = process.env.STOCKBOT_MODEL || 'claude-haiku-4-5-20251001';

export const handler = async (event) => {
  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (e) {}
  const { text, response_url } = payload;
  if (!text || !response_url) return { statusCode: 400, body: 'missing fields' };

  const post = (msg) => fetch(response_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response_type: 'in_channel', replace_original: false, text: msg })
  });

  try {
    // 1. Live inventory from this same site
    const base = process.env.URL;
    const r = await fetch(base + '/.netlify/functions/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    if (!r.ok) throw new Error('inventory feed returned ' + r.status);
    const data = await r.json();

    // 2. Compact catalog: products + batch-level expiry (FEFO)
    const prods = (data.products || []).map(p => [
      p.sku, p.name, p.line || '',
      (typeof p.stock === 'number' ? p.stock : ''),
      (p.price != null ? p.price : ''),
      (p.velAdj != null ? p.velAdj : (p.velocity != null ? p.velocity : '')),
      (p.monthsOfStock != null ? p.monthsOfStock : ''),
      p.expiry || '', p.batch || ''
    ].join('|')).join('\n');
    const batches = (data.batches || []).filter(b => b.soh > 0).map(b =>
      [b.skuCode || '', b.name, b.batch || '', b.expiry || '', b.soh].join('|')).join('\n');
    const cat = 'PRODUCTS (sku|name|line|stock|price_php|forecast_per_month|months_of_cover|expiry|batch):\n' + prods +
      '\n\nBATCHES with stock, FEFO order - earliest expiry first (sku|name|batch|expiry_MM/YYYY|units_on_hand):\n' + batches;

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) { await post(':warning: ANTHROPIC_API_KEY is not configured in Netlify.'); return { statusCode: 200, body: 'no key' }; }

    const system = [
      'You are Healthspan Global\'s inventory assistant answering questions in Slack.',
      'You are given two live sections:',
      '1. PRODUCTS - one per line: sku|name|line|stock|price_php|forecast_units_per_month|months_of_cover|expiry|batch',
      '2. BATCHES - batch-level stock in FEFO order (earliest expiry first): sku|name|batch|expiry_MM/YYYY|units_on_hand',
      '',
      'Rules:',
      '- Answer ONLY from this data. Match product names fuzzily (misspellings, partial names, brand variants).',
      '- For expiry questions ("what expires soon?"), use the BATCHES section - it is already sorted earliest-first. Give product, batch, expiry month, and units.',
      '- If a product is not in the data, say clearly it is not in the system.',
      '- Stock figures are WAREHOUSE-level. Per-branch on-hand is not tracked; say so if asked about a specific branch.',
      '- Empty price means no Healthspan price on file. Remedy-side pricing is not in this system at all.',
      '- Answer every part of multi-part questions, in the order asked.',
      '- Format for Slack mrkdwn: *bold* for product names and numbers, bullet lines with "-". Be concise and factual.',
      '- If units are low or zero, note it plainly.'
    ].join('\n');

    // 3. Ask Claude
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: system,
        messages: [{
          role: 'user',
          content: 'CATALOG (live, synced ' + (data.synced || 'now') + '):\n' + cat + '\n\nQUESTION(S) FROM SLACK:\n' + text
        }]
      })
    });
    if (!resp.ok) {
      const errTxt = await resp.text();
      throw new Error('Claude API ' + resp.status + ': ' + errTxt.slice(0, 200));
    }
    const out = await resp.json();
    const answer = (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    await post(answer || ':warning: No answer produced.');
  } catch (err) {
    await post(':warning: Sorry - could not answer: ' + err.message);
  }
  return { statusCode: 200, body: 'ok' };
};
