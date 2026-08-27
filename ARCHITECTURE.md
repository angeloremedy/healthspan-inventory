# Healthspan Platform — Architecture

How the app is built, in detail. Companion to [README.md](README.md) (usage) and
[SUPABASE-SETUP.md](SUPABASE-SETUP.md) (every SQL migration, in order).
Last updated: 2026-08-26.

---

## 1. Stack at a glance

| Layer | Technology | Notes |
|---|---|---|
| Frontend | **Single-file SPA** — `index.html` (~13k lines, vanilla JS, no framework, no build step) | Deployed by uploading the file to the repo root |
| Hosting | **Netlify** (site: healthspan-inventory.netlify.app) | Auto-deploys from the GitHub repo `angeloremedy/healthspan-inventory` |
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

## 2. Deployment model

No build pipeline yet. Deploys are file uploads to GitHub (`upload/main` for
`index.html`, `upload/main/netlify/functions` for functions); Netlify builds and
publishes automatically. A Vite restructure (split into modules, git-based
deploys) is on the engineering track of the roadmap.

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

Deploys: upload the changed `js/` file(s) and/or `index.html`. A future step
(post-cutover) may graduate this layout to Vite proper (ES modules, code
splitting, minification) — the file boundaries are already drawn for it.

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
| `refresh.mjs` | Google Sheets fetch proxy for the client sync |
| `shopify.mjs` | Serves the cached Shopify sales JSON from Blobs |
| `shopify-build-background.mjs` | Rebuilds the sales cache from Shopify GraphQL (13 months, 6-hour cadence, self-healing) |
| `backfill-background.mjs` | Full-history Shopify → Supabase migration; **re-runnable = payment-status sync** |
| `admin-users.mjs` | In-app account management (list/create/update/password/disable/enable) |
| `visits.mjs` | Legacy visit-log blob fallback (superseded by Supabase) |
| `ask.mjs` / `ask-work-background.mjs` | Ask AI: enqueue + async worker (smart/fast model routing) |
| `asklog.mjs` | Question log for quality monitoring |
| `stockbot.mjs` / `stockbot-work-background.mjs` | Slack /stock bot |

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
to a Netlify Blob (`shopify/backfill`).

### 4.4 `admin-users.mjs` security model
The browser never holds the service key. The function receives the caller's
Supabase session token (`Authorization: Bearer`), verifies it against
`/auth/v1/user`, checks the caller's `profiles.role === 'admin'`, and only then
uses the service key for GoTrue admin endpoints (create user, set password,
`ban_duration` for disable/enable — `876000h` ≈ 100 years, `none` to lift).
Self-disable is rejected.

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

## 6. Numbers & conventions (business logic contracts)

- Peso figures are full numbers everywhere (no ₱145K abbreviations).
- Specialist tag aliases: `SPEC_ALIAS = {kristine: 'Tin'}` merges spellings.
- 2026 targets imported from the Revised Corporate Target workbook (245 rows).
- "Vs accounting" reconciles to the Sales Report sheet's **Sales Booked
  excluding Remedy** (verified: 102.4M − 9.9M Remedy = 92.46M).
- Native orders stay **out of sales totals** during the parallel run with
  Shopify (no double counting) — they fold in at cutover.
- FEFO pick lists walk `BATCHES` per SKU by earliest expiry, with bin locations
  from the product master.

## 7. Known gaps / engineering track

- **Public endpoints** (sheet feed, Shopify cache JSON, Ask AI) are not yet
  behind auth — top security gap, on the roadmap.
- Single-file SPA → Vite modular restructure planned.
- Client-side pagination (~2 MB register at 9k orders) → server-side later.
- Supabase free tier until cutover → Pro (backups, no pause).
- Legacy Supabase JWT keys to disable after verifying the new keys.
- Custom domain (e.g. crm.healthspan.ph) pending.
