// One door to every model the app talks to. Callers say what they want
// (system prompt, chat turns, output budget, smart-or-fast) and never which
// vendor; the vendor is an environment variable.
//
//   AI_PROVIDER        gemini | anthropic   (default: gemini if GEMINI_API_KEY is
//                      set, else anthropic)
//   GEMINI_API_KEY     from Google AI Studio (free tier: no card)
//   GEMINI_MODEL       default gemini-3.6-flash (thinking set to minimal — the
//                      "-latest" alias points at 3.8 Flash, which thinks at length over a
//                      120k-token catalog and blows the 150 s the UI waits);
//                      GEMINI_MODEL_LITE default gemini-3.5-flash-lite (the fallback)
//   LLM_TIMEOUT_MS     per-attempt ceiling, default 45000 — a hung call never eats the
//                      whole job
//   GEMINI_PAID=1      say so once billing is on — lifts the free-tier data scrub
//   ANTHROPIC_API_KEY  kept as the safety net: if the primary provider fails or is
//                      rate-limited and this key exists, the call is retried on Claude
//
// Free-tier note (Gemini): prompts may be used for model improvement, so
// isFreeTier() lets callers leave unit costs and supplier payables out of the
// context. Everything else in HQ is ordinary sales/inventory data.

const FAST_CLAUDE = process.env.STOCKBOT_MODEL || 'claude-haiku-4-5-20251001';
const SMART_CLAUDE = process.env.STOCKBOT_SMART_MODEL || 'claude-sonnet-5';
const GEM_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEM_LITE = process.env.GEMINI_MODEL_LITE || 'gemini-3.5-flash-lite';
const timeoutMs = () => Math.max(200, parseInt(process.env.LLM_TIMEOUT_MS || '45000', 10) || 45000);

// Gemini 3 and 2.5 think before answering; for "read this table and answer" work
// the thinking is latency, not quality. 3.7/3.8 only go down to "low".
function thinkingFor(model, smart) {
  const m = String(model).toLowerCase();
  if (/gemini-3\.[78]/.test(m) || /gemini-3\.1-pro/.test(m) || /gemini-3-pro/.test(m)) return { thinkingLevel: 'low' };
  if (/gemini-3/.test(m)) return { thinkingLevel: smart ? 'low' : 'minimal' };   // analysis questions get a little thinking
  if (/gemini-2\.5-flash/.test(m)) return smart ? { thinkingBudget: 1024 } : { thinkingBudget: 0 };
  return null;
}
async function fetchT(url, opt) { // fetch with a hard ceiling
  const TIMEOUT_MS = timeoutMs(); const ac = new AbortController(); const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try { return await fetch(url, Object.assign({}, opt, { signal: ac.signal })); }
  catch (e) { if (e.name === 'AbortError') { const x = new Error('timed out after ' + Math.round(TIMEOUT_MS / 1000) + 's'); x.status = 408; throw x; } throw e; }
  finally { clearTimeout(t); }
}

export function provider() {
  const p = String(process.env.AI_PROVIDER || '').toLowerCase();
  if (p === 'gemini' || p === 'anthropic') return p;
  return process.env.GEMINI_API_KEY ? 'gemini' : 'anthropic';
}
export function isFreeTier() { return provider() === 'gemini' && !process.env.GEMINI_PAID; }
export function hasKey() { return provider() === 'gemini' ? !!process.env.GEMINI_API_KEY : !!process.env.ANTHROPIC_API_KEY; }
export function providerLabel() { return provider() === 'gemini' ? 'Gemini' : 'Claude'; }

