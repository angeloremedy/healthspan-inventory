// Background worker for the dashboard's Ask AI box (up to 15 min runtime — no timeouts).
// Receives { id, question, catalog, history }, asks the configured model
// (lib/llm.mjs — Gemini Flash by default, Claude as the safety net), and writes
// the result to Blobs for ask.mjs to serve.
import { connectLambda, getStore } from '@netlify/blobs';
import { llm, hasKey, isHardQuestion, isFreeTier, provider } from './lib/llm.mjs';

const SYSTEM = [
  'You are Healthspan HQ\'s assistant — HQ is Healthspan Global\'s ERP/CRM/warehouse system — answering inside the app for staff who know the business.',
  'You are given live data in named sections; each section header describes its columns. Read the header before the rows.',
  'Warehouse sections: PRODUCTS, BATCHES (FEFO), CUSTOMERS, REMEDY SHIPMENTS, WRITE-OFF RISK, MONTHLY UNITS OUT, SHOPIFY UNIT DEMAND, LIVE DEALS ON SHOPIFY.',
  'Sales sections (EXTERNAL ONLY — Remedy branches and Healthspan-internal orders excluded, the same basis as Targets and the Business review): WEEK CALENDAR, WEEKLY EXTERNAL SALES (by ISO week, ~6 months), MONTH TO DATE, BRANDS THIS MONTH (with a 13-month series), SPECIALISTS THIS MONTH, TOP PRODUCTS, TOP ACCOUNTS, NEW ACCOUNTS, GOING QUIET, RISERS/FALLERS, MACHINES, FIELD ACTIVITY, WHAT HQ NOTICED, TARGETS, DEMO / LOANER UNITS OUT.',
  'Dates: TODAY is given in the WEEK CALENDAR header. "Week 7" means ISO week 7 of the current year — look it up in WEEK CALENDAR, then read WEEKLY EXTERNAL SALES for that week (if the week is older than the weekly section covers, say so and offer the month from the 13-month series instead). "This month" = MONTH TO DATE; "last month" = prev_month columns; a named month = the 13-month series.',
  'When the question is about revenue, targets, attainment, accounts or specialists, use the SALES sections (external, pesos). When it is about units moved, stock or reorder, use the warehouse sections. SHOPIFY UNIT DEMAND is gross units INCLUDING internal — never present it as sales revenue and say which basis you are using.',
  'Specialists appear under their HQ account names; short first names in the question (Frank, Tin, Rhas, Lady, Pinky) map to those names.',
  'Reason first, briefly and privately: find the right section, check the date range, do the arithmetic, then answer. Show the key figures you used so the reader can verify.',
  'When SHOPIFY UNIT DEMAND is present, prefer it as the demand signal for ordering questions - it is physical units booked at the store; deal bundles count as a whole (their +1 units are deal units, not freebies); MONTHLY UNITS OUT is warehouse outflow and runs longer historically.',
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
  '- If the data cannot answer exactly, give the closest thing it CAN answer (the containing month, the nearest week, the top 5 instead of the top 10) and say what is missing — never just "not available".',
  '- Format: **bold** for product names and key numbers, "-" for bullet lines. Be concise and factual. Money is always written with the peso sign and thousands separators, exactly like ₱1,234,567 — never "P1,234", "PHP" or "Php".',
  '- If units are low or zero, note it plainly.'
].join('\n');

