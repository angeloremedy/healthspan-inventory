# Healthspan Platform — Roadmap

**The vision: one system that fully replaces Zoho, Shopify, and Verna's sheet —
Healthspan's own NetSuite: ERP + CRM + WMS in a single platform.**
Live at healthspan-inventory.netlify.app. The living copy of this plan is on
Notion — update both as things ship. Last updated: 2026-08-26.

Legend: ✅ done · 🔨 in progress · ⏭ next up · ▢ planned

---

## The three systems being replaced

| System | What it does today | What replaces it | Cutover criteria | Status |
|---|---|---|---|---|
| **Shopify** | Order entry, catalog & pricing truth, order history | Native orders + Catalog/item master | Item master live · parallel-run numbers match for a full month · accounting signs off on the export · credit-memo flow agreed | 🔨 Orders live in parallel; full history migrated; catalog next |
| **Zoho** | CRM records | Unified accounts + visit log + follow-ups + profiles | Pipeline stages + account ownership shipped · team works fully in-app for a month | 🔨 CRM core live; pipeline & ownership remain |
| **Verna's sheet** | Warehouse truth: stock, batches, movement | WMS stock ledger (receive/pick/count in-app) | Receiving + fulfillment decrements + cycle counts live · ledger matches sheet for 2 consecutive counts · Verna signs off | ▢ Read-side done (FEFO picks, DRs); write-side is the endgame — migrate LAST, protect Verna's workflow |

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

**Money (ERP core)**
- ✅ AR aging (current/30/60/90 by order date + noted terms), credit warnings at order entry, payment recording
- ✅ Payment-status sync from Shopify (totalOutstanding is truth; paid-with-balance → partial)
- ✅ Customer statements: printable per-account Statement of Account with aging summary
- ✅ Accounting export: date-range CSV of the register (totals, payments, balances, terms)

**Platform & security**
- ✅ Supabase auth, three access levels: admin / sales manager / product specialist — DB-enforced, role-aware UI & navigation
- ✅ Team & access: in-app user management (create, roles, tags, password resets, disable/enable) with server-side admin verification
- ✅ Audit trail (Activity log): orders, payments, shipments, merges, exports, user management — append-only
- ✅ Row-level security throughout · new-format API keys · hash routing/deep links · role guards on every navigation
- ✅ Home page launcher (role-aware) · theme selector · mobile/iPad with role-aware bottom nav
- ✅ Performance: parallel fetches, session cache, per-role filtered queries

---

## Workstream A — ERP (the NetSuite core)

### Order-to-cash
- ⏭ **Catalog / item master** — products, prices, deal definitions, costs owned in-app. THE Shopify-cutover gate; enables margin reporting. Includes price lists & promo windows.
- ▢ **Approval workflows** — orders above threshold / off-list discounts / credit-hold overrides need manager sign-off (in-app queue + audit)
- ▢ **Credit management** — credit limits per account, automatic credit hold at order entry (warning exists; holds need the limit field)
- ▢ **Returns & credit memos** — return orders that restock (or write off) and generate the credit-memo record accounting signs off (cutover requirement)
- ▢ **Commissions** — rule-based, from booked/collected vs target per specialist
- 🔨 **Accounting export → QBO bridge** — period CSV shipped; field mapping + credit-memo flow to design with accounting
- ▢ **Invoice/DR numbering series** — configurable, BIR-friendly document numbering
- ▢ **Quotations** — formal quotes for clinics, one-click convert to order, expiry dates, win/loss tracking
- ▢ **Standing orders** — recurring monthly orders per account, auto-drafted for specialist confirmation
- ▢ **Promotions engine** — promos as configuration (e.g. "Anniversary 10+8", validity window, eligible SKUs) instead of free-typed deal lines
- ▢ **PDC register** — every post-dated cheque: bank, cheque no., amount, maturity date, status (on hand / deposited / cleared / bounced); links to orders and AR
- ▢ **Cash-flow forecast** — expected collections per week from AR terms + PDC maturities
- ▢ **Consignment inventory** — stock parked at a clinic, billed on use, counted separately
- ▢ **Rebates / volume tiers** — per-account discount tiers with automatic application

