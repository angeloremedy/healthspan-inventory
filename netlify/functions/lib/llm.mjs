// One door to every model the app talks to. Callers say what they want
// (system prompt, chat turns, output budget, smart-or-fast) and never which
// vendor; the vendor is an environment variable.
//
//   AI_PROVIDER        gemini | anthropic   (default: gemini if GEMINI_API_KEY is
//                      set, else anthropic)
//   GEMINI_API_KEY     from Google AI Studio (free tier: no card)
//   GEMINI_MODEL       default gemini-flash-latest;  GEMINI_MODEL_LITE default
//                      gemini-flash-lite-latest (the fallback when Flash is rate-limited)
//   GEMINI_PAID=1      say so once billing is on — lifts the free-tier data scrub
//   ANTHROPIC_API_KEY  kept as the safety net: if the primary provider fails or is
//                      rate-limited and this key exists, the call is retried on Claude
//
// Free-tier note (Gemini): prompts may be used for model improvement, so
// isFreeTier() lets callers leave unit costs and supplier payables out of the
// context. Everything else in HQ is ordinary sales/inventory data.

const FAST_CLAUDE = process.env.STOCKBOT_MODEL || 'claude-haiku-4-5-20251001';
const SMART_CLAUDE = process.env.STOCKBOT_SMART_MODEL || 'claude-sonnet-5';
const GEM_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const GEM_LITE = process.env.GEMINI_MODEL_LITE || 'gemini-flash-lite-latest';

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

async function callGemini({ system, messages, maxTokens, model, key }) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content || '') }] }));
  const body = { contents, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const resp = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!resp.ok) { const t = await resp.text(); const e = new Error('Gemini ' + resp.status + ': ' + t.slice(0, 200)); e.status = resp.status; throw e; }
  const out = await resp.json();
  const cand = (out.candidates || [])[0] || {};
  const text = ((cand.content || {}).parts || []).map(p => p.text || '').join('').trim();
  if (!text) { const e = new Error('Gemini returned no text' + (cand.finishReason ? ' (' + cand.finishReason + ')' : '')); e.status = 502; throw e; }
  return text;
}

async function callClaude({ system, messages, maxTokens, model, key }) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
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
    for (let tries = 0; tries < (a.retry ? 2 : 1); tries++) {
      try {
        const args = { system, messages, maxTokens, model: a.model, key: a.p === 'gemini' ? gk : ak };
        const text = a.p === 'gemini' ? await callGemini(args) : await callClaude(args);
        return { text, model: a.model, provider: a.p, error: '' };
      } catch (e) {
        errs.push(a.model + ': ' + (e.message || e));
        // a rate limit or a hiccup deserves one patient retry; anything else moves on
        if (a.retry && tries === 0 && (e.status === 429 || e.status >= 500)) { await sleep(4000 + Math.random() * 1000); continue; }
        break;
      }
    }
  }
  return { text: '', model: '', provider: provider(), error: errs.join(' | ').slice(0, 400) };
}