// the same heuristic the workers used to choose Sonnet over Haiku
export function isHardQuestion(q) {
  const qq = String(q || '').toLowerCase();
  return q.length > 250 || (q.match(/\?/g) || []).length >= 3 ||
    /why|analy|compare|recommend|report|plan\b|should we|strategy|trend|breakdown|summar|review|explain/.test(qq);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callGemini({ system, messages, maxTokens, model, key, noThinking, smart }) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
  const body = { contents, generationConfig: { maxOutputTokens: Math.max(maxTokens, 1500), temperature: 0.3 } };
  const th = noThinking ? null : thinkingFor(model, smart); if (th) body.generationConfig.thinkingConfig = th;
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const resp = await fetchT(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
  if (!resp.ok) { const t = await resp.text();
    // an unsupported thinking setting is a 400 — say so once, the caller retries without it
    if (resp.status === 400 && th && /thinking/i.test(t)) { const e = new Error('Gemini 400 thinking: ' + t.slice(0, 160)); e.status = 400; e.thinking = true; throw e; }
    const e = new Error('Gemini ' + resp.status + ': ' + t.slice(0, 200)); e.status = resp.status; throw e; }
  const out = await resp.json();
  const cand = (out.candidates || [])[0] || {};
  const text = ((cand.content || {}).parts || []).map(p => p.text || '').join('').trim();
  if (!text) { const e = new Error('Gemini returned no text' + (cand.finishReason ? ' (' + cand.finishReason + ')' : '')); e.status = 502; throw e; }
  return text;
}

async function callClaude({ system, messages, maxTokens, model, key }) {
  const resp = await fetchT('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages })
  });
  if (!resp.ok) { const t = await resp.text(); const e = new Error('Claude ' + resp.status + ': ' + t.slice(0, 200)); e.status = resp.status; throw e; }
  const out = await resp.json();
  const text = (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  if (!text) { const e = new Error('Claude returned no text'); e.status = 502; throw e; }
  return text;
}

/**
 * llm({system, messages, maxTokens, smart}) → { text, model, provider, error }
 * Never throws. Order of attempts:
 *   gemini:    Flash → (429/5xx) wait, Flash again → Flash-Lite → Claude fast if a key exists
 *   anthropic: smart/fast Claude → fast Claude → Gemini Flash if a key exists
 */
export async function llm({ system = '', messages = [], maxTokens = 2000, smart = false } = {}) {
  const gk = process.env.GEMINI_API_KEY, ak = process.env.ANTHROPIC_API_KEY;
  const attempts = [];
  if (provider() === 'gemini') {
    if (gk) { attempts.push({ p: 'gemini', model: GEM_MODEL, retry: true }); attempts.push({ p: 'gemini', model: GEM_LITE }); }
    if (ak) attempts.push({ p: 'anthropic', model: FAST_CLAUDE });
  } else {
    if (ak) { attempts.push({ p: 'anthropic', model: smart ? SMART_CLAUDE : FAST_CLAUDE }); if (smart) attempts.push({ p: 'anthropic', model: FAST_CLAUDE }); }
    if (gk) attempts.push({ p: 'gemini', model: GEM_MODEL });
  }
  if (!attempts.length) return { text: '', model: '', provider: provider(), error: (provider() === 'gemini' ? 'GEMINI_API_KEY' : 'ANTHROPIC_API_KEY') + ' not configured' };
  const errs = [];
  for (const a of attempts) {
    let noThinking = false;
    for (let tries = 0; tries < 3; tries++) {
      try {
        const args = { system, messages, maxTokens, model: a.model, key: a.p === 'gemini' ? gk : ak, noThinking, smart };
        const text = a.p === 'gemini' ? await callGemini(args) : await callClaude(args);
        return { text, model: a.model, provider: a.p, error: '' };
      } catch (e) {
        errs.push(a.model + ': ' + (e.message || e));
        if (e.thinking && !noThinking) { noThinking = true; continue; }                 // same model, thinking left at default
        // a rate limit or a hiccup deserves one patient retry; a timeout or anything else moves on
        if (a.retry && tries === 0 && (e.status === 429 || (e.status >= 500 && e.status < 600))) { await sleep(4000 + Math.random() * 1000); continue; }
        break;
      }
    }
  }
  return { text: '', model: '', provider: provider(), error: errs.join(' | ').slice(0, 400) };
}