### Compliance (pharma)
- ▢ **Batch recall trace** — pick a batch → every customer/order/DR that received it (data already exists; one query + one printable)
- ▢ **Product registration tracking** — CPR/FDA registration per SKU with expiry alerts
- ▢ **Customer license capture** — clinic LTO / doctor PRC on the account, expiry reminders
- ▢ **Complaints log** — product quality reports with batch reference, feeding the recall trace

### Procure-to-pay
- ▢ **Supplier master** — suppliers with terms, lead times, currencies
- ▢ **Purchase orders** — create/approve/send; expected-arrivals feed the stockout forecast
- ▢ **Receiving against PO** — batch + expiry captured at the door (bridges into WMS)
- ▢ **Landed cost & inventory valuation** — true unit costs → COGS and margin by product/line/account
- ▢ **Supplier bills export** — payables summary for QBO
- ▢ **Import shipment tracking** — ETD/ETA, customs clearance status, broker documents per inbound shipment
- ▢ **Multi-currency POs** — USD/EUR purchasing with rate capture at order and at payment

## Workstream B — CRM (the Zoho replacement)

- ⏭ **Account ownership & territories** — every account has an owning specialist; coverage and commissions follow ownership
- ▢ **Lead pipeline** — prospect → qualified → active stages, conversion tracking (the Prospects list is the seed funnel)
- ▢ **Activity cadences** — "no touch in X days" alerts per account tier; call-cycle planning on the calendar
- ▢ **Attachments** — photos, signed DRs, licenses on visits/accounts (Supabase Storage)
- ▢ **Account tiers & segmentation** — A/B/C by value with different service levels
- ▢ **Weekly digest** — visits, coverage, orders, open follow-ups per specialist (email or Slack digest — moved from early phases because Slack isn't in daily use yet)
- ▢ **Multiple contacts per account** — doctor, purchaser, nurse, accounting contact with roles and numbers
- ▢ **Reorder-due alerts** — learn each account's buying cycle; "usually reorders every ~45 days, now 60" auto-creates a follow-up (highest-ROI CRM item)
- ▢ **Sample / FOC budgets** — monthly FOC cap per specialist, approval required above it
- ▢ **Events & trainings log** — demo days, CME dinners per account: cost vs subsequent revenue
- ▢ **Customer ordering portal** (later) — clinics reorder themselves against their price list; orders land in the fulfillment queue

### From the Salesforce / Zoho / NetSuite teardown (Aug 2026)

*Genuine value:*
- ▢ **Customer health score** — one composite per account (momentum + recency + AR + visit coverage) with reasons shown; turns growing/declining/dormant into a single ranked worklist
- ▢ **Upsell recommendations** — "clinics that buy X also buy Y" mined from our own order history, on the account page and in order entry (NetSuite Intelligent Item Recommendations, our data)
- ▢ **Pace-to-target forecasting** — projected month-end attainment per specialist, mid-month ("at this pace, 82%"), so coaching happens before month-end
- ▢ **Workflow automation rules** — the five that matter: fulfilled → follow-up task in 14d; first order → welcome call; balance >60d → collection task; account dormant → owner alert; campaign start → specialist tasks
- ▢ **Geo check-in on visit log** — GPS stamp when logging a visit on-site; verifies field activity for free
- ▢ **Duplicate-entry guard** — "did you mean …?" when a new account name resembles an existing one (keeps the prospects list clean after the cleanup)

*Nice-to-haves:*
- ▢ Route planner — day's planned visits ordered on a map (RouteIQ-style)
- ▢ Leaderboards — attainment race per specialist (cheap; targets + sales already exist)
- ▢ Communication log — quick-log buttons for calls/Viber touches on accounts
- ▢ Anomaly alerts — "3× usual order", "unusually deep discount" (needs the notifications layer)
- ▢ AI next-best-action — per-account nudge via the Ask AI worker (extends reorder-due alerts)

*Considered and skipped:* conversation intelligence (no recorded calls), partner relationship management (no channel partners), CPQ beyond planned quotations, email sequence automation (reps visit, not email)

## Workstream C — WMS (the Verna's-sheet replacement; migrate LAST)

### Stage 1 — read-side (done)
- ✅ FEFO pick lists with bin walk · packing slips · delivery receipts · shipment tracking · fulfillment queue

### Stage 2 — write-side (warehouse truth moves to the database)
- ▢ **Stock ledger in Supabase** — fulfillment decrements, receiving increments, counts adjust; Verna's sheet becomes a report, not the source. THE endgame.
- ▢ **Receiving against PO** (shared with ERP) — batch/expiry at the door
- ▢ **Cycle counts on iPad** — variance log replaces shrinkage guessing
- ▢ **Transfer orders** — Remedy branch shipments as documents with in-transit state
- ▢ **Barcode scanning in the browser** — receive / pick / count
- ▢ **Pick confirmation** — picking against the slip decrements the ledger (kills manual OUT entries)
- ▢ **Returns receiving** — back to stock or quarantine/write-off
- ▢ **Expiry quarantine & disposal log** — compliance trail for pharma products
- ▢ **Stock reservations / ATP** — an order commits stock so two orders can't promise the same units (prerequisite for a trustworthy ledger)
- ▢ **Backorder management** — short-ship tracking with auto-release when stock arrives
- ▢ **Wave picking** — batch several orders into one FEFO warehouse pass
- ▢ **QA hold on receipt** — received stock sits in quarantine until released as sellable
- ▢ **Proof of delivery** — photo of the signed DR attached to the order (needs attachments)
- ▢ **Trip manifests** — several DRs grouped per courier run/route
- ▢ **Courier tracking auto-pull** — LBC/Lalamove status APIs update dispatched/delivered automatically
- ▢ **Warehouse KPIs** — order cycle time, fill rate, on-time-in-full
- ▢ **Multi-bin putaway rules** — several bins per SKU with putaway suggestions

## Workstream D — Platform & engineering (parallel track)

- ⏭ **Close public endpoints** — data feed, Shopify cache, Ask AI behind Supabase session. TOP security gap.
- ▢ **Vite restructure** — split index.html (~14k lines) into modules, git-based deploys; order/CRM code first
- ▢ **Supabase Pro** at cutover — daily backups, PITR, no pause policy; documented restore drill
- ▢ Server-side pagination & filtering for the register (~2 MB/load at 9k orders)
- ▢ Custom domain (e.g. platform.healthspan.ph) + PWA install (home-screen app, offline shell for the field team)
- ▢ **Permissions matrix doc** — one page: which role can do what (kept in repo, enforced in RLS)
- ▢ **Two more access levels** — `logistics` (Verna, Joemar: fulfillment, pick/pack, shipments, receiving, counts — no sales/CRM/finance) and `finance` (Alex, Kristal: AR, payments, statements, exports — no order entry). Accounts planned: Angelo & Paul (admin), Jojo & Marj (manager), 14 specialists (sales), Verna & Joemar (logistics), Alex & Kristal (finance)
- ▢ Scheduled jobs: nightly Shopify cache rebuild until cutover; nightly backfill run = payment sync
- ▢ Notifications: in-app + email for approvals, credit holds, overdue follow-ups
- ▢ Reporting layer: saved report definitions + scheduled exports (the NetSuite "saved search" equivalent)
- ▢ **Forecast accuracy tracking (MAPE)** — record each month's forecast vs what actually sold, per SKU; the foundation for any demand-planning AI and the honest test of the current models
- ▢ Disable legacy Supabase JWT keys (after confirming new keys) · rotate service keys on a schedule

---

## Cutover playbooks

**Shopify OFF when:** item master owns catalog/pricing → specialists enter orders only here → a full parallel month reconciles to accounting → export + credit-memo flow signed off → Shopify downgraded to read-only archive, then cancelled.

**Zoho OFF when:** ownership + pipeline live → all account data confirmed richer in-app than in Zoho → 1 month of full team usage → export Zoho archive, cancel.

**Verna's sheet → report when:** stock ledger live → receiving + pick-confirm + cycle counts running → ledger matches physical count twice in a row → sheet becomes an auto-generated report for continuity. Never delete it; demote it.

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
