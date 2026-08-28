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
- ✅ Dated payments ledger (Aug 28): every payment an append-only row with date/method/reference — cash finally has a period

**Cadence + clarity (Aug 28)**
- ✅ Tiered activity cadences (A/B/C = 30/45/60d) · ✅ AI next-best-action (Monday top-3 calls per specialist)
- ✅ Transfer orders: branch shipments as documents with FEFO ledger writes and in-transit state
- ✅ Manual VIEWER in-app (iframe + download + full-screen) — every role, one tap
- ✅ View-only clarity: read-only views banner who actually edits them (VIEW_WRITERS map); same map badges the home cards
- ✅ Home = the role's action row + the sidebar's own categories with every page the role can open (icons per view, 👁 view-only badges, badge-count-free titles) — home and sidebar share one structure
- ✅ Sidebar unified: navSync drives every role (sales now get the same collapsible categories instead of a flat CSS-filtered list)
- ✅ Mobile once-and-for-all: sticky top bar (never scrolls away, no rubber-band gap) · customizable bottom bar (each user picks their 4 quick-access pages; Home + Menu fixed)
- ✅ HD home-screen icons: white logo on brand blue (192/512/maskable/apple-touch)

**Accounting integrity pack (Aug 28)**
- ✅ Period close: super-admin closed-through date; order amounts/dates/lines, credit memos, cheque maturities and monthly targets freeze on or before it. Enforced by Postgres triggers, so neither a client bug nor a service-key job can restate a signed-off month; collections, shipping and DR numbers stay open
- ✅ Backfill respects the close: may still import an unseen historical order, may not rewrite a closed one's amounts/dates/lines (sends payment + shipment fields only; reports the count)
- ✅ Dated payments: append-only `payments` rows with date/method/reference — "collections in August" is now answerable; orders.paid/balance stay the rollup
- ✅ Month-end valuation snapshots: freeze the month's value/units/per-SKU detail permanently (finance+admin; re-freeze is super admin) + nightly nudge on the 1st
- ✅ Credit memos net: date + specialist + "already refunded in Shopify" flag; Commissions compute on net (booked − that month's CMs), so a return can drop a tier
- ✅ PO approvals: purchase orders over the purchase threshold hold as drafts and land in Approvals as a purchase hold (admin decides); threshold is a super-admin setting

**Working the gaps pack (Aug 28)**
- ✅ Short-dated stock queue (Logistics): every lot expiring within 6 months, worst first, with ₱ at risk — each gets a plan (discount / FOC / transfer / quarantine / accept), an owner, a target date; unplanned value totalled separately; closing records the outcome
- ✅ Receiving & supplier scorecard: fill rate, on-time vs ETA, real lead time vs quoted, plus every closed-PO line where received ≠ ordered valued at cost (admin/finance/supply chain — it shows cost)
- ✅ Quote chase rule: a quote at 'sent' for 7+ days pings the specialist who raised it (flags an expired validity date), once per quote
- ✅ Birthday / clinic anniversary rule: owner pinged 3 days ahead, once per year, from the CRM dates already captured
- ✅ Cost-boundary fix found while auditing: the PO unit-cost column was visible to sales managers — now gated to admin/finance/warehouse like every other cost surface
- ✅ Desktop sidebar hideable (hamburger, remembered per device) · mobile bars render only after sign-in · iOS 26 bottom-gap bug un-triggered

**Procure-to-pay + platform polish (Aug 28)**
- ✅ Supplier master · import shipment tracking (ETD/ETA/customs) · multi-currency payment FX · landed cost & valuation (true margins, admin+finance) · QA hold on receipt
- ✅ Ask AI expanded: whole-HQ live context (AR, PDCs, approvals, backorders, quotes, pipeline, complaints), server-scoped to the asker's role — costs only ever shown to finance/admin
- ✅ Mobile fix: custom suggestion dropdowns replace <datalist> on touch devices (log visit / order entry / all pickers now suggest on iPhone/iPad)
- ✅ Homepage rebuilt per role: action cards first, nothing a role can't open
- ✅ Notifications tightened: only the action-taker is pinged (approvals/anomalies → managers; backorders/complaints → supply chain; team digest → managers)
- ✅ Sidebar = permissions: viewAllowed() now drives showView, the sidebar, and the mobile menu from one rule set — roles only see pages they can open; empty sections (e.g. Admin for finance) vanish
- ✅ Activity log tightened to admin + super admin only

**Ledger-truth pack (Aug 28)**
- ✅ Backorders: ATP overrides tracked, auto-release + pings when stock arrives
- ✅ Returns receiving → ledger or quarantine · ✅ Quarantine & disposal log (compliance trail)
- ✅ Warehouse KPIs (cycle time via new fulfilled_at, fill rate, ≤48h share) · ✅ Complaints log with recall-trace link
- ✅ In-app role manuals: every user downloads their own manual (sidebar “manual” / mobile “My manual”), served through a session-checked function; personal names removed from all manuals

**Second-switch pack (Aug 28)**
- ✅ DR numbering series (BIR-friendly, atomic, permanent per order) — order-paper blocker for platform-only orders cleared
- ✅ Server-side register pagination + search — the register scales past the parallel run
- ✅ Quote ↔ pipeline linking (accepted → won + active; lost → reason on the opportunity)
- ✅ Weekly Monday digest (per specialist + team) via the bell
- ✅ Communication log: Call / Viber quick-log on account pages

**Automation layer (Aug 28)**
- ✅ Nightly full backup: every table → dated JSON in Netlify Blobs (14 kept), super-admin download on the Cutover page — the free-tier safety net until Supabase Pro
- ✅ Nine workflow automation rules (nightly sweep → bell + follow-up tasks, deduped via auto_log) — incl. quote chase and birthday/anniversary as of Aug 28
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
- ✅ **Invoice/DR numbering series** — shipped (doc_series table + atomic RPC; permanent DR numbers assigned at first print, configurable prefix/next/pad on the Cutover page; falls back to HS numbers when unconfigured)
- ✅ **Quotations** — shipped (QT-numbered quotes with catalog/deal/promo pricing, validity dates, printable, sent/accepted/lost tracking with win rate, one-tap convert to a prefilled order)
- ▢ **Standing orders** — recurring monthly orders per account, auto-drafted for specialist confirmation
- ✅ **Promotions engine** — shipped (promos as configuration: window + SKU list + buy-N-get-M or %-off; auto-applies in order entry and quotations, lines tagged with the promo name)
- ✅ **PDC register** — shipped (Finance → PDC register; finance-owned writes)
- ✅ **Cash-flow forecast** — shipped (Finance → Cash-flow forecast: 8 weekly buckets from AR terms + PDC maturities, overdue bucket, cheque-covered AR not double-counted)
- ▢ **Consignment inventory** — stock parked at a clinic, billed on use, counted separately
- ▢ **Rebates / volume tiers** — per-account discount tiers with automatic application

### Accounting integrity (scoped 2026-08-28 — next pack)
- ✅ **Period close / month-end lock** — shipped (closed_through date; Postgres triggers over orders, order_lines, payments, returns, pdcs, spec_targets; super-admin bypass; collections/shipping stay open; backfill sends reduced payloads for closed periods)
- ✅ **Monthly valuation snapshot** — shipped (Freeze on Landed cost & valuation: total, units, SKU count, stock basis and per-SKU JSONB detail; history table; nightly nudge on the 1st)
- ✅ **Returns netting** — shipped (audit found CMs netted NOWHERE: not sales, not pace, not commissions, and AR only via a manual admin action). Fixed where it pays: returns carry date + specialist + shopify_refunded, and Commissions compute on net. Sales/pace views stay gross by design — Shopify already nets refunds at source during the parallel run — and now say so
- ✅ **PO approvals** — shipped (over-threshold POs stay drafts, land in Approvals as a purchase hold, ping admin; approve → ordered, reject → cancelled)

### Devices & after-sales (scoped 2026-08-28)
- ▢ **Serial-number tracking** — serialized machines (which clinic has which unit), warranty end dates, service/repair history per serial
- ▢ **Demo / loaner unit tracking** — machines in the field for demos: neither sold nor in the warehouse, currently invisible

### Compliance (pharma)
- ✅ **Batch recall trace** — shipped (OUT-sheet history + ledger picks; survives sheet retirement)
- ✅ **Product registration tracking** — shipped (CPR/FDA number + expiry per SKU on the item master; expired/expiring-soon float to the top with red/amber flags)
- ✅ **Customer license capture** — shipped (LTO + PRC numbers with expiry dates on the account; red/amber expiry pills)
- ✅ **Complaints log** — shipped (field-filed with batch on record, one tap into the recall trace; closing requires a resolution note)

### Procure-to-pay
- ✅ **Supplier master** — shipped (Logistics → Suppliers & imports: currencies, terms, lead times, contacts, active/inactive)
- ✅ **Purchase orders** — shipped (Logistics → Purchase orders); expected-arrivals→forecast link still to wire
- ✅ **Receiving against PO** — shipped (batch + expiry at the door → stock ledger)
- ✅ **Landed cost & inventory valuation** — shipped (Finance → Landed cost & valuation: latest PO cost × payment FX + landed allocation, real margins per SKU, inventory value at cost; admin+finance only)
- ✅ **Supplier bills / AP** — shipped (terms, proforma ref, currency, FX total, amount paid, peso value on each PO; open-payables total). QBO export format to agree with accounting
- ✅ **Import shipment tracking** — shipped (ETD/ETA/customs/broker per PO + "on the water" list sorted by ETA)
- ✅ **Multi-currency POs** — shipped (currency + FX totals existed; payment FX rate added and drives ₱ valuation)

## Workstream B — CRM (the Zoho replacement)

- ✅ **Account ownership** — shipped (account pages + Accounts list inline assign); territories still open
- ✅ **Lead pipeline** — shipped (Pipeline view: stages from behavior + audited moves, lost reasons)
- ✅ **Activity cadences** — shipped (dormancy alerts tiered by A/B/C: 30/45/60 days; owner pinged inside the window, monthly dedup)
- ▢ **Attachments** — photos, signed DRs, licenses on visits/accounts. DESIGN DECIDED (2026-08-28): Google Drive via a service-account Netlify function (file IDs stored in Supabase), not Supabase Storage
- 🔨 **Account tiers & segmentation** — tier field (A/B/C) shipped on accounts; tier-based service levels/cadences still open
- ✅ **Quote chase** — shipped (a quote left at 'sent' for 7+ days pings the specialist who raised it; flags a lapsed validity date)
- ✅ **Birthday / clinic anniversary pings** — shipped (owner pinged 3 days ahead, once per year, from the dates already on the account)
- ✅ **Weekly digest** — shipped (Monday bell digest per specialist: booked, orders, visits, open follow-ups; plus a team digest for managers/admin — no email/Slack dependency)
- ✅ **Multiple contacts per account** — shipped (account pages)
- ✅ **Reorder-due alerts** — shipped (Reorder due; routes to the account owner)
- ✅ **Quote ↔ pipeline linking** — shipped (accepted quote → open opportunities marked won + account stage → active; lost quote → opportunities lost with the reason; audited)
- ✗ Sample / FOC budgets — decided against (2026-08-28)
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
- ✅ Communication log — shipped (Call / Viber quick-log buttons on account pages; touches count for timeline, coverage, and the dormancy rule)
- ✅ Anomaly alerts — shipped (order submit checks 3× the account's median total and >30%-below-list lines; pings managers, non-blocking, audited)
- ✅ AI next-best-action — shipped (Monday ping per specialist: their 3 highest-value quiet accounts, ranked by 6-month value × how overdue; AI-phrased when the key is present)

*Considered and skipped:* conversation intelligence (no recorded calls), partner relationship management (no channel partners), CPQ beyond planned quotations, email sequence automation (reps visit, not email), geo check-in / route planner / proof of delivery (third-party couriers deliver — no field-delivery ops to verify), trip manifests (same reason — couriers run their own routes)

## Workstream C — WMS (the Verna's-sheet replacement; migrate LAST)

### Stage 1 — read-side (done)
- ✅ FEFO pick lists with bin walk · packing slips · delivery receipts · shipment tracking · fulfillment queue

### Stage 2 — write-side (warehouse truth moves to the database)
- ✅ **Stock ledger in Supabase — CUTOVER-READY**: shadow ledger + opening-balance snapshot (super-admin freeze on the Cutover page, epoch-stamped, re-freezable) + stk() switch shipped (when ledger_is_truth is ON, stock everywhere = opening + post-epoch movements; counts are observations). Remaining: run the counts, get Verna's sign-off, flip.
- ✅ **Receiving against PO** — shipped (shared with ERP; batch/expiry at the door)
- ✅ **Cycle counts on iPad** — shipped (blind count sessions by scope, graded on close, variances write ledger adjustments; last-two-sessions evidence shows on the Cutover page)
- ✅ **Transfer orders** — shipped (draft → dispatch writes FEFO batch-stamped ledger movements, ref TR-n → delivered; in-transit units visible)
- ✅ **Barcode scanning in the browser** — shipped (Scan view; shadow ledger)
- ✅ **Pick confirmation** — shipped (FEFO batch-stamped; auto-fulfills the order)
- ✅ **Returns receiving** — shipped (restock CMs walk units back in: sellable → ledger, doubtful → quarantine)
- ✅ **Expiry quarantine & disposal log** — shipped (pull expiring/damaged/QA stock out of sellable + ATP; release or dispose with notes, who, when)
- ✅ **Stock reservations / ATP** — shipped (pending native orders ARE the reservation; order entry shows on-hand / promised / available-to-promise, blocks specialists from overselling, manager override with confirm; releases automatically on fulfill/cancel)
- ✅ **Backorder management** — shipped (ATP overrides recorded as backorders; panel on the fulfillment queue; auto-release + pings when a PO receive covers the shortfall)
- ✅ **Short-dated stock queue** — shipped (lots inside 6 months with ₱ at risk; plan + owner + target date per lot; unplanned value called out; closing records the outcome)
- ✅ **Receiving discrepancies & supplier scorecard** — shipped (fill rate, on-time vs ETA, real vs quoted lead time; closed-PO lines where received ≠ ordered, valued at cost)
- ▢ **Wave picking** — batch several orders into one FEFO warehouse pass
- ✅ **QA hold on receipt** — shipped (receiving offers sellable vs QA hold; held units release into the ledger as receives)
- ▢ **Courier tracking auto-pull** — LBC/Lalamove status APIs update dispatched/delivered automatically
- ✅ **Warehouse KPIs** — shipped (median/avg cycle time from the new fulfilled_at stamp, ≤48h share, fill rate vs backorders, queue age, units picked)
- ▢ **Multi-bin putaway rules** — several bins per SKU with putaway suggestions

## Workstream D — Platform & engineering (parallel track)

- ✅ **Close public endpoints** — shipped (session-verified server-side; JOB_KEY jobs; access codes removed)
- 🔨 **Modular restructure** — Phase 1 DONE: the single 15k-line file is split into `index.html` (shell/CSS) + 9 ordered script modules in `js/`, proven byte-identical on reassembly; zero build step, drag-drop deploys unchanged. Phase 2 (post-cutover): Vite proper — ES modules, per-view code splitting, minification, git-based deploys
- 🔨 **Supabase Pro** at cutover — checklist + restore drill documented in SUPABASE-SETUP.md (decided: staying on Supabase; plain-Postgres portability is the exit strategy). Remaining: Angelo upgrades + runs the drill
- ✅ Server-side pagination & filtering for the register — shipped (page-by-page queries with search on account/specialist/order no.; finance computations unchanged)
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
