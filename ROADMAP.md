# Healthspan Platform — Roadmap

**The vision: one system that fully replaces Zoho, Shopify, and Verna's sheet —
Healthspan's own NetSuite: ERP + CRM + WMS in a single platform.**
Live at hq.healthspan.ph (installable as an app). The living copy of this plan is
on Notion — update both as things ship. Last updated: 2026-08-28.

Legend: ✅ done · 🔨 in progress · ⏭ next up · ▢ planned

---

## The three systems being replaced

| System | What it does today | What replaces it | Cutover criteria | Status |
|---|---|---|---|---|
| **Shopify** | Order entry, catalog & pricing truth, order history | Native orders + Catalog/item master | Item master live · parallel-run numbers match for a full month · accounting signs off on the export · credit-memo flow agreed | 🔨 Parallel run; item master live in shadow (deals + drift check); remaining: drift→0, month reconciles |
| **Zoho** | CRM records | Unified accounts + visit log + follow-ups + profiles | Pipeline stages + account ownership shipped · team works fully in-app for a month | 🔨 Ownership + pipeline + opportunities LIVE; clock running on a month of full team use |
| **Verna's sheet** | Warehouse truth: stock, batches, movement | WMS stock ledger (receive/pick/count in-app) | Receiving + fulfillment decrements + cycle counts live · ledger matches sheet for 2 consecutive counts · Verna signs off | 🔨 Shadow ledger recording both ways (receiving + batch-stamped picks + counts w/ variance); remaining: opening-balance snapshot + stk() switch + matching counts |

**QBO stays** (general ledger, financial statements, BIR/tax, payroll). The
platform feeds it via the accounting export; it does not replace it.

---

## ✅ Shipped so far (everything, from the start)

**Data pipeline & sync**
- ✅ Live Google Sheets sync of Verna's master file (products, batches, IN/OUT movement, pull-outs), auto-refresh every 15 min, localStorage instant-load cache, sync progress UI
- ✅ Header-name-based column mapping — survives inserted columns (the SUPPLIER-column incident)
- ✅ Open-ended sheet ranges — feed can never go blind again when tabs outgrow a row ceiling (the dead-movement-feed incident that hid all July/Aug outflow)
- ✅ Footer-junk guards, feed-health field (last movement date)
- ✅ Targets tab reader (tolerant of any month format Verna types)
- ✅ Accounting Sales Report reader — auto-discovers the Summary tab, parses monthly Sales Booked + QBO, ignores stacked sub-tables

**Core inventory dashboard**
- ✅ Dashboard: KPI cards, running-out-within-30-days, category split donut, out-of-stock commercial, expiring-within-3-months
- ✅ Action center (prioritized to-dos) · All SKUs (sortable) · product detail drawers
- ✅ Alerts: out of stock, low stock, negative stock, expiry tracker, reorder alerts
- ✅ Planning suite: stockout forecast (trend + seasonal velocity), stock coverage, reorder plan, reorder point, demand variability (CV classes), ABC analysis, write-off forecast
- ✅ Ten simulators: what-if, promo rescue, budget optimizer, service level, campaign surge, Monte Carlo stockout risk, 12-month projection, cash-flow timeline, bulk-buy trade-off, Remedy branch rebalancing
- ✅ Analytics: monthly movement chart, inventory value by line, deal scenarios, batch view (FEFO), data health (incl. price≠Shopify and stock≠Shopify reconciliation)
- ✅ Finance views: aged inventory, shrinkage tracker, cash in expiring stock
- ✅ Logistics views: Remedy branch shipments log, Remedy branch expiry watch
- ✅ Every view: plain-language description + collapsible methodology + CSV export
- ✅ Full-number formatting everywhere

**Shopify integration (read side)**
- ✅ Custom app via client-credentials OAuth (survived the Jan-2026 shpat retirement); protected-customer-data grant
- ✅ 6-hour background cache (Netlify Blobs) with self-healing rebuild
- ✅ Price/deal/inventory merge and reconciliation (Shopify = pricing truth, sheet = stock truth)
- ✅ 13-month demand with correct deal-aware unit counting, daily granularity, deal-SKU matching
- ✅ Order-edit correctness: removed line items (currentQuantity 0) no longer inflate totals/sales anywhere
- ✅ Specialists from order tags (case/alias merging), per-customer booked totals

**AI layer**
- ✅ Ask AI in-app chat over live inventory+sales (async worker, smart/fast routing)
- ✅ Slack /stock bot · Copy-for-AI export · question log

