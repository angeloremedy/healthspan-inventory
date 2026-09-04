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
//                      GEMINI_MODEL_LITE default gemini-3.5-flash-lite (the fallback);
//                      GEMINI_MODEL_DEEP default gemini-3.8-flash — used with medium
//                      thinking for depth:'deep' calls (short prompts that want the
//                      richest answer: Draft with AI, the planning review)
//   LLM_TIMEOUT_MS     per-attempt ceiling, default 45000 — a hung call never eats the
//                      whole job
//   GEMINI_PAID=1      say so once billing is on — lifts the free-tier data scrub
//   ANTHROPIC_API_KEY  kept as the safety net: if the primary provider fails or is
//                      rate-limited and this key exists, the call is retried on Claude
//   DEEPSEEK_API_KEY / MOONSHOT_API_KEY (Kimi) / GROQ_API_KEY / MISTRAL_API_KEY /
//   OPENROUTER_API_KEY / CEREBRAS_API_KEY — OpenAI-compatible providers, chosen in
//                      Settings → AI (app_settings.ai_provider) or AI_PROVIDER=<name>.
//                      Model overrides: DEEPSEEK_MODEL, MOONSHOT_MODEL, GROQ_MODEL,
//                      MISTRAL_MODEL, OPENROUTER_MODEL, CEREBRAS_MODEL
//
// Free-tier note (Gemini): prompts may be used for model improvement, so
// isFreeTier() lets callers leave unit costs and supplier payables out of the
// context. Everything else in HQ is ordinary sales/inventory data.

const FAST_CLAUDE = process.env.STOCKBOT_MODEL || 'claude-haiku-4-5-20251001';
const SMART_CLAUDE = process.env.STOCKBOT_SMART_MODEL || 'claude-sonnet-5';
const GEM_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEM_LITE = process.env.GEMINI_MODEL_LITE || 'gemini-3.5-flash-lite';
const GEM_DEEP = process.env.GEMINI_MODEL_DEEP || 'gemini-3.8-flash';
const timeoutMs = () => Math.max(200, parseInt(process.env.LLM_TIMEOUT_MS || '45000', 10) || 45000);

// Gemini 3 and 2.5 think before answering; for "read this table and answer" work
// the thinking is latency, not quality. 3.7/3.8 only go down to "low".
function thinkingFor(model, smart, deep) {
  const m = String(model).toLowerCase();
  if (/gemini-3\.[78]/.test(m) || /gemini-3\.1-pro/.test(m) || /gemini-3-pro/.test(m)) return { thinkingLevel: deep ? 'medium' : 'low' };
  if (/gemini-3/.test(m)) return { thinkingLevel: deep ? 'medium' : smart ? 'low' : 'minimal' };   // analysis questions get a little thinking
  if (/gemini-2\.5-flash/.test(m)) return deep ? { thinkingBudget: 4096 } : smart ? { thinkingBudget: 1024 } : { thinkingBudget: 0 };
  return null;
}
async function fetchT(url, opt) { // fetch with a hard ceiling
  const TIMEOUT_MS = timeoutMs(); const ac = new AbortController(); const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try { return await fetch(url, Object.assign({}, opt, { signal: ac.signal })); }
  catch (e) { if (e.name === 'AbortError') { const x = new Error('timed out after ' + Math.round(TIMEOUT_MS / 1000) + 's'); x.status = 408; throw x; } throw e; }
  finally { clearTimeout(t); }
}