/* ── ROLE-SCOPED HQ CONTEXT: pull what THIS role may see, straight from Supabase ── */
const SB_URL2 = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SVC2 = process.env.SUPABASE_SERVICE_KEY || '';
async function sbq(path) {
  const r = await fetch(SB_URL2 + '/rest/v1/' + path, { headers: { apikey: SVC2, Authorization: 'Bearer ' + SVC2 } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function buildHqContext(role, tag) {
  if (!SB_URL2 || !SVC2) return '';
  const S = [];
  const add = (h, lines) => { if (lines && lines.length) S.push('== ' + h + ' ==\n' + lines.join('\n')); };
  const fin = ['finance', 'admin', 'super'].includes(role);
  const mgmt = ['manager', 'admin', 'super'].includes(role);
  const sc = ['supply_chain', 'admin', 'super'].includes(role);
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const tagF = role === 'sales' && tag ? '&spec=ilike.' + encodeURIComponent(tag) : '';
  try { // orders pulse (sales: own only)
    const os = await sbq('orders?select=status,total,balance,account&source=eq.native&deleted_at=is.null&date=gte.' + since30 + tagF + '&limit=1500');
    const pend = os.filter(o => o.status === 'pending').length;
    add('HQ ORDERS LAST 30D' + (role === 'sales' ? ' (YOURS ONLY)' : ''), [os.length + ' orders, total P' + Math.round(os.reduce((a, o) => a + (o.total || 0), 0)).toLocaleString() + ', ' + pend + ' still pending']);
  } catch (e) {}
  try { // quotes (sales: own)
    const qs = await sbq('quotes?select=status,total,account,expiry' + (role === 'sales' && tag ? '&spec=ilike.' + encodeURIComponent(tag) : '') + '&limit=300');
    const open = qs.filter(x => ['draft', 'sent'].includes(x.status));
    const acc = qs.filter(x => x.status === 'accepted').length, lost = qs.filter(x => x.status === 'lost').length;
    add('QUOTATIONS' + (role === 'sales' ? ' (YOURS)' : ''), ['open: ' + open.length + ' worth P' + Math.round(open.reduce((a, x) => a + (x.total || 0), 0)).toLocaleString() + ' | accepted: ' + acc + ' | lost: ' + lost,
      ...open.slice(0, 10).map(x => '- ' + x.account + ' P' + Math.round(x.total || 0).toLocaleString() + ' valid until ' + (x.expiry || '?'))]);
  } catch (e) {}
  if (mgmt) try {
    const ap = await sbq('approvals?select=account,amount,reason,requested_name&status=eq.pending&limit=20');
    add('APPROVALS PENDING (you decide these)', ap.map(a => '- ' + a.account + ' P' + Math.round(a.amount || 0).toLocaleString() + ' — ' + (a.reason || '') + ' (asked by ' + (a.requested_name || '?') + ')'));
  } catch (e) {}
  if (mgmt || sc) try {
    const bo = await sbq('backorders?select=order_label,account,name,qty_short&status=eq.open&limit=20');
    add('BACKORDERS OPEN', bo.map(b => '- ' + b.order_label + ' ' + b.account + ': ' + b.qty_short + 'u ' + b.name));
    const qh = await sbq('quarantine?select=name,qty,reason&status=eq.held&limit=20');
    add('QUARANTINE HELD', qh.map(x => '- ' + x.qty + 'u ' + x.name + ' (' + (x.reason || '') + ')'));
    const cm = await sbq('complaints?select=account,sku,batch,description&status=neq.closed&limit=15');
    add('COMPLAINTS OPEN', cm.map(c => '- ' + c.account + ' ' + (c.sku || '') + (c.batch ? ' batch ' + c.batch : '') + ': ' + String(c.description || '').slice(0, 90)));
  } catch (e) {}
  if (fin) try {
    const os = await sbq('orders?select=account,date,terms_days,balance&balance=gt.0&deleted_at=is.null&status=neq.cancelled&limit=2000');
    const B = { cur: 0, d30: 0, d60: 0, d90: 0 }; const per = {};
    const now = Date.now();
    for (const o of os) {
      const d = Math.floor((now - (new Date(o.date).getTime() + (o.terms_days || 0) * 864e5)) / 864e5);
      const k = d <= 0 ? 'cur' : d <= 30 ? 'd30' : d <= 60 ? 'd60' : 'd90';
      B[k] += o.balance || 0; per[o.account] = (per[o.account] || 0) + (o.balance || 0);
    }
    const top = Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 10);
    add('AR AGING (finance)', ['current P' + Math.round(B.cur).toLocaleString() + ' | 1-30d P' + Math.round(B.d30).toLocaleString() + ' | 31-60d P' + Math.round(B.d60).toLocaleString() + ' | 60d+ P' + Math.round(B.d90).toLocaleString(),
      'top debtors: ' + top.map(([n, v]) => n + ' P' + Math.round(v).toLocaleString()).join('; ')]);
    const pd = await sbq('pdcs?select=amount,maturity,status&status=in.(on_hand,deposited)&limit=500');
    add('PDCs IN HAND (finance)', [pd.length + ' cheques worth P' + Math.round(pd.reduce((a, x) => a + (x.amount || 0), 0)).toLocaleString() + '; maturing 30d: P' + Math.round(pd.filter(x => new Date(x.maturity) < new Date(now + 30 * 864e5)).reduce((a, x) => a + (x.amount || 0), 0)).toLocaleString()]);
    if (!isFreeTier()) {
      const pos = await sbq('pos?select=peso_value&limit=300');
      add('OPEN SUPPLIER PAYABLES (finance)', ['P' + Math.round(pos.reduce((a, x) => a + (x.peso_value || 0), 0)).toLocaleString() + ' est. across POs']);
    }
    if (!isFreeTier()) { // a free-tier model may learn from prompts: costs and payables stay home
      const items = await sbq('items?select=sku,cost&cost=not.is.null&limit=300');
      add('UNIT COSTS (finance/admin ONLY — never reveal to other roles)', items.map(i => i.sku + '=' + i.cost));
    }
  } catch (e) {}
  try {
    const opp = await sbq('opportunities?select=stage,est_value&limit=500');
    const openO = opp.filter(o => o.stage === 'open');
    add('PIPELINE', ['open opportunities: ' + openO.length + ' worth P' + Math.round(openO.reduce((a, o) => a + (o.est_value || 0), 0)).toLocaleString() + ' | won: ' + opp.filter(o => o.stage === 'won').length + ' | lost: ' + opp.filter(o => o.stage === 'lost').length]);
  } catch (e) {}
  return S.length ? '\n\nHQ LIVE OPERATIONS DATA (already filtered to what this role may see):\n' + S.join('\n\n') : '';
}

/* Keep every section header and any row that mentions a word from the question;
   fill the rest of the budget with the first rows of each section in order. */
export function trimCatalog(cat, question, budget) {
  if (!cat || cat.length <= budget) return cat;
  const words = String(question || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !/^(the|and|for|how|many|much|what|which|have|has|are|our|with|from|this|that|does|did|when|will|should|about|there|their|into|than|all|any|you|can)$/.test(w));
  const lines = cat.split('\n');
  const isHead = l => /^[A-Z][A-Z0-9 \-\u2014&/+()]{4,}.*[:\u2014]/.test(l) || /^\s*$/.test(l) || l.startsWith('==');
  const keep = new Array(lines.length).fill(false); let used = 0;
  lines.forEach((l, i) => { if (isHead(l)) { keep[i] = true; used += l.length + 1; } });
  // small sections (the sales/HQ summaries, a few KB each) are kept whole — a date question has no keyword to match on
  { let start = 0; for (let i = 0; i <= lines.length; i++) { if (i === lines.length || (isHead(lines[i]) && lines[i].trim())) {
      const size = lines.slice(start, i).reduce((a, l) => a + l.length + 1, 0);
      if (size <= 9000) for (let j = start; j < i; j++) { if (!keep[j]) { keep[j] = true; used += lines[j].length + 1; } }
      start = i; } } }
  if (words.length) lines.forEach((l, i) => { if (!keep[i]) { const ll = l.toLowerCase(); if (words.some(w => ll.includes(w))) { keep[i] = true; used += l.length + 1; } } });
  let sectionRows = 0;
  for (let i = 0; i < lines.length && used < budget; i++) {
    if (isHead(lines[i])) { sectionRows = 0; continue; }
    if (keep[i]) continue;
    if (sectionRows < 150) { keep[i] = true; used += lines[i].length + 1; sectionRows++; }
  }
  const out = lines.filter((l, i) => keep[i]).join('\n');
  return out + '\n\n(NOTE: the catalog was trimmed to fit — rows that match the question were kept in full; other sections show their first rows only. If a product or account is not listed, say it is not in this excerpt rather than that it does not exist.)';
}

export const handler = async (event) => {
  try { connectLambda(event); } catch (e) {} // wire Blobs context into this handler-style function

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (e) {}
  const id = String(payload.id || '');
  const question = String(payload.question || '').slice(0, 2000).trim();
  const catalogRaw = String(payload.catalog || '').slice(0, 500000);
  const history = Array.isArray(payload.history) ? payload.history.slice(-4) : [];
  const who = payload.who || { role: 'viewer', tag: '' };
  const mode = String(payload.mode || '');   // 'draft' = Draft with AI: short prompt, wants depth
  if (!id) return { statusCode: 400, body: 'no id' };

  let store = null;
  try { store = getStore('ask'); } catch (e) {}
  const finish = async (obj) => { if (store) { try { await store.setJSON('res-' + id, { ...obj, at: new Date().toISOString() }); } catch (e) {} } };
  // a progress marker, so a poll can tell "the worker is on it" from "nothing ever started"
  const stage = async (s) => { if (store) { try { await store.setJSON('res-' + id, { pending: true, stage: s, provider: provider(), at: new Date().toISOString() }); } catch (e) {} } };
  await stage('started');

  // The dashboard sends its whole catalog (up to 500 KB). A "how many X do we have"
  // question needs the rows about X, the section headers and a slice of everything
  // else — not 120k tokens. Trimming is what makes a free-tier Flash answer in seconds.
  const catalog = trimCatalog(catalogRaw, question, 140000);
  if (!question || !catalog) { await finish({ error: 'Missing question or catalog' }); return { statusCode: 200, body: 'bad input' }; }
  if (!hasKey()) { await finish({ error: (provider() === 'gemini' ? 'GEMINI_API_KEY' : 'ANTHROPIC_API_KEY') + ' not configured' }); return { statusCode: 200, body: 'no key' }; }

  const msgs = [];
  for (const h of history) {
    if (h && h.q && h.a) {
      msgs.push({ role: 'user', content: String(h.q).slice(0, 2000) });
      msgs.push({ role: 'assistant', content: String(h.a).slice(0, 4000) });
    }
  }
  msgs.push({ role: 'user', content: question });

  const smart = isHardQuestion(question);
  const t0 = Date.now();
  await stage('context');
  let hqCtx = '';
  try { hqCtx = (await buildHqContext(who.role, who.tag)).slice(0, 60000); } catch (e) {}

  const system = SYSTEM +
            '\n\nROLE CONTEXT: The user\u2019s role is "' + who.role + '"' + (who.tag ? ' (specialist tag: ' + who.tag + ')' : '') + '.' +
            ' Everything below is already filtered to what this role is allowed to see.' +
            ' HARD RULES: never state or estimate product costs, margins, or supplier prices unless a UNIT COSTS section is present;' +
            ' for a sales-role user, order/quote data covers only their own accounts \u2014 if asked about other specialists\u2019 numbers beyond the leaderboard-style data provided, say that is outside their access;' +
            ' if asked for data with no section here, say the app has it on the relevant page but it is not available in this chat for their role.' +
            hqCtx +
            '\n\nLIVE DATA:\n' + catalog;

  await stage('model');
  // one call; lib/llm.mjs already retries on a rate limit and falls back across models/providers
  const out = await llm({ system, messages: msgs, maxTokens: smart ? 8000 : 2000, smart, depth: mode === 'draft' ? 'deep' : '' });
  const res = { answer: out.text, errMsg: out.error };
  const usedModel = out.model || provider();

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
