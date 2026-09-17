# Healthspan HQ — working rules for any agent or person touching this repo

Live at https://hq.healthspan.ph (Netlify site `healthspan-inventory`, deploys `main`).
Read `README.md` (what it does), `ARCHITECTURE.md` (how), `PERMISSIONS.md` (who may),
`ROADMAP.md` (what is next and what is deliberately NOT built) before changing anything.

## Stack
- Front end: `index.html` shell + classic scripts `js/00-…` to `js/17-…` sharing ONE global
  lexical scope (no modules, no bundler at dev time). `tools/build.mjs` concatenates them
  in `index.html` tag order into `dist/app.<hash>.js` (esbuild, identifiers untouched).
- Backend: Netlify Functions in `netlify/functions/*.mjs` (+ `lib/`), Supabase (Postgres,
  RLS on every table), Netlify Blobs for caches. SQL lives ONLY in `SUPABASE-SETUP.md`
  (append a dated section; it is run by hand in the Supabase SQL editor).
- Tests: Node + jsdom, `npm test` (7 suites, ~470 checks). Build smoke: `npm run build`.
- Manuals: `tools/manuals/` (Python + reportlab) — see its README; every feature batch
  rebuilds all nine PDFs into `manuals/` (`directory.js` → `compose.py` → `pagecheck.py`
  → `coverage.js`).

## Commands
```
npm ci
npm test                       # must stay green
npm run build && node --check dist/app.*.js && rm -rf dist
node tools/manuals/directory.js && (cd tools/manuals && python3 compose.py ../../manuals-new && python3 pagecheck.py ../../manuals-new) && node tools/manuals/coverage.js
```

## Conventions (non-negotiable)
1. Every new view: sidebar item in `index.html`, `T` map + dispatch in `js/02-views.js`,
   `DESC` in `js/01`, `SHORT` in `js/09`, a `viewAllowed` rule, a PERMISSIONS.md row, a
   manual paragraph, and a directory rebuild. The coverage check fails otherwise.
2. Permissions: `viewAllowed()` is the one truth for pages; RLS is the one truth for data.
   Costs and margins are NEVER shown to sales managers or specialists. Notifications go
   only to the people who must act. Activity log is admin + super admin only.
3. Never call `prompt()`, `confirm()` or `alert()` — use `uiPrompt / uiConfirm / uiAlert /
   uiForm` from `js/00-dialogs.js` (a test fails otherwise).
4. Dates: `todayISO()` / `monthISO()` (Manila), never `new Date().toISOString().slice(0,10)`.
5. HTML built from data goes through `esc()`; anything inside an inline JS string through
   `jsq()`. Every mutation calls `audit()`.
6. Netlify functions: session-check with `lib/guard.mjs` (`sessionUser`), background
   jobs gate on `requireJobKey` (fail closed). No secret, token or key ever reaches the
   browser or a chat transcript.
7. Manuals carry no personal names; view-only banners never mention admin/super admin;
   royal blue `#00168F` on white; length order super admin → viewer.
8. Do not edit `manuals/*.pdf` by hand (generated), `SUPABASE-SETUP.md` history (append
   only), `netlify.toml` headers without a reason, or anything under `fonts/`.

## Protected paths (an agent must not modify these; a human does)
`SUPABASE-SETUP.md` (append-only, by the person running the SQL), `netlify.toml`,
`.github/workflows/`, `manuals/*.pdf` (regenerate via tools), `tools/manuals/content/_directory.json`
(generated), `fonts/`, `*.png`, `manifest.webmanifest`.

## Definition of done for a batch
`npm test` green · build smoke green · manuals rebuilt with `pagecheck: clean` and
`coverage` all "missing: —" · README / ARCHITECTURE / PERMISSIONS / ROADMAP updated ·
SQL (if any) appended to SUPABASE-SETUP.md and pasted for the human · a commit title +
description in the repo's voice (what changed, why, files, SQL to run first).
