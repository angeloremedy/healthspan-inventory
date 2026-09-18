# HANDOFF — Healthspan HQ · written 2026-09-18

This is the full memory of the project for whoever (Claude or a person) continues it in a new
chat. Read it end to end, then `CLAUDE.md`, `ROADMAP.md`, `PERMISSIONS.md`, `ARCHITECTURE.md`,
`README.md`. Everything here was agreed with Angelo in conversation; where a rule and the code
disagree, the rule wins and the code is fixed.

---

## 1. Identity

| | |
|---|---|
| Product | **Healthspan HQ** — Healthspan Global Inc.'s in-house ERP + CRM + WMS, replacing Shopify (orders/catalog), Zoho (CRM) and Verna's Google Sheet (warehouse truth). Live at **https://hq.healthspan.ph**, installable PWA. |
| Owner / developer | **Angelo Mojica** (angelo@remedy.ph) — super admin, sole developer, runs every deploy and every SQL. Works from a MacBook Air, zsh, Terminal. Also owns Remedy Skin Solutions' tech (remedy.ph, Zenoti) — separate skills cover that. |
| Repo | `github.com/angeloremedy/healthspan-inventory` (private). Clone: `~/dev/healthspan-inventory`. Netlify site `healthspan-inventory` deploys `main`. |
| Stack | `index.html` shell + classic scripts `js/00-dialogs.js` … `js/18-search.js` (ONE shared global lexical scope, no modules); `tools/build.mjs` concatenates in tag order → `dist/app.<hash>.js` (esbuild, identifiers untouched). Netlify Functions `netlify/functions/*.mjs` + `lib/`. Supabase (Postgres, RLS on every table, Auth). Netlify Blobs for caches (`sync`, `shopify`, `reports`, `ask`). Google Sheets (Verna's sheet + accounting sheet) read via API key. Shopify Admin API (GraphQL) read side. Gemini (default) / Anthropic for Ask Healthspan. Slack `/stock` bot. Google Drive service account for attachments and decks. QuickBooks Online via OAuth. |
| Tests | Node + jsdom, `npm test` — 10 suites, ~540 checks. Build smoke `npm run build && node --check dist/app.*.js`. |
| CI | `.github/workflows/check.yml` (push/PR/dispatch: `npm ci`, `TZ=Asia/Manila npm test`, build smoke, `node tools/manuals/coverage.js`), `manuals.yml` (nightly 18:00 UTC + dispatch: rebuild PDFs, open a PR if changed — Ubuntu fonts unverified), `claude-preflight.yml` (manual: proves Claude Code auth on the runner). |
| Notion | Roadmap page `3c8571312c7e803e9fc7e7492a6c8d9d` ("Healthspan Platform — Roadmap"), mirrors `ROADMAP.md`. Updated via the Notion MCP `update_content` (search-and-replace on "Last updated: …" and the "Shipped so far" heading). |
| Google Sheets | Verna's master sheet id `1tgedHZhpaMkHZqKElL13jBm9f90HRzsW5EkoL8QaW24` (Targets tab has no INNO LINE row — that is why Inno was "missing" on Sales vs target; the app now lists untargeted lines). Accounting sheet `1sofu7UlHTqtTM10ZVyNBYsSlBDIEJ5piPwULILOAGao`. |
| Last commit | `133777e` — "App-wide audit…" on `main`. Working tree clean at hand-off except this file. |

## 2. People (never put personal names in the manuals)

| Role in HQ | People | Notes |
|---|---|---|
| super admin | Angelo | Cutover switches, permanent deletes, Team & access, keys. DB-enforced via `profiles.is_super`. |
| admin | Paul, Dr. April | Full data visibility and operational control, not system admin. |
| manager (sales manager) | Marj | Reads costs nowhere. Reported Inno missing on Sales vs target. |
| sales (product specialist) | Rhas, Tin, Rechel, Charmaine, Ruth, Joy, Jonathan, RJ + rest of PS team | Own rows only (RLS by `specialist_tag`). |
| supply_chain | Verna (+ Joemar) | Verna = warehouse truth; Receiving page was built for her. Joemar and Rose are the only staff who will clock in (HR Phase 2). |
| finance | Alex, Tal, Sean | **Sean owns the accounting rules** (QBO). Alex sent the drawer-trap video. |
| marketing | Maricris, Mench | Mench's weekly Calendar of Events → Sales events page. |
| viewer | Maria, Justine, Ivy, Agnes | Meeting attendees, read-only circle. **Agnes = HR manager** (confirmed HRIS+payroll go into HQ). **Justine = IT**, holds `can_manage_ps` (creates/disables PS accounts only). |
| product lines | Meso(estetic), Termosalud (Symmed/Zionic), Mark-Vu, Line-Vu, GTG, Inno, SkinPen, Epigen… | Termosalud / Mark-Vu / Line-Vu / GTG are VAT-exempt. "Inno" is a line, not a person. |

Remedy side (Angelo's other company): Remedy Skin Solutions, three clinics (BGC, Vertis North, Skin Bar Greenhills), Zenoti today, planning its own Zenoti replacement (see §9).

## 3. Standing agreements — every one still binding

**Delivery**
1. Every batch ends with a **commit title + description** in the repo's voice (what changed, why, files, SQL to run first). If the previous batch was not pushed, **combine** the messages.
2. Any SQL is **pasted in chat** AND **appended to `SUPABASE-SETUP.md`** (append-only, dated section). Angelo runs it by hand in the Supabase SQL editor. Never assume it ran — ask/confirm.
3. `ROADMAP.md` + the Notion roadmap page updated **every batch**. `README.md` + `ARCHITECTURE.md` every batch. `PERMISSIONS.md` whenever permissions change.
4. **All nine role PDF manuals rebuilt every feature batch**:
   `node tools/manuals/directory.js` → `(cd tools/manuals && python3 compose.py ../../manuals-new && python3 pagecheck.py ../../manuals-new)` → `node tools/manuals/coverage.js` → copy `manuals-new/*.pdf` to `manuals/`. Must print `pagecheck: clean` and every role `missing: —`. Manuals: no widows/orphans, a Contents page, a per-role complete page directory appendix; **no personal names**; view-only banners **never mention admin/super admin**; royal blue `#00168F` on white; **length order super admin (longest) → viewer (shortest)** (today 37/35/26/23/23/18/17/14/12 pages). Content lives in `tools/manuals/content/HQ-Manual-N-*.json`; edit the JSON, never the PDF.
5. The PPTX training deck is meant to stay evergreen (its generator was lost — rebuild is a parked task).
6. **Ship = the 4-line git block** from `~/dev/healthspan-inventory` (`git status --short` / `git add -A && git commit -m "…" -m "…"` / `git push` / `gh run list --limit 3`). Drag-and-drop to GitHub/Netlify is **retired**. Netlify deploys `main` automatically in 1–2 minutes.
7. Claude edits files **directly in the mounted clone** (`/Users/angelomojica/dev/healthspan-inventory`; sandbox path `/sessions/<name>/mnt/healthspan-inventory`). The old `outputs/repo` working tree is retired. **Never run git write commands from the sandbox** (`stash`, `rm --cached`, `reset`, `add`): the sandbox cannot delete files, so it leaves `.git/index.lock` and stray objects behind. Read-only `git --no-optional-locks status|diff|log|show` is fine. If Angelo hits `index.lock`: `rm -f .git/index.lock`.
8. Command blocks for Angelo: **no `#` comment lines, no `<placeholders>`**, absolute/known paths, one block, explain what it does in one line before, he pastes the output back. He is not a git expert — explain git in plain terms when asked ("three copies: your Mac, GitHub, Netlify").

**Product rules**
9. `viewAllowed()` (js/02) is the one truth for **pages**; RLS is the one truth for **data**. Per-person overrides `profiles.view_grants / view_denies` (deny wins; `NEVER_GRANT` list for cost/system pages; specialists cannot be granted warehouse/finance/all-team sales pages).
10. **Costs and margins are never shown to sales managers or specialists** (valuation, PO unit costs, landed cost, supplier scorecard, service cost, delivery cost, saved-report cost columns, search result lines).
11. **Notifications only to the people who must act.** Activity log = admin + super admin only.
12. Never `prompt()/confirm()/alert()` — use `uiPrompt / uiConfirm / uiAlert / uiForm` from `js/00-dialogs.js` (a test fails otherwise). Angelo: "I don't want that type of inputting."
13. Dates: `todayISO()`, `monthISO()`, `daysISO(n)`, `monthsISO(n)` — Manila. Never `new Date().toISOString().slice(0,10)` (the audit test fails on it).
14. HTML from data through `esc()`; anything inside an inline JS string through `jsq()`. Every mutation calls `audit()`.
15. Netlify functions: `sessionUser(event)` from `lib/guard.mjs`; background jobs `requireJobKey` (503 when `JOB_KEY` unset, 403 mismatch, timing-safe). Slack posts only to `hooks.slack.com` (`isSlackHook`). Never derive origin from the `Host` header.
16. **No key, token or secret ever in chat, UI or repo** — Netlify env / GitHub secrets only. Angelo pastes `gh secret set` outputs (asterisks) — never the value.
17. Every new view needs: sidebar item in `index.html`, `T` map + dispatch in `js/02`, `DESC` in `js/01`, `SHORT` in `js/09`, a `viewAllowed` rule, a `PERMISSIONS.md` row, a manual paragraph, a directory rebuild — `coverage.js` fails otherwise.
18. Protected paths an agent must not modify: `SUPABASE-SETUP.md` history, `netlify.toml`, `.github/workflows/`, `manuals/*.pdf`, `tools/manuals/content/_directory.json`, `fonts/`, `*.png`, `manifest.webmanifest`. (Claude may still edit workflows *with Angelo in chat*; the rule is for the autonomous loop.)
19. UX preferences from Angelo: no repetitive chrome ("Sync now · auto every 15 min" is one footer line); no redundant choosers (Finance forms chooser removed); "+ New order" hidden for roles that cannot order; manuals must have a TOC and be complete per role; hyperlinks are buttons.

**Business rules (from ROADMAP "Standing decisions")**
- Truth today: Verna's sheet = warehouse · accounting sheet = booked sales · Supabase = orders/CRM · Shopify = pricing (until item master).
- Deal "+1"s are deal units, not free items; "free" = ₱0 outside any deal. Kits: deal units never added on top of itemised kits.
- Pull-outs (customer name contains "pull-out"), Remedy and Healthspan accounts are **internal, never sales**; "test/dummy/sample" accounts skipped everywhere.
- Specialist aliases in `SPEC_ALIAS`; curated account groups in `account_links`.
- Period close is enforced in Postgres (triggers): closed months freeze orders, CMs, cheques, targets.
- Sales-stats switchover happens at cutover only (no double-counting during the parallel run).

## 4. Scope boundaries (decided 2026-09-08, one reversed 2026-09-10)

- **QuickBooks Online stays the book of record.** HQ is the sub-ledger (AR, payments, PDCs, CMs, AP, landed cost, valuation, commissions, period close) and feeds QBO through a connector. We are **not** building a GL.
- **Sprout (HRIS + payroll) — reversed**: Agnes confirmed Healthspan wants it in HQ → Workstream E (§8).
- Payment processing stays bank transfer + accounting. Zenoti/clinic systems belong to Remedy, not HQ.

## 5. What was built this stretch (Sep 8 → Sep 18) — details worth remembering

- **Sep 8 (two builds)**: footer Sync one-liner; Finance forms chooser removed; receipts staged in-form (required for expense reimbursement/report); manuals widow/orphan control + Contents + per-role directory; serial warranty/holder/service history (rule 12 nightly); review checkpoints (15th/month-end self-freeze, rule 10b); **Saved reports** (`js/15-report-engine.js` browser+CommonJS `RPT_SOURCES/rptRun/rptCSV/rptDue`, `lib/report-runner.mjs`, `report-run.mjs`, `reports-schedule.mjs` 22:00 UTC; owner's role and tag looked up fresh); app-wide **security audit #1** (hs_role() RLS hardening, JOB_KEY fail-closed, deep links through viewAllowed, admin password reset super-only); **Receiving** (`js/17`: shipments/shipment_lines, `shipLanded()` pure calc — VAT recoverable excluded, alloc by value/qty; `shipPost` → ledger/quarantine; rule 13 past-ETA); complaints split (customer vs supplier claims); delivery cost per order; **all ~370 browser dialogs → in-app** (`tools/dedialog.mjs` acorn codemod); Team & access one edit form incl. e-mail change + per-person page access; Sales vs target "no target set" rows.
- **Sep 10**: Sprout decision reversed; HR Workstream E planned (§8). `CLAUDE.md`, `.gitignore`, `check.yml`, `manuals.yml`.
- **Sep 17 (git migration)**: clone at `~/dev/healthspan-inventory`; commit `130815a` pushed; **Claude Code subscription token** stored as repo secret `CLAUDE_CODE_OAUTH_TOKEN` (via `claude setup-token` → `gh secret set`); `claude-preflight.yml` green in 14 s. Subscription usage, no API billing; only Claude Code / Agent SDK accept that token — Ask Healthspan (Messages API) cannot, so it stays on Gemini with a capped key.
- **Sep 17 (search + drawer, commit `89a59d1`)**: `js/18-search.js` — sidebar box (`#navq`, ⌘K, arrows/Enter/Esc) and phone menu box (`#mmq`, wraps `buildMobileMenu`) find records: `srDocParse` turns printed numbers (HS-1042, HG-10142, QT-0007, PO-1005, RCV-12, TR-1003, PL-1003, C-5, LN-104, CM-1003, WV-104, V-/RO-/PP-/RP-/RE-/CA-/ER-) back into `{kind,n}` via `DOCFMT`; `srKinds()` maps kinds to the `viewAllowed` page that owns them; memory first, then RLS-scoped `limit`ed queries; specialists get own quotes/orders and accounts from their own orders; hits open the existing page/drawer or land on the list with `srHighlight` flash (`window._poOpen`, `SHIP_OPEN` pre-set); `audit('search.open')`. **Drawer fix** (Alex's video: SKU panel slid under top bar/bottom tabs, ✕ hidden, ← moved the page behind): `MutationObserver` on `#drawer` pushes one history entry; `closeDrawer(silent)` walks back with `_drawerPopSkip`; `applyRoute` closes an open drawer instead of navigating; `pushRoute` closes silently; sticky `.dhead` with ← Back/✕; on phones `body.authed .drawer` spans between top bar and tabs. Test `tools/test/search-drawer.test.js` (44).
- **Sep 17–18 (audit, commit `133777e`)**: three passes — static (acorn: declared vs referenced identifiers, duplicates; none found), runtime **role × view matrix** (`tools/test/role-view-matrix.test.js`: every page × 8 role profiles in jsdom against a fake Supabase answering `[]`; catches throws, refused pages that render, stuck loading; verified with an injected canary), two subagent reviews (server functions; views' escaping/costs/permissions). **Fixed**: render→`loadShopify`→render **hot loop** when the sales cache is down/building/offline (6 sites now guarded by `window._shopWaitRef`; `loadVisits` never leaves `VISITS` null — that second one caused a startup loop mid-audit); **permission mismatches vs RLS** — PDC register was inverted (finance refused, managers shown buttons the DB rejected) → `canPDC()=canFinance()`, page for admin/manager/finance; Returns page opens for finance + warehouse, record = admin/manager/finance, apply-CM = finance; `recordPayment` gate = `canFinance()`; Campaigns: marketing writes (`canCampaign`); finance steps: **no blanket admin approval** — route names you or super admin unsticks; PO write controls painted for `canWarehouse()` only; manager `viewAllowed` blocks `commissions`; finance edits Receiving money fields (`money=run||finance`); **server**: `admin-users` requires a UUID `id` (injection via `&select=`), `report-run mayOpen` requires every column of a shared run to be allowed for the caller (manager could download admin CSV with `delivery_cost`), `deck-to-drive` stamps `appProperties.hq_by` and share verifies stamp/folder/ownership, `upload link` uses RLS-as-caller like GET, `qbo-auth` timing-safe state + no fallback HMAC key + 503 when unconfigured, QBO literals strip backslashes and `kind` filters encoded, no `Host`-header origin fallbacks, `visits.mjs` retired to a 410 stub (browser fallbacks removed), `stockbot-work-background` reads `sync`/`shopify` blobs (HTTP endpoints need a session since Sep 8 — `/stock` was broken); **dates**: `daysISO/monthsISO` helpers, every UTC "today/this month" replaced; escaping nits (`js/07` branch tabs, `js/09` chat ids). Docs: README 10.5a, ARCHITECTURE 4.13–4.17, PERMISSIONS "2026-09-17 audit" + rows, ROADMAP Sep 17–18 block, manuals (finance PDC/returns/receiving, marketing campaigns, admin/super route-named approvals, manager commissions).
- Left for later from the audit (low): `items`/`pos` `select('*')` pull cost columns into browser memory for non-cost roles (not painted); trim upstream error bodies to fixed messages; CORS `*` on admin-users/ask/refresh/(visits); rate limits on Ask/upload; `asklog` day key is UTC.

## 6. Decisions made in conversation (with reasons)

- **Git is the deploy path** (Sep 17). Angelo asked "what does moving to git mean?" → explained as three copies kept in sync; push = upload; GitHub keeps every snapshot; checks run before anyone sees a bug.
- **Claude subscription token is only for the remedy-loop**; nothing deployed depends on it; it can be revoked in claude.ai settings; tied to Angelo's login (if his account leaves the Team, workflows stop — the reason to move to an org API key later, not cost). Not pay-as-you-go; shared with his interactive quota.
- **remedy-loop levels planned** (not scaffolded): Level 1 Observer (nightly Claude run reads check/manuals results, console errors, ROADMAP; files GitHub issues, no code changes) → Level 2 Repair (`agent:ready` label → fix on a branch, `npm test` + build + coverage, PR, human merge; allowed change classes: test fixes, manual paragraphs, copy, `viewAllowed` rows, small bugs; protected paths stay human) → Level 3 SPEC-driven build (payroll engine first). Recommendation given: start the loop when the HR module starts, not before.
- **QBO connector direction** (Sep 18) — see §7.
- **Supabase stays for now** (Sep 18) — see §9.

## 7. QuickBooks connector — the plan (decided, not started)

**Situation.** Two connectors exist:
1. **GCP connector** (`healthspan-qbo-shopify` project, `asia-southeast1`, Node 22 Cloud Functions gen2: `shopifyWebhook`, `processEvent`, `syncInventory`, `qboOauthConnect/Callback`; Firestore state; Pub/Sub + DLQ) — Shopify → QBO, **live since 2026-09-15**, code at `~/Documents/qbo-shopify-connector`. A handover zip (`qbo-connector-handover.zip`) and a skill (`qbo-sales-connector.skill`) were uploaded on 2026-09-18 — **re-upload both in the new chat**. QBO company HEALTHSPAN GLOBAL INC, realmId `9130351624495406`, PHP, Global edition.
2. **HQ's connector** (`netlify/functions/lib/qbo.mjs`, `lib/qbo-sync.mjs`, `qbo-admin.mjs`, `qbo-auth.mjs`, `qbo-sync-background.mjs`, `qbo-schedule.mjs`, `js/14-qbo-sync.js`), built Sep 6–8, **preview mode** (`app_settings.qbo_enabled` not '1'), scan-based and idempotent via `qbo_sync` rows; posts Invoice at fulfilment, class = specialist, auto Payments, pulls QBO payments back (CDC). Settings keys `qbo_*` in `app_settings` incl. `qbo_sources` (`native`|`all`).

**Sean's rules (live in the GCP connector; port these):** invoice at **order creation** regardless of payment; VAT **inclusive** — per line `TaxInclusiveAmt`=gross, `Amount`=net, never `UnitPrice`; sales tax code **11** ("12% S"), no-VAT code **10**; income account 501, deposit account 1150040066; class **Sales** `700000000000311267` on every line and header; **list price then a QuickBooks Discount row** (`QBO_DISCOUNT_STYLE=native`; fall back to per-line for mixed-VAT orders); **strict totals** — refuse unless predicted total = channel total to the centavo; **no automatic payments** (`SYNC_PAYMENTS=false`, Collections records by hand — a documented deviation); void only in the **same Manila month**, later months manual credit note; "Anonymous" customer fallback; 30-day default terms, "Due on receipt" honoured; refunds post as Refund Receipts (open question); edited orders follow `current_*` fields, refunded units added back; DocNumber ≤ 21 chars; invoice updates full (`sparse:false`); voided invoices never rewritten; VAT-exempt brands Termosalud/Mark-Vu/Line-Vu/GTG (`taxable:false`); stock: QBO is truth → Shopify every 5 min (`INVENTORY_SYNC=true`), **one writer per direction** (an old Intuit app echoed corrections and inflated 42 items on 2026-09-16). Known data issues: 6 duplicate QBO SKUs (C84, IC007, F9BV023, F5SP433, P5SP216, M105), ~78 QBO items with no channel SKU, 183 untracked Shopify variants (bundles/freebies — correctly skipped). Cutoff for the GCP backfill: `2026-09-14T17:40+08:00`.

**Angelo's question:** "Shopify × HQ × QBO so the Shopify switch is a single toggle." Options presented with pros/cons: (1) **HQ is the single QBO writer for both sources** — recommended; (2) HQ emits ORDER-CONTRACT events to a second GCP deployment (handover Option A); (3) embed the GCP mapping library in HQ (Option B).

**Decisions taken (2026-09-18):** post at **order creation** like Shopify today (one rule for both sources); **payments follow Sean's rule now** (no outbound) **with a `qbo_sync_payments` toggle** for when HQ is fully implemented; inbound QBO→HQ payment pull stays on. Architecture: Angelo asked for pros/cons and did not yet pick explicitly, but the recommendation on the table is (1) and the conversation proceeded on it — **confirm at the start of the next session**.

**Plan for (1):** port Sean's mapping into `lib/qbo.mjs` (tax-inclusive 11/10, class Sales fixed, native discount style reconstructing list price × qty − net from the catalog, DocNumber `HG-xxxx` for `source='shopify'` via `ext_ref`, `HS-xxxx` for native, strict totals, same-month void, Anonymous, `current_*`); keep the scan-based `qbo_sync` design; `qbo_sources` becomes the Shopify switch (`all` → `native`); **first deliverable = shadow reconciliation report**: HQ predicts every invoice the GCP connector already posted since the cutoff and diffs DocNumber / total / VAT / class / customer — a week of 100% matches is the go signal; then pause GCP `processEvent`, flip `qbo_enabled` with `sources=all`; GCP `syncInventory` keeps running until Shopify is retired; then `sources=native` and stop the Shopify import. HQ imports Shopify orders via `backfill-background.mjs` into `orders` (`source='shopify'`, `ext_ref='#HG-…'`, lines with net `amount`, `is_free`) on a ~15-min cadence — so QBO latency for Shopify orders becomes minutes, not seconds (accepted).

## 8. HR module — Workstream E (Sprout replacement)

Decided 2026-09-10 with Agnes. **Phase 1**: (1a) people & leave — apply/approve/reject, half days, HR-added leave types/credits, holidays; (1b) payroll engine + payslips — **semi-monthly 15/30, finance prepares, HR approves, finance releases**; taxes, SSS/PhilHealth/Pag-IBIG, 13th month, loans; (1c) BIR & government — 2316 generator, 1601-C, 1604-C alphalist, agency schedules; (1d) performance tracking. **Phase 2**: timekeeping (**only Joemar and Rose clock in**, everyone else fixed schedules), recruitment & onboarding, engagement/announcements. Guard-rails: two parallel payroll cycles beside Sprout; accountant sign-off on 2316/1601-C before cancelling Sprout; statutory tables editable with effective dates; salary = most restricted data (planned `hr` role; salary/IDs visible to hr, finance, super only — **decision pending whether admins Paul/Dr. April see salaries**). **Inputs needed before 1a**: Sprout exports (employee master, 2026 YTD payroll register, leave balances, loan schedules), pay policies, 2026 holiday list, bank file format. The payroll engine is the ideal first SPEC-driven remedy-loop module.

## 9. Supabase vs AWS — the discussion and the decision

Angelo asked for a Supabase alternative (they have AWS), then "is Supabase good long term" given Remedy's planned Zenoti replacement, then "I really want to move away from Supabase" (for HQ specifically), then, on seeing cost, **"we'll probably stay with Supabase for now."**

What was established: HQ leans on four Supabase pieces — Postgres+RLS (~70 tables), Auth/GoTrue (JWT, `auth.uid()` in every policy, admin user API used by `admin-users.mjs`), PostgREST (browser → DB directly, ~170 `SB.from()` call sites), and the service key. Postgres is the right long-term engine regardless of host; Zenoti-level volume (three clinics, ~5–10k transactions/month) is small for Postgres. AWS mapping: RDS Postgres (SQL runs unchanged; define our own `auth.uid()` reading PostgREST JWT claims so policies don't change), PostgREST self-hosted on ECS Fargate behind an ALB (browser code barely changes), Cognito (~4 days of auth rewrite) or self-hosted GoTrue (~1 day), S3 for Blobs, Secrets Manager; Netlify Functions can stay. Effort ~2–3 weeks; **cost ~$130–150/mo single-AZ, ~$200–250 Multi-AZ vs ~$35–85 on Supabase Pro** — i.e. 3–4×, plus owning patching/pages. Cheaper middle path: open-source Supabase stack on one EC2 (~$40–60, no redundancy). Neither Supabase nor AWS offers Philippine data residency today. Recommended sequencing if it ever happens: safety net first, finish Shopify cutover + QBO on Supabase, build Remedy's clinic system on the new platform greenfield, migrate HQ last.

**Decision: stay on Supabase.** Do the cheap safety net regardless: nightly `pg_dump` to an S3 bucket Angelo owns (extend `backup-background.mjs` or a small workflow), a `migrations/` folder + `psql` in CI so schema changes stop being pasted by hand, real Postgres container in `check.yml`. Long-term rules: multi-step business writes as Postgres functions (RPC); no Supabase-only features (Edge Functions, Realtime) in the critical path; **Remedy's clinic system = a separate Supabase project** on the same patterns; Supabase **Pro at cutover**; pooler on. Revisit AWS only for residency/compliance or a bill past ~$500/mo.

## 10. Open items / next steps (priority order)

1. **Confirm the `profiles.view_grants / view_denies` SQL ran** (`alter table public.profiles add column if not exists view_grants jsonb not null default '[]'::jsonb; … view_denies …`). Team & access → "pages" errors until it does.
2. **QBO single-writer** (§7): confirm architecture (1), then build the shadow reconciliation report, then port Sean's rules, then the `qbo_sync_payments` toggle, then cutover choreography (pause GCP processEvent, flip `qbo_enabled`, `sources=all`).
3. **Safety net** (§9): nightly dump to S3; `migrations/`; CI Postgres.
4. **HR inputs** (§8) → Phase 1a. Decide the `hr` role / admin salary visibility.
5. **remedy-loop Level 1 Observer** when HR starts (`observe.yml`, uses `CLAUDE_CODE_OAUTH_TOKEN`, preflight step, `concurrency: claude`, `max_turns`/budget caps).
6. Verify `check` is green on `133777e`; run `manuals.yml` by hand once (`gh workflow run manuals.yml` → `gh run watch`) — Ubuntu fonts for reportlab unverified.
7. Ask Sean/Tal to look at the PDC register (finance now sees "Record a cheque") and returns page; ask Alex to retry the SKU panel on her phone.
8. Roadmap backlog: Verna's feedback on Receiving; stock-ledger flip (`ledger_is_truth`); CSP report-only → enforced after a week of clean consoles; role×view matrix is done; admin-users/upload function tests; Notion direct push (needs token); standing orders + rebates; consignment; QBO cutover; Supabase Pro; legacy JWT keys off; audit leftovers (§5).
9. Parked: skill packaging tasks, gamification build, training PPTX generator, PWA offline cache (deliberately none).

## 11. Where things live (map)

- `js/00` dialogs (`uiPrompt/uiConfirm/uiAlert/uiForm`, `#uidlg`) · `js/01` data load, Shopify merge, `DESC`, `todayISO/monthISO/daysISO/monthsISO`, `esc/jsq`, `docNo/DOCFMT_DEFAULT` (HS-/QT-/CM-/PL-/PO-/TR-/C-/V-/RO-/PP-/RP-/RE-/CA-/LN-/WV-/ER-) · `js/02` `viewAllowed`, `showView`, dispatch, orders, new order, visits · `js/03` audit, roles (`roleIn/isSuper/canWarehouse/canFinance`), campaigns, returns (`canReturnAdd`), PDC (`canPDC`), catalog, scan · `js/04` targets, routing (`pushRoute/navBack/applyRoute`), account page · `js/05` home, Team & access (`userEdit/userPages`), specialist page, pick slip, `recordPayment` · `js/06` data health, customers, SKU drawer (`openDrawer/closeDrawer/drawerIsOpen`) · `js/07` aged inventory · `js/08` simulators · `js/09` Ask Healthspan, auth/session (`SB/SBUSER/SBPROFILE/ROLE`), `SHORT` · `js/10` ownership, POs, approvals, quotes, promos, notifications, mobile menu, cycle counts, complaints, suppliers, transfers, pull-outs, finance forms (`FIN_KINDS/FIN_SPEC/canDecideFin`), archive, numbering · `js/11` typeahead, serials, loans, waves · `js/12` business review · `js/13` decks · `js/14` QBO page · `js/15` report engine · `js/16` saved reports · `js/17` receiving · `js/18` search.
- Functions: `admin-users`, `ask` + `ask-work-background`, `asklog`, `automations-background` (nightly rules), `backfill-background` (Shopify → orders), `backup(-background)`, `deck-to-drive`, `manual`, `nightly`, `qbo-*`, `refresh` (Sheets snapshot, `buildSnapshot`), `report-run`, `reports-schedule`, `shopify(-build-background)`, `stockbot(-work-background)`, `sync-warm` (every 15 min), `upload`, `visits` (410 stub). `lib/`: `guard`, `llm`, `qbo`, `qbo-sync`, `report-runner`.
- Tests: `business-review`, `serials-loans-waves` (big catch-all; checks 19 script tags), `sales-internal-split`, `llm-provider`, `qbo-connector`, `saved-reports`, `security-guard`, `search-drawer`, `audit-2026-09-17`, `role-view-matrix` (needs `--max-old-space-size=2500`).
- Manuals toolkit `tools/manuals/{fw.py,compose.py,pagecheck.py,directory.js,coverage.js,README.md,content/}`; build `tools/build.mjs`; codemod `tools/dedialog.mjs`.

## 12. Technical gotchas learned the hard way

- jsdom tests: the app and any driver must run in **one** `w.eval` string — `let/const` globals are invisible across separate evals; assign `SB=…` not `window.SB=…`.
- Python-written test template literals: `\n` / `\.` inside them become real newlines / lost escapes — use `String.fromCharCode(10)`, `[.]{3}`, `indexOf`, or doubled backslashes.
- Async renderers throw inside promises: capture with `process.on('unhandledRejection')` + jsdom `VirtualConsole`, attributed to the current window.
- Any "if X is null → load → re-render" pattern is a hot loop when the load leaves X null — guard on change (`_shopWaitRef`) or never leave it null.
- reportlab: `keepWithNext`, `allowWidows=0`, `CondPageBreak`, `TableOfContents` via `multiBuild`; pagecheck y-threshold `30 < y`.
- Codemod made inner functions async — callers needed `await`.
- Netlify Blobs in tests → inject a store (`_useStore`). `connectLambda(event)` before `getStore` in v1 handlers.
- PostgREST: encode every user value in filters; `or(and(kind.eq.x,num.eq.7))` syntax works.
- The Cowork sandbox cannot delete files on the mount: no `rm -rf dist`, no git writes; `dist/` is gitignored anyway.
- Netlify `URL` env is set in prod; never fall back to `Host`.

## 13. Skills in the Claude project

`remedy-github-ship` (git/gh conventions for Angelo), `subscription-auth-ci` (Claude Code in CI on the Team subscription), `remedy-loop` (planner/builder/judge/observer/repair architecture — read before proposing agents), `qbo-sales-connector` (uploaded 2026-09-18), plus Remedy: `remedy-site-architecture`, `remedy-shopify-ops`, `remedy-zenoti-ops` (PII rules), `remedy-booking-clinics`, `remedy-treatments-catalog`, `remedy-brand-content`, `remedy-audit-backlog`, `mixi-creative-strategy`.

## 14. Terminal block Angelo uses every batch

```
cd ~/dev/healthspan-inventory
git status --short
git add -A && git commit -m "title" -m "description"
git push
gh run list --limit 3
```
