# Healthspan Platform — Architecture

How the app is built, in detail. Companion to [README.md](README.md) (usage) and
[SUPABASE-SETUP.md](SUPABASE-SETUP.md) (every SQL migration, in order).
Last updated: 2026-08-28.

---

## 1. Stack at a glance

| Layer | Technology | Notes |
|---|---|---|
| Frontend | **Modular SPA, no build step** — `index.html` (shell + CSS) + 10 ordered classic scripts in `js/01…10` (vanilla JS, shared global scope, load order matters) | Deployed by uploading files to the repo; PWA-installable |
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

### The finance-forms engine takes new forms as data

`expreport` (expense reports — revolving-fund liquidation) is the eighth kind:
an entry in `FIN_KINDS`/`FIN_SPEC` (js/10), a `doc_formats` row (ER-), the kind
added to the `fin_requests` check constraint and to the attachments-visibility
policy. No new tables, no new rendering code — the engine draws the form from
its spec, including the itemised lines (fin_lines). The approval route is data
(Admin → Approval routes).

### Boot: splash and deferred scripts

`#splash` is inline in index.html before any script and fades via `splashHide()`
(js/09) once the profile loads or the login form renders; an inline 8s failsafe
clears it even if the JS fails. Every external script carries `defer`, so first
paint (the splash) happens before ~1.3MB of JS downloads or parses — order is
preserved (CDN libs, then js/01…11). JS and HTML stay on Netlify's etag
revalidation on purpose: the files are unhashed, and long caching would let one
script go stale against the others mid-deploy. Only images cache long.

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

### 3.6 One permission truth for views
`viewAllowed(v)` (js/02) is the single rule set: `showView` redirects with it,
`navSync()` hides sidebar items and whole sections with it, and the mobile menu
filters with it. Changing a view's access = one edit. Activity log is admin +
super admin only (tightened 2026-08-28).

### 3.7 View-writers map & the generated home
`VIEW_WRITERS` (js/10) records which roles write in each view: it renders the
read-only banners inside views AND the 👁 badges on home cards. Home = one
curated action row per role + the sidebar's own categories listing every
`viewAllowed()` page (title minus badge counts, svg cloned with explicit
stroke attrs) — home and sidebar share one structure, and new nav items appear
on Home automatically. The old `role-sales` CSS nav filter is gone; `navSync`
drives sidebar visibility for every role, so sales get the same collapsible
categories.

### 4.6 Role-scoped Ask AI
`ask.mjs` derives the caller's role/tag server-side (unspoofable) and passes it
to the worker, which builds an HQ context from Supabase filtered to that role:
AR/PDC/payables/costs only for finance+admin, approvals for managers,
warehouse queues for supply chain, own-tag orders/quotes for specialists — with
hard system-prompt rules never to reveal costs/margins outside finance/admin.

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
- Modular restructure Phase 1 done (10 modules, byte-identical); Phase 2 =
  Vite proper, post-cutover.
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