**Sales analytics**
- ✅ Sales overview (units/value, deals vs à-la-carte vs free, flexible periods, charts)
- ✅ Deals vs à la carte · Free items (true giveaways only)
- ✅ Sales vs target (2026 corporate targets, 245 rows) · per-specialist drill-downs
- ✅ Field coverage (Veeva-style) · Vs accounting (peso-for-peso reconciliation)
- ✅ Pull-outs and TEST orders excluded from sales; retained in finance/logistics

**Orders (Shopify replacement — pilot live)**
- ✅ Order entry: searchable pickers, deal pricing (N+1 auto-adds the free line), FOC lines, HS-numbering
- ✅ FULL Shopify history migrated into Supabase (~8,900 orders) — idempotent, re-runnable backfill that doubles as payment sync
- ✅ All-time register with pagination, full-page order views, admin status controls (fulfill/unfulfill/cancel/reopen)
- ✅ Recycle bin (confirm → trash → restore → double-confirmed empty)
- ✅ DB-enforced: specialists submit only under their own name
- ✅ Shipment tracking: courier, waybill, dispatched/delivered marks
- ✅ Delivery receipts (printable PDF with signature blocks) · FEFO pick lists / packing slips
- ✅ Fulfillment queue (Verna's daily worklist, age-flagged)

**CRM (Zoho replacement — core live)**
- ✅ Unified accounts merged across OUT sheet + Shopify + visit log; doubled-name cleanup; automatic branch grouping + curated groups (Aivee)
- ✅ In-app duplicate merge + parent/child linking (admin & manager), reversible, stored in account_links
- ✅ Prospects working list: 500+ Shopify-only accounts split into likely mismatches (≈ suggestions + one-click merge), active prospects, lapsed buyers · CSV export
- ✅ Full-page account profiles: KPI cards, merged clickable timeline, what-they-buy, editable details, branch chips, quick actions
- ✅ Visit log (~10 s on iPad) + planned visits + follow-ups queue (outcome-driven, overdue flags)
- ✅ Specialist profiles + month calendar (visits + orders + targets chart) — specialists land on their own page
- ✅ CRM enrichment fields on accounts: email/Viber, region+city, clinic type, tier A/B/C, source, delivery notes (print on the DR), birthday & clinic anniversary, LTO/PRC licenses with expiry pills; contacts get email + Viber

**Money (ERP core)**
- ✅ AR aging (current/30/60/90 by order date + noted terms), credit warnings at order entry, payment recording
- ✅ Payment-status sync from Shopify (totalOutstanding is truth; paid-with-balance → partial)
- ✅ Customer statements: printable per-account Statement of Account with aging summary
- ✅ Accounting export: date-range CSV of the register (totals, payments, balances, terms)

**Automation layer (Aug 28)**
- ✅ Nightly full backup: every table → dated JSON in Netlify Blobs (14 kept), super-admin download on the Cutover page — the free-tier safety net until Supabase Pro
- ✅ Five workflow automation rules (nightly sweep → bell + follow-up tasks, deduped via auto_log)
- ✅ Anomaly alerts at order submit (3× usual size, deep discounts) → managers
- ✅ Cash-flow forecast: weekly expected collections from AR terms + PDC maturities

**Cutover evidence pack (Aug 28)**
- ✅ Opening-balance snapshot: super-admin freeze on the Cutover page — sheet stock becomes the ledger's epoch-stamped starting point
- ✅ stk() switch: ledger_is_truth ON → stock everywhere = opening + post-epoch ledger movements (THE endgame, now flippable)
- ✅ Cycle counts on iPad: blind sessions by scope, graded on close, variances write ledger adjustments; two clean counts = cutover evidence
- ✅ Supabase Pro checklist + restore drill documented (no AWS — portability via plain Postgres)

**The machine connected (Aug 28)**
- ✅ Notifications: bell + unread badge; approval holds → managers, decisions → specialist, approved orders → warehouse, fulfillments → order owner (90s poll)
- ✅ Stock reservations / ATP: order entry shows on-hand · promised · available-to-promise; specialists can't oversell, managers can override; auto-release on fulfill/cancel
- ✅ Startup fix: sidebar collapse now applies at load (the init call ran before its module loaded) — product lines truly start collapsed

**Order-to-cash & compliance (Aug 28)**
- ✅ Quotations: formal QT-numbered quotes, printable, win/loss tracked, one-tap convert to order
- ✅ Promotions engine: configured promos (window + SKUs + mechanic) auto-apply at order entry & quotes
- ✅ Product registrations: CPR/FDA number + expiry per SKU with renewal alerts
- ✅ Role dropdown separated (super admin / admin / sales manager / product specialist / supply chain / finance / marketing / viewer / IT) — no personal names; IT = viewer + PS-account admin

**Finance suite (Aug 27)**
- ✅ Approvals: credit limits per account (finance-set) + approval threshold (super-admin flag); over-limit/over-threshold sales orders auto-hold for manager sign-off, audited
- ✅ Commissions: tiered %-of-target rules, monthly per-specialist compute, CSV export
- ✅ Supplier bills / AP on POs: terms, proforma, currency, FX total, paid, peso value + open-payables total
- ✅ Events calendar: campaigns + planned visits + demos in one month grid (role-aware)

**Platform & security**
- ✅ Eight access levels (super admin → viewer): circle read / role write, DB-enforced; super admin protected from other admins; PERMISSIONS.md is the matrix
- ✅ Pipeline (PRD B–C): staged funnel + opportunities with weighted value & win rate
- ✅ Purchase orders + receiving into the ledger; picks FEFO-batch-stamped (recall-proof)
- ✅ Home command center (live chips + needs-attention) · sidebar search + collapsible sections · full mobile menu
- ✅ PWA: hq.healthspan.ph installable (manifest/icons/standalone), touch polish, view animations, zoom lock, iOS fixes (dvh scroll, pre-paint theme, status-bar backdrop, date-input overflow), sync-flicker fix
- ✅ Supabase auth, three access levels: admin / sales manager / product specialist — DB-enforced, role-aware UI & navigation
- ✅ Team & access: in-app user management (create, roles, tags, password resets, disable/enable) with server-side admin verification
- ✅ Audit trail (Activity log): orders, payments, shipments, merges, exports, user management — append-only
- ✅ Row-level security throughout · new-format API keys · hash routing/deep links · role guards on every navigation
- ✅ Home page launcher (role-aware) · theme selector · mobile/iPad with role-aware bottom nav
- ✅ Performance: parallel fetches, session cache, per-role filtered queries

---

## Workstream A — ERP (the NetSuite core)

### Order-to-cash
- 🔨 **Catalog / item master** — core shipped (prices, costs, barcodes, drift check, deal definitions, cutover flag); price lists & promo windows remain
- ✅ **Approval workflows** — shipped (orders over the credit limit or the approval threshold auto-hold; manager/admin approve-or-reject queue, audited)
- ✅ **Credit management** — shipped (per-account credit limits set by finance; order entry checks open exposure + new total and holds automatically)
- ✅ **Returns & credit memos** — shipped (Finance → Returns & credit memos; parallel-run banner until cutover)
- ✅ **Commissions** — shipped (tiered %-of-target rules, per-specialist monthly compute, finance-editable tiers, CSV export for payroll)
- 🔨 **Accounting export → QBO bridge** — period CSV shipped; field mapping + credit-memo flow to design with accounting
- ▢ **Invoice/DR numbering series** — configurable, BIR-friendly document numbering
- ✅ **Quotations** — shipped (QT-numbered quotes with catalog/deal/promo pricing, validity dates, printable, sent/accepted/lost tracking with win rate, one-tap convert to a prefilled order)
- ▢ **Standing orders** — recurring monthly orders per account, auto-drafted for specialist confirmation
- ✅ **Promotions engine** — shipped (promos as configuration: window + SKU list + buy-N-get-M or %-off; auto-applies in order entry and quotations, lines tagged with the promo name)
- ✅ **PDC register** — shipped (Finance → PDC register; finance-owned writes)
- ✅ **Cash-flow forecast** — shipped (Finance → Cash-flow forecast: 8 weekly buckets from AR terms + PDC maturities, overdue bucket, cheque-covered AR not double-counted)
- ▢ **Consignment inventory** — stock parked at a clinic, billed on use, counted separately
- ▢ **Rebates / volume tiers** — per-account discount tiers with automatic application

### Compliance (pharma)
- ✅ **Batch recall trace** — shipped (OUT-sheet history + ledger picks; survives sheet retirement)
- ✅ **Product registration tracking** — shipped (CPR/FDA number + expiry per SKU on the item master; expired/expiring-soon float to the top with red/amber flags)
- ✅ **Customer license capture** — shipped (LTO + PRC numbers with expiry dates on the account; red/amber expiry pills)
- ▢ **Complaints log** — product quality reports with batch reference, feeding the recall trace

### Procure-to-pay
- ▢ **Supplier master** — suppliers with terms, lead times, currencies
- ✅ **Purchase orders** — shipped (Logistics → Purchase orders); expected-arrivals→forecast link still to wire
- ✅ **Receiving against PO** — shipped (batch + expiry at the door → stock ledger)
- ▢ **Landed cost & inventory valuation** — true unit costs → COGS and margin by product/line/account
- ✅ **Supplier bills / AP** — shipped (terms, proforma ref, currency, FX total, amount paid, peso value on each PO; open-payables total). QBO export format to agree with accounting
- ▢ **Import shipment tracking** — ETD/ETA, customs clearance status, broker documents per inbound shipment
- ▢ **Multi-currency POs** — USD/EUR purchasing with rate capture at order and at payment

## Workstream B — CRM (the Zoho replacement)

- ✅ **Account ownership** — shipped (account pages + Accounts list inline assign); territories still open
- ✅ **Lead pipeline** — shipped (Pipeline view: stages from behavior + audited moves, lost reasons)
- ▢ **Activity cadences** — "no touch in X days" alerts per account tier; call-cycle planning on the calendar
- ▢ **Attachments** — photos, signed DRs, licenses on visits/accounts (Supabase Storage)
- 🔨 **Account tiers & segmentation** — tier field (A/B/C) shipped on accounts; tier-based service levels/cadences still open
- ▢ **Weekly digest** — visits, coverage, orders, open follow-ups per specialist (email or Slack digest — moved from early phases because Slack isn't in daily use yet)
- ✅ **Multiple contacts per account** — shipped (account pages)
- ✅ **Reorder-due alerts** — shipped (Reorder due; routes to the account owner)
- ▢ **Sample / FOC budgets** — monthly FOC cap per specialist, approval required above it
- ✅ **Events calendar** — shipped (month grid merging campaigns, planned visits, and demo/training visits; specialists see their own). Cost-vs-revenue per event still open
- ▢ **Customer ordering portal** (later) — clinics reorder themselves against their price list; orders land in the fulfillment queue

### From the Salesforce / Zoho / NetSuite teardown (Aug 2026)

*Genuine value:*
- ✅ **Customer health score** — shipped (Accounts list)
- ✅ **Upsell recommendations** — shipped (account pages + order entry)
- ✅ **Pace-to-target forecasting** — shipped (Leaderboard & pace)
- ✅ **Workflow automation rules** — shipped (nightly sweep: fulfilled → follow-up task in 14d; first order → welcome call; balance >60d → collection ping to finance + owner; dormant account → owner alert; campaign/promo start → specialist ping; deduped, tasks land in Follow-ups & plans)
- ✅ **Duplicate-entry guard** — shipped (order entry + visit log)

*Nice-to-haves:*
- ✅ Leaderboards — shipped (Leaderboard & pace)
- ▢ Communication log — quick-log buttons for calls/Viber touches on accounts
- ✅ Anomaly alerts — shipped (order submit checks 3× the account's median total and >30%-below-list lines; pings managers, non-blocking, audited)
- ▢ AI next-best-action — per-account nudge via the Ask AI worker (extends reorder-due alerts)

*Considered and skipped:* conversation intelligence (no recorded calls), partner relationship management (no channel partners), CPQ beyond planned quotations, email sequence automation (reps visit, not email), geo check-in / route planner / proof of delivery (third-party couriers deliver — no field-delivery ops to verify)

## Workstream C — WMS (the Verna's-sheet replacement; migrate LAST)

### Stage 1 — read-side (done)
- ✅ FEFO pick lists with bin walk · packing slips · delivery receipts · shipment tracking · fulfillment queue

### Stage 2 — write-side (warehouse truth moves to the database)
- ✅ **Stock ledger in Supabase — CUTOVER-READY**: shadow ledger + opening-balance snapshot (super-admin freeze on the Cutover page, epoch-stamped, re-freezable) + stk() switch shipped (when ledger_is_truth is ON, stock everywhere = opening + post-epoch movements; counts are observations). Remaining: run the counts, get Verna's sign-off, flip.
- ✅ **Receiving against PO** — shipped (shared with ERP; batch/expiry at the door)
- ✅ **Cycle counts on iPad** — shipped (blind count sessions by scope, graded on close, variances write ledger adjustments; last-two-sessions evidence shows on the Cutover page)
- ▢ **Transfer orders** — Remedy branch shipments as documents with in-transit state
- ✅ **Barcode scanning in the browser** — shipped (Scan view; shadow ledger)
- ✅ **Pick confirmation** — shipped (FEFO batch-stamped; auto-fulfills the order)
- ▢ **Returns receiving** — back to stock or quarantine/write-off
- ▢ **Expiry quarantine & disposal log** — compliance trail for pharma products
- ✅ **Stock reservations / ATP** — shipped (pending native orders ARE the reservation; order entry shows on-hand / promised / available-to-promise, blocks specialists from overselling, manager override with confirm; releases automatically on fulfill/cancel)
- ▢ **Backorder management** — short-ship tracking with auto-release when stock arrives
- ▢ **Wave picking** — batch several orders into one FEFO warehouse pass
- ▢ **QA hold on receipt** — received stock sits in quarantine until released as sellable
- ▢ **Trip manifests** — several DRs grouped per courier run/route
- ▢ **Courier tracking auto-pull** — LBC/Lalamove status APIs update dispatched/delivered automatically
- ▢ **Warehouse KPIs** — order cycle time, fill rate, on-time-in-full
- ▢ **Multi-bin putaway rules** — several bins per SKU with putaway suggestions

## Workstream D — Platform & engineering (parallel track)

- ✅ **Close public endpoints** — shipped (session-verified server-side; JOB_KEY jobs; access codes removed)
- 🔨 **Modular restructure** — Phase 1 DONE: the single 15k-line file is split into `index.html` (shell/CSS) + 9 ordered script modules in `js/`, proven byte-identical on reassembly; zero build step, drag-drop deploys unchanged. Phase 2 (post-cutover): Vite proper — ES modules, per-view code splitting, minification, git-based deploys
- 🔨 **Supabase Pro** at cutover — checklist + restore drill documented in SUPABASE-SETUP.md (decided: staying on Supabase; plain-Postgres portability is the exit strategy). Remaining: Angelo upgrades + runs the drill
- ▢ Server-side pagination & filtering for the register (~2 MB/load at 9k orders)
- ✅ Custom domain (hq.healthspan.ph) + PWA install — shipped (manifest, icons, standalone, touch polish, zoom lock; no offline cache by design)
- ✅ **Permissions matrix doc** — shipped (PERMISSIONS.md; updated with every feature)
- ✅ **Access levels** — superseded and shipped as the eight-role rollout (super admin / admin / manager / sales / supply_chain / finance / marketing / viewer) + scoped PS-account admin for IT (Justine)
- ✅ Scheduled jobs — shipped (nightly 2am Manila: backfill sync + sales-cache rebuild)
- ✅ Notifications (in-app): bell + badge; held orders ping managers, decisions ping the specialist, approved orders ping the warehouse, fulfillments ping the order owner. Email later if needed
- ▢ Reporting layer: saved report definitions + scheduled exports (the NetSuite "saved search" equivalent)
- ✅ **Forecast accuracy tracking (MAPE)** — shipped (Planning → Forecast accuracy; monthly freeze + self-grading)
- ▢ Disable legacy Supabase JWT keys (after confirming new keys) · rotate service keys on a schedule

---

## Cutover playbooks

**Shopify OFF when:** item master owns catalog/pricing → specialists enter orders only here → a full parallel month reconciles to accounting → export + credit-memo flow signed off → Shopify downgraded to read-only archive, then cancelled.

**Zoho OFF when:** ownership + pipeline live → all account data confirmed richer in-app than in Zoho → 1 month of full team usage → export Zoho archive, cancel.

**Verna's sheet → report when:** stock ledger live → receiving + pick-confirm + cycle counts running → ledger matches physical count twice in a row → sheet becomes an auto-generated report for continuity. Never delete it; demote it.

## HR decisions (Aug 2026)
- ✅ **Review scorecards** — shipped (Sales analytics, mgmt-only): quarterly reviews auto-filled from live data + rating/comments (RLS-hidden from specialists)
- ✅ Commissions-as-payroll-input — shipped (Commissions view CSV export)
- ✗ Employee directory, leave management, geo-check-in attendance — decided against

## Deliberately NOT building
- General ledger, financial statements, BIR/tax filing, payroll → QBO
- Payment processing → collections stay bank-transfer + accounting
- Sales-stats switchover before cutover (native orders fold into sales views only at cutover — no double-counting during the parallel run)

## Standing decisions & conventions
- Truth today: Verna's sheet = warehouse · accounting sheet = booked sales · Supabase = orders/CRM · Shopify = pricing (until item master)
- Deal +1s are deal units, not free items; "free" = ₱0 outside any deal
- Pull-outs (customer name contains "pull-out") are internal, never sales
- Specialist aliases in `SPEC_ALIAS`; curated groups + in-app links in `account_links`
- Every new mutation gets an `audit()` call — no exceptions
