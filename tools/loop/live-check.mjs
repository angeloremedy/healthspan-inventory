#!/usr/bin/env node
/* Live check of https://hq.healthspan.ph for the nightly observer. Prints one JSON
   object: { ok, findings:[{loc, sev, msg}], info:{…} }. Never needs a login and never
   sends one: it loads the public sign-in shell, checks the deployed bundle is main's,
   probes one session-checked function (must answer 401, not 5xx), and — when a
   browser is available — records uncaught page errors and console errors.

   node tools/loop/live-check.mjs [--url https://hq.healthspan.ph] [--bundle app.<hash>.js]
   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright-core  (optional; else tries
   playwright-core, then playwright, else skips the browser part with a note) */
import { createRequire } from 'node:module';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = (arg('--url', 'https://hq.healthspan.ph')).replace(/\/$/, '');
const MAIN_BUNDLE = arg('--bundle', '');
const findings = [], info = {};
const add = (loc, sev, msg) => findings.push({ loc, sev, msg: String(msg).replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, 180) });

async function get(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try { const r = await fetch(url, { signal: ctl.signal, redirect: 'follow' }); return { status: r.status, text: await r.text() }; }
  catch (e) { return { status: 0, text: String(e && e.message || e) }; }
  finally { clearTimeout(t); }
}

// 1. the shell and its bundle
const home = await get(BASE + '/');
info.status = home.status;
if (home.status !== 200) add('/', 'fail', `home page answered ${home.status || 'nothing'}: ${home.text.slice(0, 80)}`);
const live = (home.text.match(/app\.[0-9a-f]{6,}\.js/) || [])[0] || '';
info.liveBundle = live; info.mainBundle = MAIN_BUNDLE;
if (home.status === 200 && !live) add('/', 'fail', 'home page does not reference an app bundle');
if (live) {
  const b = await get(BASE + '/' + live);
  if (b.status !== 200) add('/' + 'bundle', 'fail', `the app bundle the page loads answered ${b.status}`);
}
if (live && MAIN_BUNDLE && live !== MAIN_BUNDLE)
  add('deploy', 'fail', "the live site is not running main's build (a Netlify deploy failed or is stuck)");

// 2. a session-checked function must refuse politely, not crash
for (const fn of ['sales-export?ym=2026-01']) {
  const r = await get(BASE + '/.netlify/functions/' + fn);
  const name = fn.split('?')[0];
  if (r.status >= 500 || r.status === 0) add('fn/' + name, 'fail', `function without a session answered ${r.status || 'nothing'} (expected 401)`);
  else if (r.status !== 401) add('fn/' + name, 'warn', `function without a session answered ${r.status} (expected 401)`);
}

// 3. the browser: uncaught errors and console errors on the sign-in screen
let pw = null;
const req = createRequire(import.meta.url);
for (const m of [process.env.PLAYWRIGHT_MODULE, 'playwright-core', 'playwright'].filter(Boolean)) {
  try { pw = req(m.startsWith('/') ? m : m); break; } catch (e) {
    try { pw = req(path.join(process.env.npm_config_prefix || '', 'lib/node_modules', m)); break; } catch (e2) {}
  }
}
if (!pw) info.browser = 'skipped (no playwright module)';
else {
  let browser = null;
  const tries = [{ channel: 'chrome' }, {}, { executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' }];
  for (const o of tries) { try { browser = await pw.chromium.launch({ headless: true, ...o }); break; } catch (e) {} }
  if (!browser) info.browser = 'skipped (no browser could start)';
  else {
    const page = await browser.newPage();
    const seen = new Set();
    const once = (loc, sev, msg) => { const k = loc + msg; if (!seen.has(k)) { seen.add(k); add(loc, sev, msg); } };
    page.on('pageerror', e => once('browser', 'fail', 'uncaught error on the sign-in screen: ' + (e && e.message || e)));
    // "Failed to load resource" console lines carry no URL; the response listener names it instead
    page.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) once('browser', 'warn', 'console error on the sign-in screen: ' + m.text()); });
    page.on('response', r => { const u = r.url(); if (r.status() >= 400 && u.startsWith(BASE)) once('browser', 'warn', `the sign-in screen calls ${new URL(u).pathname} before anyone signs in and gets ${r.status()}`); });
    page.on('requestfailed', r => { const u = r.url(); if (u.startsWith(BASE)) once('browser', 'warn', 'request failed: ' + new URL(u).pathname + ' ' + (r.failure() || {}).errorText); });
    try {
      await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(3000);
      info.title = await page.title();
      const signin = await page.evaluate(() => !!document.querySelector('input[type=password]'));
      info.signinShown = signin;
      if (!signin) once('browser', 'fail', 'the sign-in form did not appear');
    } catch (e) { once('browser', 'fail', 'the page did not finish loading: ' + (e && e.message || e).split('\n')[0]); }
    info.browser = 'ran';
    await browser.close();
  }
}

console.log(JSON.stringify({ ok: !findings.some(f => f.sev === 'fail'), findings, info }, null, 1));
