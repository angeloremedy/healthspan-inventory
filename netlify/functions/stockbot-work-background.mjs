// Background worker for the /stock Slack command (up to 15 min runtime).
// Fetches the live inventory feed, asks Claude to answer from the full
// dataset, and posts the answer back to Slack via response_url.
const FAST_MODEL = process.env.STOCKBOT_MODEL || 'claude-haiku-4-5-20251001';
const SMART_MODEL = process.env.STOCKBOT_SMART_MODEL || 'claude-sonnet-5';

function pickModel(q) {
  const qq = q.toLowerCase();
  const hard = q.length > 250 ||
    (q.match(/\?/g) || []).length >= 3 ||
    /why|analy|compare|recommend|report|plan\b|should we|strategy|trend|breakdown|summar|review|explain/.test(qq);
  return hard ? SMART_MODEL : FAST_MODEL;
}

function serialDate(ds) {
  if (!ds || typeof ds !== 'number') return '';
  const d = new Date((ds - 25569) * 86400000);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

function buildShopifySections(data, shop) {
  if (!shop || !Array.isArray(shop.variants)) return '';
  const isV2 = shop.v === 2;
  // v2 unit rule (validated on real orders): physical units — including free +1s —
  // are itemized as base-SKU lines (free at PHP 0); bundle lines carry revenue only,
  // so bundle quantities are NOT multiplied into units (that would double count).
  const gU = c => isV2 ? (c ? c.u : 0) : (typeof c === 'number' ? c : 0);
  const gF = c => isV2 && c ? c.f : 0;
  const sheetSkus = new Set((data.products || []).map(p => p.sku));
  const bases = [...sheetSkus].sort((a, b) => b.length - a.length);
  const byBase = {};
  for (const v of shop.variants) {
    if (sheetSkus.has(v.sku)) { (byBase[v.sku] = byBase[v.sku] || { main: null, bundles: [] }).main = v; continue; }
    const base = bases.find(b => v.sku.startsWith(b) && v.sku.length > b.length);
    if (base) (byBase[base] = byBase[base] || { main: null, bundles: [] }).bundles.push(v);
  }
  const nameOf = {}; for (const p of (data.products || [])) nameOf[p.sku] = p.name;
  let sales = '', deals = '', specs = '';
  for (const [base, g] of Object.entries(byBase)) {
    const m = {}, fr = {};
    const add = (mo, mult) => { for (const k in (mo || {})) { m[k] = (m[k] || 0) + gU(mo[k]) * mult; fr[k] = (fr[k] || 0) + gF(mo[k]) * mult; } };
    if (g.main) add(g.main.monthly, 1);
    for (const b of g.bundles) {
      if (!isV2) add(b.monthly, b.setSize || 1); // legacy blob: expand bundles (old behavior)
      if (b.setSize) deals += [base, b.productTitle, b.setSize, b.price].join('|') + '\n';
    }
    const yms = Object.keys(m).sort();
    if (yms.length) sales += base + '|' + (nameOf[base] || '') + '|' + yms.map(k => k + '=' + m[k] + (fr[k] ? '(' + fr[k] + ' free)' : '')).join(',') + '\n';
  }
  if (isV2 && shop.specialists) {
    for (const [tag, sp] of Object.entries(shop.specialists)) {
      const yms = Object.keys(sp.monthly || {}).sort();
      if (yms.length) specs += tag + '|' + yms.map(k => k + '=' + sp.monthly[k].u + 'u/' + Math.round(sp.monthly[k].v) + 'php').join(',') + '\n';
    }
  }
  let out = '';
  if (sales) out += '\n\nSHOPIFY UNIT DEMAND - booked store sales in physical units; deals counted as a whole incl. their +1 units; (N free) = true giveaways outside deals (sku|name|month=units(free),...):\n' + sales;
  if (deals) out += '\n\nLIVE DEALS ON SHOPIFY (sku|deal_title|physical_units_per_set|set_price_php):\n' + deals;
  if (specs) out += '\n\nSALES PER SPECIALIST - from Shopify order tags (specialist|month=units/revenue,...):\n' + specs;
  return out;
}

function buildData(data) {
  const prods = (data.products || []).map(p => [
    p.sku, p.name, p.line || '',
    (typeof p.stock === 'number' ? p.stock : ''),
    (p.price != null ? p.price : ''),
    (p.velAdj != null ? p.velAdj : (p.velocity != null ? p.velocity : '')),
    (p.monthsOfStock != null ? p.monthsOfStock : ''),
    p.expiry || '', p.batch || '',
    (p.daysToStockout != null ? p.daysToStockout : ''),
    p.stockoutDate || '',
    p.supplier || ''
  ].join('|')).join('\n');

  const batches = (data.batches || []).filter(b => b.soh > 0).map(b =>
    [b.skuCode || '', b.name, b.batch || '', b.expiry || '', b.soh].join('|')).join('\n');

  const custs = (data.customers || []).slice(0, 150).map(c =>
    [c.name, c.qty, c.value, c.orders, c.skuCount, c.lastOrder || '', c.daysSince != null ? c.daysSince : '', c.trend, c.isRemedy ? 'REMEDY' : ''].join('|')).join('\n');

  const ships = (data.branchTransfers || []).slice(0, 80).map(t =>
    [t.branch, t.sku, t.name, t.qty, serialDate(t.dateSerial)].join('|')).join('\n');

  const wo = (data.collisions || []).filter(c => c.projExpired > 0)
    .sort((a, b) => b.writeOff - a.writeOff).slice(0, 50).map(c =>
    [c.sku, c.name, c.batch || '', c.expiry || '', c.projExpired, c.writeOff].join('|')).join('\n');

  const mo = Object.entries(data.monthlyOut || {}).map(([k, v]) => k + '=' + v).join(', ');

  return 'PRODUCTS (sku|name|line|stock|price_php|forecast_per_month|months_of_cover|expiry|batch|days_to_stockout|stockout_date|supplier):\n' + prods +
    '\n\nBATCHES with stock, FEFO order - earliest expiry first (sku|name|batch|expiry_MM/YYYY|units_on_hand):\n' + batches +
    '\n\nCUSTOMERS (name|units|value_php|orders|sku_count|last_order|days_since_order|trend|remedy_flag):\n' + custs +
    '\n\nREMEDY SHIPMENTS - recent shipments to Remedy branches (branch|sku|name|qty|date):\n' + ships +
    '\n\nWRITE-OFF RISK - projected to expire unsold (sku|name|batch|expiry|units_at_risk|writeoff_value_php):\n' + wo +
    '\n\nMONTHLY UNITS OUT (month=units): ' + mo;
}

const SYSTEM = [
  'You are Healthspan Global\'s inventory assistant answering questions in Slack.',
  'You are given live data in named sections; each section header describes its columns.',
  'When SHOPIFY UNIT DEMAND is present, prefer it as the demand signal for ordering questions - it is physical units booked at the store; deal bundles count as a whole (their +1 units are deal units, not freebies), and parenthesized free counts are true giveaways outside deals; MONTHLY UNITS OUT is warehouse outflow and runs longer historically.',
  'SALES PER SPECIALIST shows each product specialist\'s booked units and revenue per month (from Shopify order tags).',
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
  '- Format for Slack mrkdwn: *bold* for product names and numbers, bullet lines with "-". Be concise and factual.',
  '- If units are low or zero, note it plainly.'
].join('\n');

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

  const model = pickModel(text);
  const t0 = Date.now();
  let ok = false;

  let usedModel = model;
  try {
    const base = process.env.URL;
    const [r, rs] = await Promise.all([
      fetch(base + '/.netlify/functions/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
      fetch(base + '/api/shopify').catch(() => null)
    ]);
    if (!r.ok) throw new Error('inventory feed returned ' + r.status);
    const data = await r.json();
    let shop = null;
    try { if (rs && rs.ok) shop = await rs.json(); } catch (e) {}
    const cat = buildData(data) + buildShopifySections(data, shop);

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) { await post(':warning: ANTHROPIC_API_KEY is not configured in Netlify.'); return { statusCode: 200, body: 'no key' }; }

    const callModel = async (m, maxTok) => {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: m,
          max_tokens: maxTok, // generous: reasoning models spend output tokens thinking first
          system: SYSTEM,
          messages: [{ role: 'user', content: 'LIVE DATA (synced ' + (data.synced || 'now') + '):\n' + cat + '\n\nQUESTION(S) FROM SLACK:\n' + text }]
        })
      });
      if (!resp.ok) throw new Error('Claude API ' + resp.status + ': ' + (await resp.text()).slice(0, 200));
      const out = await resp.json();
      return (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    };

    let answer = await callModel(model, model === SMART_MODEL ? 6000 : 2000);
    if (!answer && model === SMART_MODEL) { usedModel = FAST_MODEL; answer = await callModel(FAST_MODEL, 2000); }
    ok = !!answer;
    await post(answer || ':warning: No answer produced.');
  } catch (err) {
    await post(':warning: Sorry - could not answer: ' + err.message);
  }

  try {
    await fetch((process.env.URL || '') + '/api/asklog', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src: 'slack', q: text, ok, model: usedModel, ms: Date.now() - t0 })
    });
  } catch (e) {}

  return { statusCode: 200, body: 'ok' };
};