// OpenAI-compatible vendors: one caller, three presets
export const COMPAT = {
  deepseek: { url: 'https://api.deepseek.com/v1', key: 'DEEPSEEK_API_KEY', model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', label: 'DeepSeek' },
  kimi:     { url: 'https://api.moonshot.ai/v1',  key: 'MOONSHOT_API_KEY', model: process.env.MOONSHOT_MODEL || 'kimi-latest', label: 'Kimi (Moonshot)' },
  groq:     { url: 'https://api.groq.com/openai/v1', key: 'GROQ_API_KEY', model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', label: 'Groq (Llama)' },
  mistral:  { url: 'https://api.mistral.ai/v1', key: 'MISTRAL_API_KEY', model: process.env.MISTRAL_MODEL || 'mistral-large-latest', label: 'Mistral' },
  openrouter:{ url: 'https://openrouter.ai/api/v1', key: 'OPENROUTER_API_KEY', model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free', label: 'OpenRouter (free models)' },
  cerebras: { url: 'https://api.cerebras.ai/v1', key: 'CEREBRAS_API_KEY', model: process.env.CEREBRAS_MODEL || 'llama-3.3-70b', label: 'Cerebras (Llama)' }
};
export const PROVIDERS = ['gemini', 'anthropic', 'deepseek', 'kimi', 'groq', 'mistral', 'openrouter', 'cerebras'];
let _pref = ''; // set per request from app_settings (Settings → AI); env AI_PROVIDER is the fallback
export function setProviderPref(p) { _pref = PROVIDERS.includes(String(p || '').toLowerCase()) ? String(p).toLowerCase() : ''; }
export function keyFor(p) { return p === 'gemini' ? process.env.GEMINI_API_KEY : p === 'anthropic' ? process.env.ANTHROPIC_API_KEY : COMPAT[p] ? process.env[COMPAT[p].key] : ''; }
export function keysPresent() { const o = {}; for (const p of PROVIDERS) o[p] = !!keyFor(p); return o; }
export function provider() {
  const p = _pref || String(process.env.AI_PROVIDER || '').toLowerCase();
  if (PROVIDERS.includes(p)) return p;
  return process.env.GEMINI_API_KEY ? 'gemini' : 'anthropic';
}
export function isFreeTier() { const p = provider(); return (p === 'gemini' && !process.env.GEMINI_PAID) || ['groq', 'mistral', 'openrouter', 'cerebras'].includes(p); } // free tiers may train on prompts
export function hasKey() { return !!keyFor(provider()); }
export function providerLabel() { const p = provider(); return p === 'gemini' ? 'Gemini' : p === 'anthropic' ? 'Claude' : (COMPAT[p] || {}).label || p; }

// the same heuristic the workers used to choose Sonnet over Haiku
export function isHardQuestion(q) {
  const qq = String(q || '').toLowerCase();
  return q.length > 250 || (q.match(/\?/g) || []).length >= 3 ||
    /why|analy|compare|recommend|report|plan\b|should we|strategy|trend|breakdown|summar|review|explain/.test(qq);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Models drift to "P1,234" or "PHP 1,234" for pesos; the house style is ₱1,234.
export function fixPeso(text) {
  return String(text || '')
    .replace(/(^|[\s(\[>—–-])(?:PHP|Php|php|PhP)\s?(\d)/g, '$1₱$2')
    .replace(/(^|[\s(\[>—–-])P\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?)/g, '$1₱$2')
    .replace(/(^|[\s(\[>—–-])P(\d{4,})/g, '$1₱$2')
    .replace(/₱\s+(\d)/g, '₱$1');
}

async function callGemini({ system, messages, maxTokens, model, key, noThinking, smart, deep }) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
  const body = { contents, generationConfig: { maxOutputTokens: Math.max(maxTokens, 1500), temperature: 0.3 } };
  const th = noThinking ? null : thinkingFor(model, smart, deep); if (th) body.generationConfig.thinkingConfig = th;
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

async function callCompat({ system, messages, maxTokens, model, key, base }) { // OpenAI chat-completions shape
  const msgs = (system ? [{ role: 'system', content: system }] : []).concat(messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') })));
  const resp = await fetchT(base + '/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages: msgs, max_tokens: maxTokens, temperature: 0.3 }) });
  if (!resp.ok) { const t = await resp.text(); const e = new Error(model + ' ' + resp.status + ': ' + t.slice(0, 200)); e.status = resp.status; throw e; }
  const out = await resp.json();
  const text = String(((out.choices || [])[0] || {}).message?.content || '').trim();
  if (!text) { const e = new Error(model + ' returned no text'); e.status = 502; throw e; }
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
export async function llm({ system = '', messages = [], maxTokens = 2000, smart = false, depth = '' } = {}) {
  const gk = process.env.GEMINI_API_KEY, ak = process.env.ANTHROPIC_API_KEY;
  const deep = depth === 'deep'; if (deep) smart = true;
  const attempts = [];
  const P = provider();
  if (COMPAT[P]) { // DeepSeek / Kimi / Groq first, then whatever else has a key
    const c = COMPAT[P]; if (keyFor(P)) attempts.push({ p: P, model: c.model, retry: true, base: c.url, key: keyFor(P) });
    if (gk) attempts.push({ p: 'gemini', model: GEM_MODEL });
    if (ak) attempts.push({ p: 'anthropic', model: FAST_CLAUDE });
  } else if (P === 'gemini') {
    // deep = a short prompt that deserves the strongest Flash and real thinking; the
    // everyday model stays next in line so a rate limit on 3.8 never blocks the answer
    if (gk) { if (deep) attempts.push({ p: 'gemini', model: GEM_DEEP, retry: true, deep: true }); attempts.push({ p: 'gemini', model: GEM_MODEL, retry: !deep }); attempts.push({ p: 'gemini', model: GEM_LITE }); }
    if (ak) attempts.push({ p: 'anthropic', model: deep ? SMART_CLAUDE : FAST_CLAUDE });
  } else {
    if (ak) { attempts.push({ p: 'anthropic', model: smart ? SMART_CLAUDE : FAST_CLAUDE }); if (smart) attempts.push({ p: 'anthropic', model: FAST_CLAUDE }); }
    if (gk) attempts.push({ p: 'gemini', model: deep ? GEM_DEEP : GEM_MODEL, deep });
  }
  if (!attempts.length) return { text: '', model: '', provider: P, error: (P === 'gemini' ? 'GEMINI_API_KEY' : P === 'anthropic' ? 'ANTHROPIC_API_KEY' : (COMPAT[P] || {}).key || 'API key') + ' not configured' };
  const errs = [];
  for (const a of attempts) {
    let noThinking = false;
    for (let tries = 0; tries < 3; tries++) {
      try {
        const args = { system, messages, maxTokens, model: a.model, key: a.p === 'gemini' ? gk : ak, noThinking, smart, deep: !!a.deep };
        const text = fixPeso(a.base ? await callCompat(Object.assign(args, { base: a.base, key: a.key })) : a.p === 'gemini' ? await callGemini(args) : await callClaude(args));
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
