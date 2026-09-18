# Healthspan Platform — Architecture

How the app is built, in detail. Companion to [README.md](README.md) (usage) and
[SUPABASE-SETUP.md](SUPABASE-SETUP.md) (every SQL migration, in order).
Last updated: 2026-08-28.

---

## 1. Stack at a glance

| Layer | Technology | Notes |
|---|---|---|
| Frontend | **Modular SPA, one-step build** — `index.html` (shell + CSS) + 13 ordered classic scripts in `js/01…13` (vanilla JS, shared global scope, load order matters); `tools/build.mjs` ships them as ONE hashed, minified `app.<hash>.js` | Deployed by uploading files to the repo; Netlify runs `npm run build` and publishes `dist/`; PWA-installable |
| Hosting | **Netlify** — live at **hq.healthspan.ph** (healthspan-inventory.netlify.app underneath) | Auto-deploys from the GitHub repo `angeloremedy/healthspan-inventory` |
| Serverless | **Netlify Functions** (`netlify/functions/*.mjs`, Node ESM) | Background functions for long jobs |
| Blob cache | **Netlify Blobs** | Shopify sales cache, job status, question logs |
| Database & auth | **Supabase** (Postgres + GoTrue) — project `lesjigujcajxurmsmwwc` | Row-level security everywhere |
| Sheet data | **Google Sheets** (Verna's master file + accounting Sales Report) | Read-only, fetched client-side |
| Legacy source | **Shopify** (store `healthspan-global`) | Read-only; being replaced by native orders |
| AI | In-app Ask AI + Slack /stock bot | Async worker functions |

**Truth hierarchy** (a standing decision): Verna's sheet = warehouse/stock truth
until WMS Stage 2 · the accounting Sales Report sheet = booked-sales truth ·
Supabase = orders/CRM truth · Shopify = pricing truth and read-only history
until cutover.

**Stock-truth switch mechanics:** `stk()` reads the sheet until
`ledger_is_truth` is ON; then it reads `LSUMS` = OPENING rows of the latest
`ledger_epoch` + post-epoch movements (kind `count` rows are observations and
never sum). The opening snapshot is written from the Cutover page (super admin),
epoch-stamped in `app_settings.ledger_epoch`, and re-freezable (old epochs stay
on record but stop counting). Hosting decision: Supabase, no AWS — plain
Postgres = the portable exit strategy.

## 2. Deployment model

Deploys are still file uploads to GitHub (`upload/main` for `index.html` and
`js/`, `upload/main/netlify/functions` for functions). Netlify then runs
`npm run build` (`tools/build.mjs`, esbuild's transform API only) and publishes
`dist/`: `index.html` with the 13 `js/` tags replaced by one
`<script defer src="/app.<hash>.js">`, plus the static assets (icons, manifest,
fonts). The bundle is the 13 files concatenated in `index.html` order and
minified with `minifyIdentifiers:false` — global names are the app's public
surface (inline `onclick` handlers, `typeof fn==='function'` feature checks), so
only whitespace and syntax are compacted. The hash is the first 10 hex of
sha256 of the code, so an unchanged source yields the same filename. If esbuild
cannot be imported the build ships the plain concatenation with a warning; a
deploy never fails because of the minifier. Source stays in `js/` (the
headless tests read it directly); `dist/` is gitignored and rebuilt every time.
Vite proper (ES modules, code splitting, git-based deploys) remains on the
engineering track.

Environment variables (Netlify → Site settings → Environment):
- `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` — custom-app client credentials
- `SHOPIFY_STORE` — store handle (default `healthspan-global`)
- `SUPABASE_URL` — project URL
- `SUPABASE_SERVICE_KEY` — Supabase **secret** key (never in the page; grants
  service-role powers to functions only)

The page embeds the Supabase **publishable** key — public by design; all
security lives in RLS policies.

## 3. The frontend (`index.html` + `js/`)

`index.html` holds the CSS and HTML shell (sidebar + content div + mobile nav);
the application script is split into **nine ordered plain-script modules** in
`js/` (`01-…` through `09-…`), loaded sequentially with classic `<script src>`
tags. Plain scripts share one global scope, so the split is semantically
identical to the previous single inline script (verified byte-identical on
reassembly at split time). **Load order matters — never reorder the tags**, and
new top-level code goes in the module matching its feature area (or a new
`10-…` before the INIT block in `09`). Everything renders by setting
`$('content').innerHTML` from `render*()` functions.

Deploys: upload the changed `js/` file(s) and/or `index.html`; the build step
(section 2) turns them into one hashed bundle. A future step (post-cutover) may
graduate this layout to Vite proper (ES modules, code splitting) — the file
boundaries are already drawn for it.

### 3.1 Views & routing
- `showView(v, el)` is the single entry point. It enforces role guards
  (`SALES_OK` whitelist for specialists; managers blocked from `users` only),
  sets the title (`T` map) and description banner (`DESC` map), and calls the
  view's `render*()`.
- **Hash routing** for full-page entities: `#/v/{view}`, `#/a/{account}`,
  `#/o/{order}`, `#/s/{specialist}`, `#/p/{pickslip}`. `applyRoute()` parses on
  load and on `hashchange`; `pushRoute()` writes history (guarded by a
  `ROUTING` flag to prevent loops). Back/forward and deep links work.
- Role-based UI: `body.role-sales` CSS hides all non-sales nav;
  `body.role-manager` hides only Team & access. Guards are also enforced in
  `showView` — CSS is cosmetic, not security. Real security is RLS.

### 3.2 Data sources loaded client-side
1. **Sheet sync** (every 15 min + manual): Verna's master workbook via the
   Google Sheets API — products, batches (FEFO), IN/OUT movement, pull-outs,
   targets tab, accounting Summary tab. Column mapping is **header-name based**
   (survives inserted columns); ranges are open-ended (tabs can grow);
   footer-junk guards. Parsed into `DATA` (SKUs), `BATCHES`, `CUSTOMERS`
   (OUT-sheet accounts), monthly movement, `TARGETS`. Cached in localStorage
   for instant paint.
2. **Shopify sales cache** (`SHOPIFY`): a JSON blob built server-side (§4.2),
   fetched via `/.netlify/functions/shopify`. 13 months of demand, prices,
   deals, per-customer aggregates (`SHOPIFY.customers`), specialists from
   order tags.
3. **Supabase** (`SB` client): auth, profiles, visits, native+migrated orders,
   accounts (CRM fields), account_links, order_overrides.

### 3.3 The unified account index (CRM core)
`buildAcctIdx()` produces `ACCTBYNORM`: one entity per customer, keyed by
`custNorm(name)` (lowercase, punctuation stripped, `inc/corp/co/ltd/clinic/the`
removed). Sources merged in: OUT-sheet customers → Shopify customers → visit
log. Each entity keeps every raw spelling in `names` (used to match timeline
items later).

Cleanups and groupings, in order:
1. `acctDedup()` — collapses Shopify's doubled-name artifact ("X X" or
   "X X - Branch").
2. **Merge links** (`account_links` kind `merge`) — applied inside `get()`:
   a merged spelling funnels straight into its target entity.
3. `CURATED_GROUPS` — hardcoded confirmed groups (Aivee Group = A one + A2).
4. **Structural branches** — "X - Branch" groups under X when X exists as an
   account or ≥2 accounts share the prefix. Parent may be *virtual* (created
   just to hold children).
5. **Branch links** (`account_links` kind `branch`) — in-app curated
   parent/child, cycle-guarded.

`acctAgg(e)` rolls an entity + children into the numbers shown on cards.
`acctList()` returns top-level entities with a `src` tag
(`both|sheet|shopify|prospect`) — `prospect` = visit-log only. The Prospects
tab adds a token-overlap fuzzy matcher (shared name words ≥4 chars, score ≥ 0.5)
to flag likely spelling mismatches.

`ACCT_LINKS` loads from Supabase at sign-in (`loadAcctLinks`), and any
merge/unlink mutation reloads it and invalidates `ACCTBYNORM`.

### 3.4 Orders register
`loadNativeOrders()` reads the `orders` table (headers only — no line join):
- **Specialists** fetch only their own rows (`spec ilike` their tag + aliases) —
  near-instant.
- Others fetch all: first 1,000, then remaining pages **in parallel**
  (Supabase caps 1,000 rows/request).
- Session cache with a 2-minute TTL (`window._nordTs`); every mutation nulls
  `NORDERS` to force refresh.
- `window._MIGRATED` flips true when Shopify-sourced rows exist — the table is
  then the register for everything (pre-migration blob orders retired).

Order pages read `order_lines` on demand. Pagination is client-side
(50/100/250). Deletion is a soft delete (`deleted_at`) into a trash view;
purge is admin-only via RLS.

### 3.5 Performance decisions
- No `order_lines(count)` join in list queries (was the dominant cost).
- Parallel page fetches; per-role filtered fetch.
- Home page renders with zero awaits.
- localStorage caches: sheet snapshot, theme, remember-me, filters.

## 4. Netlify functions (`netlify/functions/`)

| Function | Purpose |
|---|---|
| `refresh.mjs` | `/api/sync`. Serves the inventory feed from a Netlify Blobs snapshot (store `sync`, key `data`) when it is under 15 min old; otherwise reads Google Sheets live via the exported `buildSnapshot(KEY)` and rewrites the snapshot. `?force=1` (the Sync button) always reads live. `?trace=1&sku=&batch=` (batch recall trace) stays live. Blobs unavailable → live, silently |
| `sync-warm.mjs` | Scheduled (`*/15 * * * *`, via `config.schedule`, nothing in netlify.toml). Imports `buildSnapshot` from `refresh.mjs`, stores the result in the same blob, logs one line with the duration. Never throws — a failed run leaves the previous snapshot in place |
| `shopify.mjs` | Serves the cached Shopify sales JSON from Blobs. The client keeps the last blob in IndexedDB (`hq`/`kv`/`shopify`, via `idbGet`/`idbSet` in `js/01`), paints from it, then calls `?since=<synced>`; a matching stamp gets a tiny `{unchanged:true}` instead of the multi-MB blob |
| `shopify-build-background.mjs` | Rebuilds the sales cache from Shopify GraphQL (13 months, 6-hour cadence, self-healing) |
| `backfill-background.mjs` | Full-history Shopify → Supabase migration; **re-runnable = payment-status sync** |
| `admin-users.mjs` | In-app account management (list/create/update/password/disable/enable) |
| `visits.mjs` | Legacy visit-log blob fallback (superseded by Supabase) |
| `ask.mjs` / `ask-work-background.mjs` | Ask AI: enqueue + async worker (smart/fast model routing) |
| `asklog.mjs` | Question log for quality monitoring |
| `stockbot.mjs` / `stockbot-work-background.mjs` | Slack /stock bot |
| `qbo-auth.mjs` | QuickBooks OAuth 2: `?action=start` returns the Intuit consent URL (super admin, session header); the Intuit callback (`?code&realmId&state`) exchanges the code, stores tokens in `qbo_tokens` with the service key and redirects to `/#/v/qbo`; `POST {action:'disconnect'}` revokes. `state` is an HMAC over who-started-it + expiry, so a callback we did not start is refused. Tokens never reach the browser |
| `qbo-admin.mjs` | What the QuickBooks sync page talks to. GET `status` / `lists` (tax codes, accounts) / `mappings` / `search&q=` / `log` for admin + finance; POST `settings` (super admin only — writes the `qbo_*` app_settings incl. `qbo_enabled`), `confirm` (a customer mapping), `retry` (a ledger row back to pending), `run` (kicks the worker) for admin + finance. Role derived server-side from `profiles` |
| `qbo-sync-background.mjs` | The 15-minute worker; JOB_KEY-guarded like every background job. Calls `runSync()` and logs one summary line |
| `qbo-schedule.mjs` | Scheduled `*/15 * * * *`: POSTs to the worker with the JOB_KEY. Cheap when nothing is connected or enabled |
| `lib/qbo.mjs` | One door to Intuit: token refresh (refresh tokens rotate on every use, die after 100 days idle), the query endpoint pinned to minor version 75, find-or-create for customer / item / class / department, the Invoice / Payment / CreditMemo builders (TaxInclusive, one tax code per line), CDC for payments, `fingerprint()` and `norm()`. Every Intuit error surfaces with Intuit's own Detail text |
| `lib/qbo-sync.mjs` | `runSync()` — the four passes (invoices, credit memos, payments out, payments in), the lock, the 150-per-run cap, the 5-attempt stop, and preview mode. See 4.7 |

### 4.1 Shopify access
The Jan-2026 retirement of `shpat_` tokens forced **client-credentials OAuth**:
each run exchanges `SHOPIFY_CLIENT_ID/SECRET` for a short-lived access token at
`/admin/oauth/access_token`, then calls the GraphQL Admin API (2025-01).
Customer names require the **protected customer data** grant (approved via a
version release + reinstall).

### 4.2 Line-item correctness (hard-won rules)
- **Order edits**: removed lines remain in `lineItems` with
  `currentQuantity: 0`. Both readers count `currentQuantity` (fallback
  `quantity`), skip zero, and scale money by `currentQuantity/quantity` —
  otherwise edited orders inflate totals and invent AR balances.
- **Deals**: a base-SKU line belongs to a deal when the same order carries a
  longer SKU containing it (contains-rule, min length 4). Deal +1 units are
  deal units, **not** free items. ₱0 outside any deal = true giveaway.
- **Payments**: `totalOutstandingSet` is the truth — never recompute from
  `totalReceived` (manually-marked-paid orders have received=0; the old
  `outst || total-paid` falsy-zero fallback fabricated ₱14M of AR).
  Cancelled/refunded → balance 0. Shopify "PAID" with outstanding > 0
  (50% down / PDC, or post-payment edits) → reclassified `partial` so AR
  sees it.
- **Exclusions**: first order tag `TEST` skipped; customers matching
  `/pull\s*-?\s*out/i` excluded from sales (kept in finance/logistics).
- **Terms**: parsed from free-text order notes via
  `/(\d{1,3})\s*(?:days?|dys?)\b/i` ("PDC 30 days" → 30).

### 4.3 Backfill idempotency
Every Shopify order maps to a **deterministic UUID**: `sha1('hs-order:' + name)`
formatted as a UUID. Orders upsert `on_conflict=ext_ref` with merge-duplicates;
lines are delete-then-insert per order. Accounts insert with ignore-duplicates —
**CRM edits are never overwritten**. Net effect: re-running the backfill
refreshes statuses/payments without duplicating anything. Job status is written
to a Netlify Blob (`shopify/backfill`; `shopify/backfill-recent` for the
15-minute `recent` mode). Since 2026-09-18 the import keeps centavos, Manila
dates and the QuickBooks snapshot `orders.qbo_src` — see 4.18.

### 4.4 `admin-users.mjs` security model
The browser never holds the service key. The function receives the caller's
Supabase session token (`Authorization: Bearer`), verifies it against
`/auth/v1/user`, checks the caller's profile, and only then
uses the service key for GoTrue admin endpoints (create user, set password,
`ban_duration` for disable/enable — `876000h` ≈ 100 years, `none` to lift).
Self-disable is rejected. Three privilege tiers:
- **admin** — full user management (7 assignable roles; `can_manage_ps` grantable on viewers = the "IT" pseudo-role).
- **super admin** (`profiles.is_super`, Angelo only) — additionally: permanent user deletion. The super account itself is protected server-side: disable/delete/password/role-change targeting it by anyone else → 403 + audit `user.PROTECTED`.
- **scoped PS-admin** (`profiles.can_manage_ps`, Justine/IT) — list, create (forced `role='sales'`), and disable/enable *sales-role targets only*; everything else 403.

### 4.5 Nightly jobs (2am Manila, JOB_KEY-guarded)
`manual.mjs` serves each signed-in user their role's PDF manual (bundled via
netlify.toml included_files; the /manuals/* static path is force-redirected

### js/11 — serials, loaners, waves, CRM activity

An eleventh classic script (index.html loads it after js/10, same global scope).
`attachTypeahead()` lives here too: the app's own filtered dropdown, used instead
of `<datalist>` on the account/product pickers, because iPadOS mangles native
datalists once they hold hundreds of options. Serial check-out flips the serial's
status with a `.eq('status','in_stock').select('id')` guard — zero rows back means
someone else took the unit, and the loan insert never happens.

### js/12 — the Business review

A twelfth script; nothing before it references it. `bizCompute(ym)` is a pure
read over the globals the other sales views use — `SALESIDX`/`netMonthly(...,true)`
for brand and product revenue (base + deal lines, always external), `specMerged()`
for specialist revenue, `ORDIDX` re-folded into one row per order for accounts,
top lists, first orders and cross-sell, `SHOPIFY.customers` for 90-day activity
and the going-quiet list, `TARGETS` for LINE / PRODUCT / SPECIALIST / TOTAL,
`VISITS`, `OWNERS`, `SERIALS`, `LOANS` — and returns one report object `R`. It
never creates a specialist from an owner tag or a visit author: the roster is
Shopify tags + specialist targets + the active roster, everything else only looks
up, so a manager who logs a visit does not get a slide. `bizTrends(R)` writes the
sentences from rules — deterministic, so the same figures always say the same
thing, and nothing leaves the browser. The only network calls are the two small
tables (`review_commentary`, `review_snapshots`) and, on demand, the existing
`/.netlify/functions/ask` job for **Draft with AI**, which is sent the report
figures as its live data.

Charts in the deck are pictures: `bizChartCfg(R,key,arg,fontSize)` builds one
Chart.js config used both on the page and by `bizChartImages(R)`, which draws
each chart on an offscreen canvas (160 px/inch, 2× ratio) and hands data URLs to
the deck; Keynote and Google Slides render pptxgenjs's native charts as blank
boxes, so native charts are only the fallback when there is no canvas (node).
`bizDeck(pptx,R,ctx)` is also pure: the test runs it in node with the real
pptxgenjs and writes a deck from the fixture, so slide layout is checked
headlessly. In the browser `bizExport()` lazy-loads pptxgenjs from cdnjs (jsDelivr
fallback) the first time someone exports. Charts are native (`addChart`), colours
are `#`-less hex, no option object is shared between `add*` calls, stacked charts
carry no outside data labels — the pptxgenjs faults that corrupt a file.

`inferLine(title,sku)` / `isEquipment()` live in js/01 next to `mergeShopify()`,
which uses them for SKUs the sheet does not know — so Sales overview, Vs target
and the review all agree on a Shopify-only SKU's brand. js/12 rolls raw lines into
`BIZ_GROUPS` and matches Targets-tab names by normalised alias. The roster comes
from `spec_directory()` (a SECURITY DEFINER function over profiles + auth.users,
loaded into `SPEC_DIR` by js/02 `loadSpecDir()`); `specDisplay(tag)` and
`specTeam(tag)` are the app-wide print helpers, and the tag stays the key.

Snapshots store a slim copy of `R` (no product list) plus the commentary as it
stood; the page compares numbers only against a snapshot of the same month and
commentary against the newest earlier one. Projections are suppressed in the
first three days of a month; `bizToday()` is UTC like the cache's month keys.

### js/13 — decks as a slide spec, rendered twice

`bizTeamSpec(R,ctx)` and `bizPsSpec(R,sp,ctx)` build a plain array of slides —
titles, tiles, tables, text, labels, rectangles and pictures positioned in inches
on the 10 × 5.625 canvas. `bizRenderPptx()` turns a spec into a pptxgenjs deck
(pictures for charts, native charts only as the no-canvas fallback);
`bizRenderHtml()` turns the same spec into a page of slide-sized `<section>`s
with `@page{size:10in 5.625in}` so the browser's Save as PDF yields one page per
slide. One description, two files. `bizDeck()` is kept as the compatibility
entry the tests call. Per-specialist inputs live in `review_commentary` under
`ps:<Tag>:<section>` (five text boxes) and `ps:<Tag>:forecast` (JSON per
account); `bizNote()` lets the pre-split `ps:<Tag>` row stand in for Key wins.
`renderReports()` computes input status from the same rows and hands out files;
`bizNotionText()` writes the weekly-meeting blocks as markdown for the clipboard.

### js/14 — the QuickBooks sync page

`renderQbo()` (view key `qbo`, Finance → QuickBooks sync; `viewAllowed` for
admin + finance) paints six panels from one `qbo-admin?action=status` call
(plus `reconcile-status` for the reconciliation): Connection, Settings, Shadow
reconciliation, Last run, Customer matches to confirm, Sync ledger. Every
write goes through `qboApi()` to `qbo-admin.mjs`; Connect and Disconnect call
`qbo-auth.mjs`. The page holds no Intuit token and never talks to Intuit.
Super-admin-only controls (Connect / Disconnect / Save settings / Enable) are
rendered only when `isSuper()` and refused server-side regardless; the Intuit
round-trip lands back on `#/v/qbo?connected=1` or `?error=…`, which the view
turns into a flash and strips from the hash. Design in 4.7.

### Row actions are buttons, upgraded at render time

Templates still write `<a href="#" onclick="…">` for row actions — ~120 sites
across the files. `upgradeButtons()` (js/01) runs after every DOM change and
turns those into `.abtn` buttons: tone from the inline colour the link carried,
separators (` · `) removed, `onclick` untouched. It skips navigation (an
allow-list of opener functions, arrowed prose links, footers, `.lnk`). The
observer converges in one extra pass because an upgraded anchor no longer
matches. Write new actions the old way; they come out as buttons.

### The finance-forms engine takes new forms as data

`expreport` (expense reports — revolving-fund liquidation) is the eighth kind:
an entry in `FIN_KINDS`/`FIN_SPEC` (js/10), a `doc_formats` row (ER-), the kind
added to the `fin_requests` check constraint and to the attachments-visibility
policy. No new tables, no new rendering code — the engine draws the form from
its spec, including the itemised lines (fin_lines). The approval route is data
(Admin → Approval routes).

### Boot: splash and deferred scripts

`#splash` is inline in index.html before any script, shows the real app icon
(icon-512.png — its background is the same #00168F, so it blends), and appears
**only in standalone mode**: it defaults to `display:none` and a synchronous
inline script turns it on when `display-mode: standalone` matches, so a browser
tab never flashes it and a broken gate fails safe (hidden). It fades via
`splashHide()` (js/09) once the profile loads or the login form renders; an
inline 8s failsafe clears it even if the JS fails. Every external script carries `defer`, so first
paint (the splash) happens before ~1MB of JS downloads or parses — order is
preserved (CDN libs, then the single `app.<hash>.js` that the build makes of
js/01…13). Caching: the bundle's filename carries its content hash, so it is
served `immutable, max-age=1y` — safely, because there is exactly one script
and a new deploy is a new filename; `index.html` (and `/`) are `no-cache`, so
every visit revalidates the one file that points at the bundle. Before the
build step the 13 files were unhashed and had to stay on etag revalidation, or
one script could go stale against the others mid-deploy. Icons cache a week,
fonts a year (also hashed-safe: they never change).

### tools/manuals — where the PDFs come from

The nine role manuals are generated, not hand-edited. `tools/manuals/content/*.json`
holds the words; `fw.py` holds the layout, every number of it measured off the
shipped PDFs rather than chosen; `compose.py` renders; `diffcheck.py` compares an
old build against a new one on geometry, styles, text and rendered pixels. Edit
the JSON and rebuild — see `tools/manuals/README.md`.

The pixel comparison is not decoration. A text-only diff reported a perfect match
while the rebuild was still missing the decorative disc on every cover and the
grid on every table.
through the function so the files are never publicly reachable).
`nightly.mjs` (cron 18:00 UTC) triggers four background functions: the Shopify
backfill (order/payment/shipment sync), the sales-cache rebuild,
**backup-background** (full JSON export of every table → Netlify Blobs
"backups" store, 14 dated snapshots kept; `backup.mjs` serves the latest to a
verified super-admin session), and **automations-background** (ten
workflow rules — follow-up after fulfillment, welcome call on first order,
collection at 60d past terms, dormant-account alert, campaign-start ping,
Monday weekly digests, Monday next-best-action, quote chase at 7 days, and
birthday/anniversary three days ahead, and a month-end
valuation-freeze nudge on the 1st —
writing notifications and planned visits, deduped via `auto_log`). Dedup keys
are per-entity: `quotechase` fires once per quote id; `occasion` uses
`field:account@year` so a greeting reminder recurs annually but never twice.

### 3.5a Manila "today" in the browser

`todayISO()` / `monthISO()` (js/01) are the only way the browser asks for the
date: `Date.now()+8h` in ISO, matching the server jobs. Before this, ~60 sites
used `new Date().toISOString().slice(0,10)` and between midnight and 08:00 Manila
"today" was yesterday — MTD missed the day, a visit filed at 7am was planned, not
done.

### 3.6 One permission truth for views
`viewAllowed(v)` (js/02) is the single rule set: `showView` redirects with it,
`navSync()` hides sidebar items and whole sections with it, and the mobile menu
filters with it. Changing a view's access = one edit. Activity log is admin +
super admin only (tightened 2026-08-28).

Since 2026-09-08 `applyRoute` (js/04) runs every deep link — account, order,
specialist, pick slip, delivery receipt, statement, wave — through the same
`viewAllowed`, sanitises the view name, and lets a specialist deep-link only their
own specialist page. `viewAllowed` answers `false` for everything but the landing
pages until `ROLE` is known (a cached role only prevents flicker; the data layer
is RLS), a missing profile means `viewer`, the specialist's `sales*` pages are an
explicit list, and the document pages (`statement`, `delivery`, `pickslip`,
`wavepick`, `creditmemo`) are blocked for viewer and marketing.

### 3.7 View-writers map & the generated home
`VIEW_WRITERS` (js/10) records which roles write in each view: it renders the
read-only banners inside views AND the 👁 badges on home cards. Home = one
curated action row per role + the sidebar's own categories listing every
`viewAllowed()` page (title minus badge counts, svg cloned with explicit
stroke attrs) — home and sidebar share one structure, and new nav items appear
on Home automatically. The old `role-sales` CSS nav filter is gone; `navSync`
drives sidebar visibility for every role, so sales get the same collapsible
categories.

### 3.8 Two-level sidebar — `NAV_AREAS` (js/10)
The nav DOM is unchanged: the same `.nlbl` headings and `.ni` rows, in the same
order, with the same icons and role classes. On top of it `NAV_AREAS` maps the
twelve section labels to six areas (Home, Sales, Warehouse, Finance, Planning,
Admin). `navAreaTag()` stamps each nav child with `data-area` by walking the
headings; `navAreaPaint()` adds the class `.offarea` (`display:none!important`)
to everything outside the chosen area and renders the rail (`#rail`, inside
`.sb` next to the panel `.sbp`); `navSync()` calls it last, so an area is offered
only when the role may open a page in it (`data-deny` from `viewAllowed`).
`showView` → `navAreaFollow(v)` moves the rail when the opened page is not on
screen; `navFilter` clears `.offarea` while a search is typed and repaints when it
empties. The three visibility mechanisms never write the same property: deny and
collapse use inline `display`, area uses a class. `buildMobileMenu` renders the
same areas as chips and filters by `data-area` unless searching. The chosen area
lives in `localStorage.hs_nav_area`.

### 3.9 Ask Healthspan — one engine, two surfaces, saved chats
`ASK_CUR` (js/09) is the current conversation `{id,title,messages:[{r,t,m,ok,at}]}`;
`askAsk(inputId,logId,btnId)` is the only sender — the drawer (`sendAsk`) and the
page (`askPageSend`) pass their own element ids. `askRenderLog` paints the same
messages into whichever log exists; a pending bubble is a message with
`pending:true` that the answer replaces in place. `askHistoryPairs()` gives the
worker the last three Q/A pairs. After an answer `askSaveCur()` upserts the whole
conversation into `public.ask_chats` (owner-only RLS, JSON messages, title from
the first question); `renderAskPage()` builds the two-column page (`.askpg`) and
`askPaintList()` the grouped chat list. `askPref()` (`hs_ask_open`) decides what
the top-bar button opens. No database → the chat works, unsaved.

### 3.10 Ask Healthspan model pick
`askGetModel()/askSetModel()` (js/09) keep the person's choice in
`localStorage.hs_ask_model` and `sendAsk` sends it as `provider`; `ask.mjs`
forwards it to the worker only when it is `gemini` or `anthropic` (`ASK_PICK`),
and the worker applies `setProviderPref(payload.provider)` *after* reading the
company default from `app_settings.ai_provider`, so the personal pick wins for
that question only. Settings → AI offers the same two.

### 4.5a One door to the models — `lib/llm.mjs`

Every model call (`ask-work-background`, `stockbot-work-background`, the
next-best-action rule in `automations-background`) goes through `llm({system,
messages, maxTokens, smart})`, which never throws and returns `{text, model,
provider, error}`. The provider is an env decision: Gemini Flash when
`GEMINI_API_KEY` is set (free tier), Claude otherwise, `AI_PROVIDER` to force.
Order of attempts on Gemini: Flash → one patient retry on 429/5xx → Flash-Lite →
Claude fast model if a key exists. `isFreeTier()` lets the ask worker leave unit
costs and payables out of the context, since free-tier prompts may be used for
model improvement. `lib/` is a subfolder so Netlify does not deploy it as a
function; esbuild bundles it into each caller. Tested by
`tools/test/llm-provider.test.mjs` with a mocked fetch.

### 4.5b What Ask Healthspan is given

`askCatalog()` (js/09) is the warehouse view; `askHqSections()` appends the sales
view: ISO-week calendar (`isoWeek()`), weekly external sales folded from
`SHOPIFY.recent` with `ordInternal()` filtering, and the current month's
`bizCompute()` object flattened into pipe-delimited sections (brands with the
13-month series, specialists, products, accounts, machines, activity, trends,
targets, loaners). Each is a few KB, and `trimCatalog()` on the server keeps any
section under 9 KB whole, so a date question that matches no keyword still has
its data. The system prompt names the sections and how dates map onto them.

### 4.5c Provider choice at runtime

`lib/llm.mjs` now also speaks the OpenAI chat-completions shape for DeepSeek,
Kimi (Moonshot) and Groq (`COMPAT` presets, one `callCompat`). The active
provider is `app_settings.ai_provider` (Settings → AI, super admin), read by each
worker via the service key and applied with `setProviderPref()` before the call;
`AI_PROVIDER` env is the fallback, then "Gemini if it has a key". Whatever is
chosen, the attempt list still ends in the other providers that have keys.
`GET /ask?diag=keys` tells Settings which keys exist without exposing them.

### 4.6 Role-scoped Ask AI
`ask.mjs` derives the caller's role/tag server-side (unspoofable) and passes it
to the worker, which builds an HQ context from Supabase filtered to that role:
AR/PDC/payables/costs only for finance+admin, approvals for managers,
warehouse queues for supply chain, own-tag orders/quotes for specialists — with
hard system-prompt rules never to reveal costs/margins outside finance/admin.

### 4.7 QuickBooks connector

**Scan-based and idempotent, not event-driven.** There is no trigger on `orders`
and no outbox queue. Every run of `runSync()` (`lib/qbo-sync.mjs`) reads what HQ
has — approved orders dated on or after `qbo_post_from` (pending, fulfilled or
cancelled; `qbo_post_mode` can narrow that to fulfilled ones), returns, payments —
against what `qbo_sync` says is already in QuickBooks, and posts only the
difference. The ledger row is the unit of truth: `qbo_sync` is unique per
`(kind, hq_ref)` and carries `status` (pending / posted / updated / voided /
skipped / error), `qbo_id`, `sync_token`, `hash`, `attempts`, `last_error`. A run
that dies halfway through a batch loses nothing; the next run finds the same
rows still pending and finishes. Triggers were rejected because an order click
would then be blocked on Intuit's latency and error surface; a queue was rejected
because it is a second source of truth to keep consistent with the ledger, and
the scan already costs one Supabase query per kind. Four passes in order:
invoices, credit memos (applied to the invoice they name), HQ payments → Payment
(**only when `qbo_sync_payments` is '1'** — finance's rule is that Collections
records payments by hand, so the default is off), then QuickBooks payments → HQ.
Guards: a 12-minute lock in `app_settings.qbo_lock` so a second trigger inside a
running pass is skipped, 150 invoices per run (well inside the 15-minute
background window), and rows that have errored `MAX_ATTEMPTS` (5) times are left
alone until `retry` resets them — so a permanently bad account cannot re-hit
Intuit every 15 minutes. Internal and test accounts (`INTERNAL_RE`, `TEST_RE` —
same rule as the sales views) are written as `skipped` once and never revisited.
**A row that carries a `qbo_id` is an existing invoice whatever its last
status** — an error after posting goes down the update path, never a second
post (the 2026-09-18 rewrite fixed this).

**The document is the mapper's, not the sync's.** `runSync` no longer builds
request bodies. It normalises the order (`normalizeOrder`: HQ orders from
`orders` + `order_lines` + the `items` catalog; Shopify orders from
`orders.qbo_src`), asks `lib/qbo-map.mjs` for a *plan* (`planInvoice`: the
lines with item **keys**, the predicted total and VAT, the discount style, the
list of items that must exist — `needs`), resolves those keys against QuickBooks
(`ensureCustomer` with the e-mail fallback, `ensureItem` per key; the three
special items Discount / Shopify Shipping / Shopify Adjustment by SKU or name,
the Discount one as a Service), then renders the body (`renderInvoice`). Strict
totals are enforced twice: the plan throws (`code: 'TOTALS'`, the plan attached
for the ledger row) when the lines cannot explain the order total, and after a
live post the returned `TotalAmt` is compared with the prediction — a mismatch
**deletes the invoice** (`invoice?operation=delete`) and errors the row with
both figures. Section 4.18 has the mapper.

**Update detection is a hash of what we sent.** `fingerprint()` in `lib/qbo.mjs`
is a stable hash of the fully built Invoice body — customer ref, lines, amounts,
dates, class, tax codes. It is stored in `qbo_sync.hash` on post. On every later
run the body is rebuilt and hashed; equal means nothing to do, different means
the order changed and the invoice is re-posted as a full (non-sparse) update
using the `SyncToken` read from QuickBooks at that moment, not the one we stored
— QuickBooks rejects a stale token, which is exactly what we want if accounting
edited the invoice by hand in between. Before updating, the current invoice is
read: void in QuickBooks → the row becomes `voided` and nothing is rewritten;
money already applied (`TotalAmt − Balance > 0`) and a changed total → the row
errors ("adjust it in QuickBooks by hand") — the connector's `allowPaidInvoiceEdit`
rule.

**Cancellation follows the month.** A cancelled order whose invoice is posted is
voided only when the invoice is unpaid (`Balance == TotalAmt`) **and** the
cancellation falls in the same Manila month as the invoice's `TxnDate`
(`sameMonth()` in the mapper; the cancellation time is Shopify's `cancelled_at`
from the snapshot, else the order's `updated_at`). A later month leaves the
invoice open and writes `skipped` with "issue a credit note" — a signed-off month
is never reopened, the same principle as the period-close triggers. Money
received → `skipped`, "refund / credit note by hand". Voided, never deleted, so
the number stays in the books.

**Payments recorded in QuickBooks come back by change-data-capture.** Pass 4
calls Intuit's CDC endpoint for `Payment` changed since `qbo_cdc_since`, a cursor
set five minutes before the run started (overlap on purpose; the `payments.qbo_id`
unique key makes a re-read harmless). Only payments linked to an invoice HQ
posted are taken, and payments HQ itself sent (present in `qbo_sync` kind
`payment` without the `qbo:` prefix) are ignored so nothing echoes. Each new one
becomes an HQ `payments` row with `qbo_id`, `created_name 'QuickBooks'`, then —
for HQ orders — `rollup()` recomputes `orders.paid / balance / pay_status` from
the payments rows, the same rule the app uses. **Shopify orders are not rolled
up**: the import owns their `paid / balance` from Shopify's own financial status
until Shopify is retired, and rolling them up here would flip-flop with the next
import. A CDC record marked deleted becomes an offsetting negative row (`qbo_id`
= `<id>:void`), because `payments` is append-only. The first live run only sets
the cursor; it does not backfill history.

**Preview mode is the same code path with every write skipped.** While
`app_settings.qbo_enabled` is not `'1'`, pass 1 plans every order and resolves
the customer and items against QuickBooks read-only — `ensure*` look in
`qbo_map`, then query QuickBooks, and with `{create:false}` return null instead
of creating the missing record — so fuzzy matches surface on the page and the
ledger row says what the live run would create and how ("would post 95000.00
(native discount row) — enable the sync to send — and create 1 item"). What it
never does is write. Passes 2–4 are not run in preview because nothing
downstream exists yet to apply to. Flipping `qbo_enabled` changes no data model
— the next run simply carries the pending rows through to `posted`. Customer
matching lives in `ensureCustomer()`: exact name, then `PrimaryEmailAddr` when
the caller passes an e-mail (Shopify buyers — how the old connector matched
them), then `norm()`-equal name (which returns `confirmed:false` and the
candidate list into `qbo_map`), else create; with `qbo_require_confirm` on
(default) an unconfirmed match holds the invoice as `pending` until `qbo-admin`
`confirm` flips the mapping. Tested by `tools/test/qbo-connector.test.mjs` (58
checks against a fake Intuit that totals documents the way the real global
edition does — VAT added on top of an Amount-only VAT line, a Discount row read
as net and prorated — and a fake Supabase). The page is `js/14-qbo-sync.js`; it
talks only to `qbo-admin.mjs` and `qbo-auth.mjs`, never to Intuit.

### 4.8 Saved reports — one engine, two runtimes

`js/15-report-engine.js` is a classic script with a CommonJS tail
(`if(typeof module!=='undefined')module.exports=…`). The browser gets it as
globals (`RPT_SOURCES`, `rptRun`, `rptCSV`, `rptDue`…); `lib/report-runner.mjs`
loads the same file through `createRequire` so the 6am schedule and "Run on the
server now" compute exactly what the preview showed. The engine is pure: a
definition + rows + role → `{cols, rows, total, truncated}`. `RPT_SOURCES` is the
schema and the permission table in one — per source: column types, allowed roles,
the column that identifies a specialist (own-rows filter for `sales`), and the
cost columns (stripped unless the role is in `RPT_COST_ROLES`). Row loading is the
only side that differs: the browser reads what it already holds (`DATA`, `BATCHES`,
`SHOPIFY.recent`) or one Supabase select; the server reads the sync snapshot blob,
the Shopify blob, or PostgREST with the service key — then runs the engine **as the
owner** (`profiles` looked up fresh). Results: Blobs store `reports`, key
`run-<id>-<ts>`, plus a `report_runs` row; downloads go through `report-run.mjs`
(session-checked: owner, admin, or a role that may read a shared report's source).
`reports-schedule.mjs` is a v2 scheduled function (22:00 UTC) — no public URL.

### 4.9 Guarding the functions — `lib/guard.mjs`

Two rules, one file: **fail closed** and **constant-time compare**.
`requireJobKey(event)` / `requireJobKeyReq(req)` return a 503 when `JOB_KEY` is
unset and a 403 when it does not match — every background worker starts with it,
and the dispatchers (`ask.mjs`, `stockbot.mjs`, `nightly.mjs`, `qbo-*`) send the
header. `sessionUser(event)` verifies the Supabase JWT and returns
`{id,email,name,role,tag,super}` or `{code,error}` — 503 (not "allow") when the
Supabase env is missing. `isSlackHook(url)` pins the Slack worker's `response_url`
to `hooks.slack.com`. Ask answers are stamped with the asker's uid and only
returned to them.

### 4.10 Automatic checkpoints & equipment rules (nightly 10b / 12)

The Business review's mid-month and month-end checkpoints are taken by the
**browser** (`maybeSnapshotReview`, js/12) the first time an admin or manager
opens HQ on or after the 15th / in a new month — `bizCompute` needs the merged
sales cache, which lives client-side. A unique partial index on
`(month, checkpoint)` makes a second attempt a harmless failure; nightly rule 10b
pings admins/managers on those days while the row is still missing. Rule 12 reads
`serials.warranty_end` and `serial_service.next_due` and pings the warehouse,
deduped per unit per date through `auto_log`.

### 4.11 Receiving — `js/17-receiving.js`

`shipments` + `shipment_lines` are the inbound mirror of orders + order_lines.
Creating one from a PO copies the PO's outstanding quantities and unit costs;
`shipPost` is the door: `ledgerAdd` (kind `receive`, ref `RCV-n PO-n`) or
`quarAdd` for QA-hold lines, `po_lines.received += counted`, PO status roll-up,
`boRelease`, shipment `received_at`, finance ping with the due date
(`received_at + terms_days`). `shipLanded(s, lines)` is pure: goods = invoice ×
rate; fees summed with import VAT excluded when `fees.vat_recoverable` (default);
allocation by line value or quantity → `per[lineId]` landed ₱/unit. `shipApplyLanded`
writes the lines and sets `pos.landed_cost` (= Σ applied shipments' fees on the
PO) and `pos.fx_rate`, so `renderValuation` needed no change. Status pipeline
lives in `SHIP_STATUS`; the PO page's import fields are kept in step by
`shipEdit`. Nightly rule 13 pings past-ETA shipments.

### 4.12 In-app dialogs — `js/00-dialogs.js`

`uiPrompt / uiConfirm / uiAlert / uiForm` return promises and paint one
`#uidlg` box at a time (a queue serialises overlapping calls). The 2026-09-08
codemod (`tools/dedialog.mjs`, acorn) rewrote every `prompt()` / `confirm()` /
`alert()` call in `js/` to the awaited forms and marked the six enclosing
functions that were not yet `async`. Rule going forward: never call the browser
dialogs — the serials test fails if one appears.

### 4.13 Search — `js/18-search.js`

`srRun(q, onPaint)` paints twice: first from memory (sidebar labels + `DESC`,
`DATA`, `BATCHES`, `acctNames()`, `specNames()`, `SHOPIFY.recent`), then after
`Promise.allSettled` over one RLS-scoped, `limit`ed PostgREST query per record
kind. `srKinds()` maps each kind to the `viewAllowed()` page that owns it, so
the permission truth is reused rather than restated; `srDocParse()` turns a
printed number back into `{kind, n}` using `DOCFMT` / `DOCFMT_DEFAULT` (prefix,
padding, offset — dash optional, any case), so `HS-1042` queries `num = 42` and
`RE-1007` queries `(kind = reimburse, num = 7)`. Openers reuse `showOrderPage`,
`showAccountPage`, `showSpecPage`, `openDrawer`, `showWavePick`; list records go
through `showView` + `srHighlight(text)` (polls `#content` for up to 4 s, scrolls
the row into view, flashes `.sr-hl`), with `window._poOpen` / `SHIP_OPEN`
pre-set so the PO or shipment arrives expanded. Desktop UI: `#srpanel` floats
beside `#navq` (`srInput` debounced 160 ms, `srKey` for arrows/Enter/Escape);
phones: `buildMobileMenu` is wrapped so a query ≥ 2 chars prepends `#sr-mobile`.
Specialists: `srMine()` filters cached specialists/quotes/Shopify orders to the
own tag, and their account hits come from their own `orders` rows rather than
`accounts`. No result line formats money.

### 4.13a Org chart — `js/19-orgchart.js`

A nineteenth classic script; nothing before it references it. `ORG_PEOPLE` is a
flat list — `{id, name, title, boss, level, spec?, profile_id?, hq_name?, hq_role?, sort}` —
loaded from `public.org_people` (`orgLoad`: the table when it has rows; an empty
table offers admins the `ORG_SEED` load; no table yet → the seed, read-only, with a
note to the super admin) — and the tree is derived:
`boss` names the person reported to, `'exec'` means the two co-founders jointly
(rendered side by side as one root), a `level:'group'` row ("Team 1") is a label
that the reporting line passes through (`orgBossOf` / `orgReports` look through
it). `renderOrgChart()` paints the tree as nested `<ul>` with CSS border
connectors (`.org-tree` in index.html); a run of more than two leaves stacks
vertically under its manager (`.org-stack`), which is what keeps the sales teams
readable and matches the People team's own layout. Under 900 px, or on the List
toggle, the same data renders as an indented outline. Each node is an
`<a class="lnk org-node">` — `lnk` keeps `upgradeButtons()` from turning it into
a pill — whose click sets `ORG_SEL` and re-renders with the person's card on top;
the card's "Sales page" appears only when the row carries a `spec` tag **and**
`viewAllowed('spec')`, "Team & access" only when `viewAllowed('users')`. Opening a
card writes nothing; every edit does — `orgSave` upserts through the user's own
session (RLS `hs_role() in ('super','admin')`) and calls `audit('orgchart.add|edit|
link|unlink|remove|seed')`. Remove deactivates (`active=false`) after moving the
row's reports to its boss; a super admin may choose a hard delete (RLS `org delete
super`). `orgVacate` keeps the row and its place — name → "Vacant", level →
`vacant`, spec / profile link cleared — so a post survives the person; `orgFill`
reverses it. `orgMove` renumbers the siblings 1..n and swaps two. `ORG_EDIT`
(Edit chart) puts `orgTools()` on every node — the same handlers the card uses. Linking reads the HQ accounts through `adminUsers('list')`
(admin-only function) and denormalises `hq_name` / `hq_role` onto the row so every
role can show them — `profiles` is own-row-only under RLS. No names in the manuals. Colours are the legend's (`ORG_LEVEL`), not the theme's, so the chart
reads the same in dark mode.

### 4.14 Drawer history — `js/06` + `js/04`

A `MutationObserver` on `#drawer`'s class pushes one `history` entry
(`{hsDrawer:1}`, same URL) the first time any opener adds `.open`, bumping
`_navDepth` so the mobile ← appears. `closeDrawer(silent)`: the ✕/overlay path
sets `_drawerPopSkip` and calls `history.back()`; `applyRoute` (the `popstate`
listener) consumes that flag and does nothing, or — for a back that arrives while
the drawer is open — closes the drawer and returns without re-rendering.
`pushRoute` closes an open drawer silently, so every navigation dismisses it.
CSS: `.dhead` is sticky; on phones `body.authed .drawer` spans from below the
top bar to above the bottom tabs.

### 4.15 Dates — `todayISO / monthISO / daysISO / monthsISO` (js/01)

Manila is the only clock. `todayISO()` shifts `Date.now()` by +8 h and slices;
`daysISO(n)` and `monthsISO(n)` step from that in UTC arithmetic so a window like
"last 30 days" never moves with the browser's zone or a UTC midnight. The audit
test greps for the old `new Date(...).toISOString().slice(0,10|7)` idioms and fails
on any new one.

### 4.16 The "wait for the cache" re-render guard (js/02, js/03, js/10)

Pages that need `SHOPIFY` and find it null call `loadShopify()` and re-render in
`.then`. Since 2026-09-17 they record `window._shopWaitRef=SHOPIFY` first and
re-render only if `SHOPIFY` changed — `loadShopify()` resolves without data when
the feed errors, is `building`, or the device is offline, and the old unguarded
re-render → load → re-render was a hot loop (an OOM in jsdom; a request storm on
a phone). `loadVisits()` likewise never leaves `VISITS` null.

### 4.16a The bundle's temporal dead zone — why Home painted half-empty (fixed 2026-09-18)

`tools/build.mjs` ships the nineteen scripts as ONE file. That changes one thing the
unbundled source never showed: a `const` declared in a later script is no longer
"not yet declared" (where `typeof X` is safely `'undefined'`) but **declared and in
its temporal dead zone**, where `typeof X` throws. js/09's init runs `renderHome()`
from the middle of the bundle; the Home page catalogue walks the sidebar through
`viewAllowed()`, which read `typeof FIN_KINDS` (a js/10 const) — in production that
threw, the catalogue came out empty, and the "stable shell" memo then treated that
half page as final until the role or name changed. Two rules came out of it:
read a later script's const under `try` (`viewAllowed` does), and a memoised first
paint must record whether it was **complete** (`window._homeComplete`) so the next
render call repaints instead of refreshing numbers. Async views have a second trap:
`showView()` injects the page tip (`injectDesc`) right after calling the renderer,
so a renderer that paints later (`renderQbo`) must call `injectDesc` itself after
its paint — and must not carry its own `.viewdesc` (the tip is `DESC` in js/01, and
`.viewdesc` is a flex row, so raw text and `<b>` children spread into columns).
PostgREST filters travel in the URL: a raw `%` in `like.qbo_%` is an invalid escape
the gateway answers with an HTML 500 page — use `*` as the wildcard, and `sb()`
now names an HTML error page instead of quoting it.

### 4.17 The role × view matrix test — `tools/test/role-view-matrix.test.js`

Boots the app once per role in jsdom with a fake Supabase that answers `[]` to
everything, then calls `showView` for every view the dispatch in js/02 knows
(regex over `v==='…'`). Collected per (role, view): exceptions (window `error`,
`unhandledrejection`, process-level rejections, jsdom errors), a refused page that
rendered itself, a page left on the loading placeholder. The app and the driver are
evaluated in ONE `eval` so `let`/`const` globals are visible. A deliberate throw in
one renderer is caught and attributed to its (role, view) — verified when the
suite was written.

### 4.18 The QuickBooks mapper and the shadow reconciliation — `lib/qbo-map.mjs`, `lib/qbo-reconcile.mjs`

**One pure module owns the shape of every QuickBooks document.** `qbo-map.mjs`
has no network and no Supabase: it takes a *normalised order* and returns the
plan for its invoice. The normalised order is one shape for both sources —
`normalizeNative(order, lines, items)` from HQ's tables (list price = the
catalog's, never below what was charged; VAT line from the catalog's product
line via `EXEMPT_RE`), `normalizeShopify(src)` from the ORDER-CONTRACT-shaped
snapshot the import stores in `orders.qbo_src` (Shopify REST field names:
`line_items[].price / quantity / current_quantity / discount_allocations /
tax_lines`, `total_price / total_tax / total_discounts`, `current_*` on edited
orders, `refunds`, `payment_terms`, `customer`, `billing_address.company`). The
rules are the Shopify connector's (`src/sync.js` of `qbo-shopify-connector`,
ported function by function): `TaxInclusiveAmt` = gross / `Amount` = net / no
`UnitPrice`; tax code per line; class on header and lines; `discountStyleFor()`
(native unless VAT treatments are mixed or shipping / tip is present → per-line);
`productLines()` → `finishLines()` (shipping, the one Discount row — percent when
`listTotal × pct / 100` reproduces the gross exactly, else net amount — then a
residual explained by tip / duties becomes an untaxed adjustment line, anything
else is a **mismatch**); the edited-order probe (Shopify may or may not have
re-allocated the discount to the remaining units, so both readings are tried and
the one that reconciles is kept; refunded units are added back because a refund
is its own document). `planInvoice()` returns `{ lines (item keys), total, vat,
style, needs, dueDate, customerName, docNumber, mismatch }` and throws
`code:'TOTALS'` when strict; `renderInvoice()` substitutes ids and adds the header
(TxnDate, DueDate, BillEmail, CurrencyRef, ClassRef, GlobalTaxCalculation,
PrivateNote naming the source). `diffInvoice(plan, inv, cfg, {customerId})`
compares a plan with an invoice QuickBooks holds — DocNumber, total (±0.02), VAT
(±0.05), class on every line, customer (by mapped id, else normalised name), due
date, line count, presence of a Discount row — and returns the fields that
differ. Dates: `dateInTz()` gives the **Manila** calendar date of any timestamp
(Shopify's GraphQL `createdAt` is UTC — an order at 01:30 Manila on the 1st is
the 1st, not the 31st); `sameMonth()` decides voids.

**Parity is a test, not a promise.** `tools/test/fixtures/qbo-connector/` holds
the connector's `sync.js`, `config.js` and `fixtures.js` frozen as handed over on
2026-09-18, with in-memory stand-ins for its Firestore store and Intuit client.
`tools/test/qbo-parity.test.mjs` runs ten orders through `createOrUpdateInvoice()`
there and through `normalizeShopify → planInvoice → renderInvoice` here and
requires the two Invoice bodies to be **identical** (PrivateNote excepted). The
mapper's own suite (`qbo-map.test.mjs`, 39 checks) covers the same figures the
connector's tests assert (HG-10496: 190,000 list, 50 % row, 95,000 / 10,178.57)
plus HQ-native cases (10+1 deals, exempt lines, catalog list prices, a price rise
the catalog has not caught up with). If finance changes a rule, change the
mapper, then retire the affected parity case with a note — never "fix" the
frozen copy.

**The reconciliation is the mapper pointed at the past.** `runReconcile()`
(`lib/qbo-reconcile.mjs`, worker `qbo-reconcile-background.mjs`, JOB_KEY-gated,
nightly from `nightly.mjs` and on demand from the page) reads every Shopify
order since `qbo_reconcile_from` (default 2026-09-14, the connector's cutoff),
skips internal / test accounts and counts orders without a snapshot yet, plans
each (strict totals off — a mismatch is a finding, not a crash), fetches the
invoices QuickBooks holds under those DocNumbers in one query per 25
(`invoicesByDocNumber`, `DocNumber in (…)`), and classifies each order: `match`,
`diff` (with `diffInvoice`'s fields, and "lines" when the plan itself could not
explain the total), `missing` (no invoice), `voided` / `cancelled` (a cancelled
order with a void or absent invoice is fine; with an open one it is a diff). It
writes nothing to QuickBooks. Results go to Netlify Blobs store `qbo`:
`reconcile` (the latest run with up to 400 rows, differences first) and
`reconcile-history` (the last 60 summaries); `cleanStreak()` counts consecutive
clean runs and the days they span, which the page shows as "clean runs in a
row". `_useStore()` injects a store for tests, as `report-runner` does.

**Why the import had to change.** The old `backfill-background` rounded every
amount to whole pesos, kept only each line's discounted total, took the UTC date
and ran nightly — none of which can reproduce a Shopify invoice to the centavo.
It now keeps money at 2 dp (`orders.total`, `order_lines.price / amount` are
`numeric`; displays round as before), stores `qbo_src` for orders dated on or
after `qbo_src_from` (default 2026-09-01), dates by Manila, and has a `recent`
mode (`?recent=1`: orders Shopify changed in the last two days, sorted by
`updated_at`, 25 per page) that `shopify-recent.mjs` fires every 15 minutes at
:05 / :20 / :35 / :50 — five minutes before `qbo-schedule` — so the snapshot is
in place when the QuickBooks pass runs. Shopify's query-cost limit is handled by
halving the page size on a cost error and retrying the same page. Closed-period
orders still receive only collections, shipping and `qbo_src` (which restates
nothing HQ books). Test: `qbo-map.test.mjs` runs `toQboSrc()` on a GraphQL node.

## 5. Supabase schema (see SUPABASE-SETUP.md for exact SQL)

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | Role + identity per auth user | `role in (admin, manager, sales)`, `specialist_tag` (null = sees all) |
| `visits` | Visit log + planned visits | `status done/planned`, `fu_done`, own-name enforced |
| `orders` | Native + migrated orders | `num` (identity, HS-1001+), `source native/shopify`, `ext_ref` unique, `pay_status pending/partial/paid/refunded`, `paid`, `balance`, `terms_days`, `order_note`, `deleted_at`, nullable `user_id` |
| `order_lines` | Line items | `qty`, `price`, `amount`, `is_free`, `deal` |
| `accounts` | CRM fields per customer | `name` unique + contact/details |
| `account_links` | Curated merges & parent/child | `from_key` (normalized) PK, `to_name`, `kind merge/branch` |
| `order_overrides` | Status/tombstones for cache-era Shopify orders | keyed by order `ref` |
| `account_contacts` | Multiple contacts per account | `acct_key`, name/role/phone/email/viber |
| `audit_log` | Append-only trail of every mutation | `who`, `action`, `detail` |
| `spec_targets` / `spec_roster` | In-app monthly ₱ targets · PS roster | overrides sheet targets |
| `app_settings` | Feature flags (cutover switches, `approval_threshold`) | super-admin writes only |
| `items` | Item master (catalog) | prices, costs, barcodes, `deals` JSON, `reg_type/reg_no/reg_expiry` (CPR/FDA) |
| `pos` / `po_lines` | Purchase orders + receiving | plus AP: `terms/proforma/currency/fx_total/amount_paid/peso_value` |
| `opportunities` | Pipeline opportunities | est. value, expected close, weighted |
| `campaigns` / `pdcs` / `returns` | Campaign calendar · PDC register · credit memos | |
| `stock_moves` | Append-only shadow stock ledger | receive/pick/count/adjust, batch-stamped |
| `approvals` | Credit/threshold order holds | `kind`, `status`, decided_by — mgmt decides |
| `comm_rules` | Commission tiers (single row) | finance-editable `min:pct` tiers |
| `quotes` / `quote_lines` | Quotations (QT-numbering) | draft/sent/accepted/lost, expiry, convert→order |
| `promos` | Promotions engine | window, SKU list or `*`, `nplusm` or `pct`, auto-applied at order entry |
| `notifications` | In-app pings (bell) | `user_id` direct or `role` broadcast; unread = per-device watermark |
| `count_sessions` / `count_lines` | Cycle counts (cutover evidence) | blind counts graded on close; variances → ledger adjustments |
| `auto_log` | Automation dedup memory | unique(rule, entity); service-role only |
| `doc_series` | BIR document numbering | atomic `next_doc_no()` RPC (security definer, role-checked); `orders.dr_no` permanent |
| `backorders` | ATP-override shortfalls | auto-release on covering PO receive |
| `quarantine` | Unsellable stock trail | held/released/disposed; `pulled` marks ledger removal |
| `complaints` | Quality reports | batch-linked to the recall trace; closing needs resolution |
| `suppliers` | Supplier master | currency, terms, lead times; POs carry etd/eta/customs/broker/fx_rate/landed_cost |
| `transfers` / `transfer_lines` | Branch shipments as documents | dispatch → FEFO ledger picks (ref TR-n), in-transit state |

`profiles.role` spans 7 roles (admin/manager/sales/supply_chain/finance/
marketing/viewer) + `is_super` + `can_manage_ps` — the full matrix lives in
[PERMISSIONS.md](PERMISSIONS.md) (design: circle read, role write).

### RLS philosophy
- Reads: any authenticated user.
- Writes: **tag-based**, not role-name-based, wherever possible — inserts of
  visits/orders require `user_id = auth.uid()` AND (`specialist_tag` null or
  matching the row's `spec`). Managers/admins have no tag → can act for anyone;
  specialists are locked to their own name *by the database*, not just the UI.
- Admin-only by role: order purge, order_overrides writes.
- Admin/manager by role: account_links writes.
- The client's publishable key can do nothing these policies don't allow.

### Auth
Supabase GoTrue, email+password. New-format API keys (publishable in the page,
secret in Netlify env); legacy JWT keys pending disable. Remember-me toggles the
client between localStorage and sessionStorage session persistence. Roles load
from `profiles` at sign-in and drive everything (`ROLE`, `SBPROFILE`).

### Added 2026-09-08

`shipments`, `shipment_lines` (Receiving), `orders.delivery_cost`,
`complaints.direction/supplier/po_ref/kind`;
`serial_service` (per-unit service log; `serials` gained `warranty_end`,
`warranty_note`, `holder`), `saved_reports` + `report_runs` (reporting layer),
`review_snapshots.checkpoint` (+ unique partial index), `public.hs_role()` (the
policy helper), `notifications_link_route` check. Backups cover every table but
`qbo_tokens`.

## 6. Numbers & conventions (business logic contracts)

- Peso figures are full numbers everywhere (no ₱145K abbreviations).
- Specialist tag aliases: `SPEC_ALIAS = {kristine: 'Tin'}` merges spellings.
- 2026 targets imported from the Revised Corporate Target workbook (245 rows).
- Internal vs external: `shopify-build-background.mjs` stamps every order as
  internal (Remedy branches, Healthspan staff/academy) or not, by customer name
  OR specialist tag, and writes a parallel set of per-SKU and per-specialist
  buckets (`imonthly`, `idaily`) plus `recent[].x`. The client subtracts them
  through `netPeriod()`/`netMonthly()` in `js/01`; nothing reads `sumPeriod()`
  directly any more. `SEXT` (default true = external only) is the one setting;
  passing `force` to those helpers ignores it, which is how targets and
  commissions stay external-only whatever the toggle says.
  `INT_CUST` is anchored (`^`). An unanchored `/vertis|gh mall/` — which is what
  `refresh.mjs`'s `BMAP` does to the warehouse sheet's destination column, where
  those words mean the branch — also matches a third-party clinic located in that
  mall. Since targets and commissions exclude internal unconditionally, that would
  quietly remove revenue from someone's attainment and pay with nothing on screen
  to explain it. So the two feeds deliberately do NOT share a keyword list, and
  the Accounts list reconciles them: an account is internal if the sheet's
  `isRemedy` or the Shopify build's per-order verdict says so.
- `customers[].int` means "every order for this account was internal", and
  `customers[].iv` / `.iv90` carry the internal slice of the booked total. The
  Accounts list subtracts the slice and drops only wholly-internal accounts
  (`acctExternal()` in `js/04`), so its Booked total equals Sales overview's.
  An earlier version wrote `int` once at record creation — first order wins — so a
  single mis-tagged order hid a real clinic and its entire revenue.
- "Vs accounting" reconciles to the Sales Report sheet's **Sales Booked
  excluding Remedy** (verified: 102.4M − 9.9M Remedy = 92.46M).
- Native orders stay **out of sales totals** during the parallel run with
  Shopify (no double counting) — they fold in at cutover.
- FEFO pick lists walk `BATCHES` per SKU by earliest expiry, with bin locations
  from the product master.

## 7. Known gaps / engineering track

- ~~Public endpoints~~ CLOSED — all data endpoints verify the Supabase session
  server-side; background jobs gated by `JOB_KEY`.
- ~~Custom domain~~ DONE — hq.healthspan.ph + PWA (manifest, icons, standalone,
  zoom lock, iOS fixes; deliberately no offline service worker).
- Modular restructure Phase 1 done (13 modules, byte-identical); Phase 2a done
  (single hashed, minified bundle via `tools/build.mjs`); Phase 2b = Vite
  proper (ES modules, code splitting), post-cutover.
- ~~Client-side pagination~~ DONE — the register queries page-by-page server-side
  (search included); AR/cash-flow computations still use the bulk load.
- ATP note: reservations are DERIVED (pending native order lines), not a table —
  they release automatically when an order fulfills or cancels.
- Supabase free tier until cutover → Pro (backups, PITR, no pause).
- Legacy Supabase JWT keys to disable after verifying the new keys.

## 3.8 Period close — enforcement lives in Postgres

`app_settings.closed_through` ('YYYY-MM-DD', super-admin-write like every other
setting) is the accounting cut-off. Enforcement is a set of `before insert or
update or delete` triggers, so it holds against the app, against a future client
bug, and against service-key writes:

| Table | Period field | Frozen when closed |
|---|---|---|
| `orders` | `date` | amount, date, account, spec, terms; cancellation/restore/delete; and back-dating an open order in. Payments, shipping, fulfilment and DR numbers stay open |
| `order_lines` | parent `orders.date` | all writes |
| `payments` | `date` | inserts (append-only table, so that is all of them) |
| `returns` | `date` | inserts, deletes, and edits to amount/date/spec/action (the applied-to-AR flag stays open) |
| `pdcs` | `maturity` | inserts, deletes, and edits to amount/maturity (status changes stay open) |
| `spec_targets` | `month` | inserts, updates, deletes |
| `order_overrides` | parent `orders.date` via `ext_ref` | cancel/trash of a migrated Shopify order |

`period_closed(date)` reads the setting; `caller_is_super()` bypasses;
`caller_is_service()` is exempt **only** for `orders` INSERT, so the nightly
backfill can still import historical orders it has never seen while remaining
unable to restate ones it has. `backfill-background.mjs` cooperates by sending a
reduced payload (pay_status/paid/balance + shipment fields) for known orders
inside a closed period and skipping their line delete/reinsert entirely; it
reports the count as `frozen` in the job status.

Client-side, `closedThrough()`, `periodClosed(d)` and `blockIfClosed(d,what)`
in js/03 let views refuse early with a readable message. They are a courtesy,
not the control — `FLAGS` fails open if the settings fetch errors, which is
precisely why the guarantee is in the database.

Inventory value is no longer only a live computation: `valuation_snapshots`
(one row per month, RLS-limited to admin/finance like the valuation page itself)
stores the frozen total, units, SKU count, stock basis, and per-SKU detail as
JSONB. Re-freezing an existing month requires `is_super`.

## 3.9 Pull-outs and the reservation pool

`pullouts` + `pullout_lines` carry the request; `fund_sources` maps each QBO
class to an approver (and optional backup) by `profiles.id`, so approval rights
are independent of role — a People Ops or Digital Marketing approver may hold a
read-only role everywhere else.

The state machine is `pending → approved → released`, with `rejected` and
`cancelled` as terminal exits. Stock behaviour hangs off it:

- `loadReservations()` now unions two sources — pending native `order_lines`
  **and** `pullout_lines` whose parent is `pending` or `approved`, net of
  `released_qty`. So `reservedQty(sku)` (and therefore available-to-promise
  everywhere: order entry, the short-dated queue, the pull-out form itself)
  accounts for internal demand. A rejected or cancelled request leaves the pool
  on the next refresh; a released one leaves it because `released_qty` cancels
  the line out.
- Only `plRelease` writes `stock_moves`, via `fefoAlloc` → `ledgerAdd` with
  `kind:'pick'` and `ref:'PL-n'`, matching how order picks are stamped, so the
  recall trace and the ledger sums treat a pull-out exactly like a shipment.

**Approval is role-independent by design.** `viewAllowed('pullouts')` returns
true for every role before any role branch is reached, `canDecidePullout` tests
`fund_sources.approver_id/backup_id` against `auth.uid()` and never looks at
`ROLE`, and the `pl update` policy's first branch keys off `fund_sources`. The
two side-effects an approver triggers are also role-free: `audit_log`'s insert
policy is `auth.uid() = user_id` and `notifications`' is `auth.uid() =
created_by`. So a viewer-level approver can decide, audit and notify without a
single role exception anywhere.

RLS mirrors the UI rather than trusting it: insert requires
`auth.uid() = requester_id`; update is limited to the class's approver/backup,
admin/supply_chain/finance, or the requester while the row is still `pending`
(that is the cancel path). Line deletion is the requester's own, pending only.

Notifications follow the action-taker rule: the request pings the fund source
(and backup) only; approval pings finance and supply chain; the decision and the
release ping the requester.

## 3.10 Table sorting — one delegated listener, not 87 implementations

Every table in HQ is an innerHTML string produced by its own render function.
Threading sort state through all of them would mean 87 chances to get it wrong,
so sorting operates on the rendered DOM instead: a single capture-phase click
listener (end of js/10) resolves `closest('th')`, sorts the `<tbody>`, and
re-appends the existing `<tr>` nodes — which is why inline row handlers,
drawer links and action links keep working after a sort.

Rules it applies:

- a `<th>` carrying its own `onclick` is left alone, so All SKUs' real
  data-level sort (which sorts the dataset, not the page) still wins;
- rows whose cell count differs from the header, or that contain a `colSpan`,
  are treated as non-data — section headings, TOTAL rows and empty states hold
  their original index while the data rows sort into the slots between them;
- a header row containing a merged cell disables sorting for that table;
- `data-nosort` on a `th` or `tr` opts out explicitly.

Key extraction is type-aware: currency and thousands separators are stripped,
a trailing unit or `%` is tolerated (`45d`, `12u`, `98%`), `MM/YYYY` expiry
strings become sortable integers, ISO dates become timestamps, everything else
falls back to a numeric-aware locale compare. Empty cells and em-dashes sort
last in both directions.

State lives on the DOM node (`table._sortIdx/_sortDir`), so it resets on
re-render by design.

## 3.11 Silent re-render

28 render functions opened with the same line: blank `#content` to a "Loading…"
placeholder, fetch, repaint. Fine on navigation, jarring on every action-driven
redraw — the page flashed empty and lost its scroll position.

`loadingHint()` (js/01) replaces that line everywhere. It paints the placeholder
only when `window._navPaint` is set, which `showView()` does exactly once per
genuine view change (and never when re-entering the view already on screen). Any
other caller — an action re-rendering its own view, the js/01 refresh router —
leaves the existing markup up until the new innerHTML lands.

`keepScroll()` handles position. A timer can't work here: the repaint happens
after an `await` of unknown length. It captures `.main`'s scrollTop, attaches a
`MutationObserver` to `#content`, and restores on the next animation frame after
the children actually change, guarding against a now-shorter page and clearing
itself after a 4s fallback. `showView` disconnects it so a new page starts at
the top.

`renderPullouts(cheap)` shows the other half of the pattern: when only local
state changed (the request cart), it re-paints from `window._PLROWS/_PLLINES`
via `plPaint()` instead of re-querying — no placeholder, no round-trip.

## 3.12 Finance forms — one engine, six forms

`FIN_SPEC` (js/10) describes each form as data: fields with a type, an optional
`col` (promoted to a real column) or nothing (kept in `data` jsonb), a `req`
flag, a `list` naming the `code_lists` list that feeds its dropdown, a `when`
map for conditional sections, and an optional `lines` block. One renderer
(`finField`/`finPaint`) draws all six; one `finSubmit` saves them.

Only fields the form actually *showed* are written — `finSubmit` iterates the
`finVisible`-filtered set, so switching an answer can't smuggle a stale amount
or supplier bank detail from a section that disappeared.

Approval is a chain, not a flag. `approval_routes` holds `(kind, step)` rows
that resolve to a named person, a role, or `use_fund_source` (defer to the
request's fund source), with an optional `min_amount` so a step only applies
above a threshold. A request carries `step`; approving advances it, the final
step sets `approved`, rejection ends it, and each decision is appended to a
`decisions` jsonb array with who, when and the note.

The database enforces the chain rather than trusting the UI: `fr update`'s
USING clause requires `r.step = fin_requests.step`, so a step-2 approver cannot
reach past step 1. The requester's own branch is `status = 'pending'` in USING
and `status = 'cancelled'` in WITH CHECK — they can cancel and do nothing else.
`fr read` is scoped to requester / decider / finance / admin, and the
attachments policy defers to the parent request for the six finance
`rec_type`s, so receipts aren't company-readable.

`canDecideFin` mirrors all of it client-side and adds one rule the UI owns:
you never decide your own request (super admin excepted, so a stuck request can
always be moved).
