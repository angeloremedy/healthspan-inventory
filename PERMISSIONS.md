# Healthspan HQ — Access Levels & Permissions Matrix

The one-page truth for who can do what. Roles marked **live** exist today;
**planned** roles reuse the same RLS pattern and ship when their people onboard.
Last updated: 2026-09-06.

## Roles & people

| Role | People | Status |
|---|---|---|
| **super admin** | Angelo only — everything below, plus Cutover switches and permanent user deletion (DB-enforced via `is_super`) | live |
| **admin** | Paul, Dr. April | live |
| **manager** (sales manager) | Marj | live |
| **sales** (product specialist) | Rhas, Tin, Rechel, Charmaine, Ruth, Joy, Jonathan, RJ + rest of PS team | live |
| **supply_chain** | Verna (+ Joemar) | live |
| **finance** | Alex, Tal, Sean | live |
| **marketing** | Maricris, Mench | live |
| **viewer** | Maria, Justine, Ivy, Agnes — meeting attendees: full circle READ, zero writes | live |

**Justine (IT) additionally holds `can_manage_ps`**: she can open Team & access
to **create and disable/enable product-specialist (sales) accounts only** — no
other roles, no role changes, no password resets, no deletion. Enforced
server-side in `admin-users.mjs`, not just hidden in the UI.

**System administration is reserved to Angelo alone** — Team & access, Cutover
switches, Supabase, Netlify, and keys. Paul and Dr. April hold admin for full
data visibility and operational control, not system administration.

**Viewer** (Maria, Justine, Ivy, Agnes): they attend the weekly meeting, so
they get the circle read — sales analytics, inventory suite, AR aging, accounts,
pipeline, campaigns, forecasts, Ask Healthspan. No writes of any kind; no PDC/returns/
POs/scan/audit; no costs or margins.

## The design: circle read, role write (decided 2026-08-27)

Everyone in the weekly meeting — Marj, Verna, Alex, Tal, Sean, Daz, Maricris,
Mench — forms one **trust circle**: they all get the same broad READ access
(sales analytics, inventory suite & simulators, AR aging, accounts, pipeline,
forecasts, campaigns), because the meeting already shares these numbers with
all of them. **Writes stay strictly role-scoped** per the matrix below.

Exceptions to circle read (stay restricted regardless):
- **Costs & margins** (item master cost column, margin %): admin + finance only.
  Supplier invoice totals, FX and landed cost on purchase orders follow the
  same rule (admin, finance, supply_chain) — the PO page no longer paints the
  AP block or the open-payables total for a sales manager (audit, 2026-09-08).
- **Review scorecard comments**: admin + manager only (DB-enforced).
- **Payments recording, user management, cutover**: per matrix / super admin.

In the matrix, read 👁 entries for supply_chain / finance / marketing are
therefore a floor — implementation grants the full circle read to all three.

## Feature matrix

✅ full · 👁 read-only · ✖ none

| Feature | admin | manager | sales (PS) | supply_chain | finance | marketing |
|---|---|---|---|---|---|---|
| Home (role-aware) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Order entry / edit own | ✅ | ✅ | ✅ own | ✖ | ✖ | ✖ |
| Orders register | ✅ | ✅ | own | 👁 + status | 👁 | 👁 |
| Fulfillment queue, pick lists, scan-to-pick | ✅ | ✅ | ✖ | ✅ | ✖ | ✖ |
| Scan (receive/pick/count), stock ledger | ✅ | ✖* | ✖ | ✅ | ✖ | ✖ |
| Purchase orders + receiving | ✅ | 👁* | ✖ | ✅ | 👁 (AP view) | ✖ |
| Batch recall trace | ✅ | ✅ | ✖ | ✅ | ✖ | 👁 |
| Shipment tracking, DRs | ✅ | ✅ | ✖ | ✅ | 👁 | ✖ |
| Inventory suite (dashboard, SKUs, batches, alerts, planning, simulators) | ✅ | ✅ | ✖ | ✅ | 👁 finance views | 👁 |
| Accounts (CRM) + profiles + contacts | ✅ | ✅ | own accounts | ✖ | 👁 | 👁 |
| Visit log, follow-ups | ✅ | ✅ | ✅ own | ✖ | ✖ | ✖ |
| Pipeline & opportunities | ✅ | ✅ | ✅ own | ✖ | ✖ | 👁 |
| Merges, parent/child, ownership | ✅ | ✅ | ✖ | ✖ | ✖ | ✖ |
| Sales analytics (overview, targets, specialists, coverage) | ✅ | ✅ | ✅ | ✖ | 👁 | 👁 |
| Leaderboard & pace, reorder-due | ✅ | ✅ | ✅ own | ✖ | ✖ | ✖ |
| Set targets, review scorecards | ✅ | ✅ | ✖ (sees own targets) | ✖ | ✖ | ✖ |
| AR aging, statements | ✅ | ✅ | ✖ | ✖ | ✅ | ✖ |
| PDC register | ✅ | 👁* | ✖ | ✖ | ✅ | ✖ |
| Payments recording | ✅ | ✖ | ✖ | ✖ | ✅ | ✖ |
| Returns & credit memos | ✅ | ✅ | ✖ | 👁 (restock) | ✅ | ✖ |
| Accounting export (VAT CSV) | ✅ | ✅ | ✖ | ✖ | ✅ | ✖ |
| Item master (prices, deals) — costs/margins hidden outside admin+finance | ✅ | 👁* no costs | ✖ | 👁 no costs | ✅ incl. costs | 👁 no costs |
| Campaign calendar | ✅ | ✅ | 👁 | 👁 | 👁 | ✅ |
| Forecasting suite, MAPE, AI planning review | ✅ | ✅ | ✖ | ✅ | 👁 | 👁 |
| Ask Healthspan (drawer and full page; saved chats are owner-only — no role, not even super admin, can read another person's) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Activity log (audit) | ✅ (admin + super ONLY — tightened 2026-08-28; RLS matched to it 2026-09-08) | ✖ | ✖ | ✖ | ✖ | ✖ |
| Approvals queue (credit/threshold holds) | ✅ decide | ✅ decide | auto-request | ✖ | 👁 | ✖ |
| Credit limits (set per account) | ✅ | 👁 | 👁 own accts | ✖ | ✅ | ✖ |
| Commissions (tiers, monthly compute, CSV) | ✅ | ✖ | ✖ | ✖ | ✅ | ✖ |
| Supplier bills / AP (terms, proforma, FX, payments on POs) | ✅ | ✖ (2026-09-08: the AP block and open-payables total were still painted for managers — closed) | ✖ | 👁 | ✅ | ✖ |
| Events calendar | ✅ | ✅ | ✅ own | ✅ | ✅ | ✅ |
| Quotations (create, send, convert to order) | ✅ | ✅ | ✅ own | 👁 | 👁 | 👁 |
| Promotions engine (configure promos) | ✅ | 👁 | auto-applied | 👁 | 👁 | ✅ |
| Product registrations (CPR/FDA per SKU) | ✅ | 👁 | ✖ | 👁 | ✅ (rides item master) | 👁 |
| Notifications (bell) | ✅ own+role | ✅ own+role | ✅ own | ✅ own+role | ✅ own+role | ✅ own+role |
| ATP / reservations at order entry | ✅ override | ✅ override | hard limit | 👁 | 👁 | ✖ |
| Cycle counts (start/close sessions) | ✅ | 👁 | ✖ | ✅ | ✖ | ✖ |
| Opening-balance freeze (Cutover) | super admin only | ✖ | ✖ | ✖ | ✖ | ✖ |
| Cash-flow forecast | ✅ | ✅ | ✖ | 👁 | ✅ | 👁 |
| Backup download (Cutover) | super admin only | ✖ | ✖ | ✖ | ✖ | ✖ |
| DR series config (Cutover) | super admin only | ✖ | ✖ | ✖ | ✖ | ✖ |
| DR number assignment (first print) | ✅ | ✅ | ✖ | ✅ | ✖ | ✖ |
| Communication log (Call/Viber on accounts) | ✅ | ✅ | ✅ own | ✖ | ✖ | ✖ |
| Backorders (cancel; auto-created on override) | ✅ | ✅ | ✖ | ✅ | 👁 | ✖ |
| Quarantine & disposal | ✅ | 👁 | ✖ | ✅ | ✅ add (returns) / 👁 | ✖ |
| Short-dated stock (set plan / close lot) | ✅ | ✅ | ✖ | ✅ | 👁 | ✅ |
| Receiving & supplier score (shows PO cost) | ✅ | ✖ | ✖ | ✅ | ✅ | ✖ |
| PO unit-cost column (on Purchase orders) | ✅ | ✖ | ✖ | ✅ | ✅ | ✖ |
| Favourites (own shortcuts, up to 10) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (every role) |
| With/without Remedy toggle | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ — a per-person view setting, not a permission; it changes nothing about what you may open |
| Targets & commissions population | external only | external only | external only | external only | external only | fixed, not a setting — the toggle does not reach these pages |
| Remove an attachment | own uploads | own uploads | ✅ | ✅ | ✅ | enforced server-side in upload.mjs, not by the browser |
| Serial numbers (view) | ✖ | ✅ | ✅ | ✅ | ✅ | sales work from accounts, not the equipment register |
| Serial numbers (add / mark sold / dispose) | ✖ | ✖ | ✅ | ✅ (supply chain) | ✅ | physical units are the warehouse's |
| Serial numbers — warranty end, holder, service / repair history (log, remove) | ✅ | 👁 history, no cost | ✅ | ✖ | ✅ | ✖ — RLS: supply_chain, admin, super write; everyone with the page reads. The `cost` on a service event is a cost: admin, finance, supply_chain see it; a manager sees the event without the figure |
| Saved reports (build, save, run, export CSV, schedule) | ✅ | ✅ | ✅ own rows only | ✅ | ✅ | ✅ — viewers ✖. Every source gates itself: stock/batches/sales/accounts/visits all six; HQ orders & lines not marketing; quotations admin/manager/sales/finance; payments + finance forms admin/finance; purchase orders (costs) admin/finance/supply_chain; serials admin/manager/supply_chain; loaners + sales. Cost columns stripped for non-cost roles in the preview AND the scheduled file; a schedule runs as its owner |
| Saved reports — edit / delete someone else's | ✅ | ✖ | ✖ | ✖ | ✖ | ✖ — shared reports are run/export-only for everyone but the owner and admin |
| Business review — automatic checkpoints (15th, month-end) | ✅ (taken by the app on open) | ✅ (same) | ✖ | ✖ | ✖ | ✖ — same RLS as Save snapshot; one row per month per checkpoint |
| Finance forms — receipts while filing (Add receipt / Add file) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ — anyone who can file; expense reimbursement and expense report require ≥ 1 receipt |
| Demo / loaners (view) | ✖ | ✅ | ✅ | ✅ | ✅ | |
| Demo / loaners (check out / return / convert) | ✖ | ✅ | ✅ | ✅ (supply chain) | ✅ | RLS: supply_chain, admin, manager, super |
| Release a pick wave | ✖ | ✅ | ✅ | ✅ (supply chain) | ✅ | same gate as fulfilment |
| CRM activity view | ✅ | ✅ | ✅ | ✅ | ✅ | every role incl. specialists — it is their own effort |
| Business review (open, read every section) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ — it is presented to the whole team anyway; it carries no cost or margin figure |
| Business review — manager commentary (wins, challenges, territory, plan, programs, plan notes) | ✅ | ✅ | 👁 | 👁 | 👁 | 👁 — RLS: admin, manager, super |
| Business review — a specialist's own commentary box | ✅ | ✅ | ✅ own only | ✖ | ✖ | ✖ — RLS compares the raw `profiles.specialist_tag` to the section, so the tag must be the canonical name (Tin, not Kristine) |
| Business review — Save snapshot / Export PowerPoint (full deck) | ✅ | ✅ | ✖ | ✖ | ✖ | ✖ — snapshots are insert-only history; super admin may delete one |
| Business review — a specialist's own boxes (wins, challenges, territory, activities, proposals) and forecast table | ✅ | ✅ | ✅ own only | ✖ | ✖ | ✖ — RLS on the tag segment of `ps:<Tag>:<section>` |
| Reports — team deck (PowerPoint / PDF), Download all | ✅ | ✅ | ✖ | ✖ | ✖ | ✖ |
| Reports — a specialist's own deck (PowerPoint / PDF) | ✅ all | ✅ all | ✅ own only | ✖ | ✖ | ✖ — the Inputs column shows whose commentary is in before download |
| Settings — appearance, password, sign out, shortcuts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (every role) |
| Settings — see AI provider + test connection | ✅ | ✅ | ✖ | ✖ | ✖ | ✖ |
| Settings — change AI provider | super admin only | ✖ | ✖ | ✖ | ✖ | ✖ — app_settings is super-only |
| Approval routes (edit in place) | ✅ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Reports — Google Slides (upload + share) | ✅ | ✅ | ✅ own deck | ✖ | ✖ | ✖ — server checks role / own tag; the clicker's email is always on the share |
| Business review — Mixexpert list (tag accounts as source = Mixexpert) | ✅ | ✅ | ✖ | ✖ | ✖ | ✖ |
| Reports — Copy for Notion (Sales block) | ✅ | ✅ | ✖ | ✖ | 👁 copy | 👁 copy | figures only, no costs |
| Reports — Copy for Notion (Supply chain block) | ✅ | ✅ | ✖ | ✅ | ✖ | ✖ | inventory at Healthspan price, not cost |
| Team & access — Order (presenting order) on a specialist | ✅ | ✖ | ✖ | ✖ | ✖ | ✖ — same gate as Team |
| Team & access — Team field on a specialist | ✅ | ✖ | ✖ | ✖ | ✖ | ✖ — via admin-users.mjs, same gate as editing a user |
| Business review — Draft with AI | ✅ | ✅ | own box | ✖ | ✖ | ✖ — same gate as editing the box; goes through the existing Ask AI job with the report figures as its data |
| Expense report (file one) | ✅ | ✅ | ✅ | ✅ | ✅ | any signed-in user; the approval route is the control, same as all finance forms |
| My profile | ✅ | ✅ | ✅ | ✅ | ✅ | everyone — it only ever shows your own items |
| Account documents (view / add) | ✅ | ✅ | ✅ | ✅ | ✅ | 👁 |
| Visit photos (on your own visit) | ✅ | ✅ | ✅ | ✅ | ✅ | ✖ | everyone may open a visit's files; only its owner attaches |
| Pull-out request (file one) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (viewer/IT too — `viewAllowed` returns true for every role by rule) |
| Pull-out approve / reject | mapped fund-source approver or backup only, **regardless of role** (super admin as fallback) | — | — | — | — | — |
| Pull-out fund-source spend + QBO export | ✅ | ✖ | ✖ | ✖ | ✅ | ✖ |
| Pull-out release (writes the ledger) | ✅ | ✖ | ✖ | ✅ | ✖ | ✖ |
| Pull-out mark booked | ✅ | ✅ | ✅ | ✅ | ✖ | ✖ |
| File any finance form | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (viewer/IT too) |
| See a finance request | own + ones you decide | own + decide | own | own | ✅ all | own + decide |
| Approve a finance step | only if the route names you (never your own request) | — | — | — | — | — |
| Mark a request settled | ✅ | ✖ | ✖ | ✖ | ✅ | ✖ |
| Option lists (event codes, cash-flow tags…) | ✅ | ✖ | ✖ | ✖ | ✅ | ✖ |
| Approval routes | ✅ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Fund-source approver mapping | ✅ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Eligible to BE a fund-source approver | ✅ | ✅ | ✖ (product specialists excluded) | ✅ | ✅ | ✅ |
| Delete any record (archives it) | super admin only | ✖ | ✖ | ✖ | ✖ | ✖ |
| Archive: restore / purge | super admin only | ✖ | ✖ | ✖ | ✖ | ✖ |
| Document numbering (prefix, padding, series start) | super admin only | ✖ | ✖ | ✖ | ✖ | ✖ |
| Period close (set closed-through date) | super admin only | ✖ | ✖ | ✖ | ✖ | ✖ |
| Record a payment (dated, append-only) | ✅ | ✖ | ✖ | ✖ | ✅ | ✖ |
| Collections CSV (dated payments in a period) | ✅ | ✅ | ✖ | ✖ | ✅ | ✖ |
| Freeze month-end valuation | ✅ | ✖ | ✖ | ✖ | ✅ | ✖ |
| Re-freeze a month already snapshotted | super admin only | ✖ | ✖ | ✖ | ✖ | ✖ |
| Purchase threshold (set) | super admin only | ✖ | ✖ | ✖ | ✖ | ✖ |
| PO approval decision | ✅ | ✖ | ✖ | ✖ | ✖ | ✖ |
| Credit memo: date + specialist + Shopify-refunded flag | ✅ | ✖ | ✖ | ✖ | ✅ | ✖ |
| Warehouse KPIs | ✅ | 👁 | ✖ | ✅ | 👁 | 👁 |
| Complaints log | ✅ manage | ✅ manage | ✅ file | ✅ manage | 👁 | 👁 |
| My manual download | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (all roles incl. viewer/IT) |
| Suppliers & imports | ✅ | 👁 | ✖ | ✅ | ✅ | ✖ |
| Transfer orders | ✅ | ✅ | ✖ | ✅ | 👁 | ✖ |
| Landed cost & valuation (COSTS page) | ✅ | ✖ | ✖ | ✖ | ✅ | ✖ |
| Ask Healthspan (context auto-scoped to role) | ✅ full | ✅ no costs | ✅ own scope | ✅ ops scope | ✅ incl. costs | ✅ circle scope |
| QuickBooks sync page (view, confirm matches, retry, sync now) | ✅ | ✖ | ✖ | ✖ | ✅ | ✖ — view key `qbo`; viewer has no access either. `viewAllowed` and `qbo-admin.mjs` agree |
| QuickBooks connect / settings / enable | super admin only | ✖ | ✖ | ✖ | 👁 settings | ✖ — Connect, Disconnect, Save settings and Enable/Disable are refused server-side in `qbo-auth.mjs` and `qbo-admin.mjs` (`settings`) for anyone else; admin and finance see the settings read-only |

**View-only clarity (2026-08-28):** every read-only view shows a banner naming
who edits it (from the VIEW_WRITERS map — admin/super never named, that's a
given); the same map puts 👁 VIEW badges on home cards. Approvals is now
finance-readable (decisions stay with managers). Sample/FOC budgets: decided
against.

**Sidebar policy (2026-08-28):** the sidebar and mobile menu are generated from
the SAME `viewAllowed()` function that guards navigation — a role only ever
sees menu items it can actually open. No second list to drift.

**Notification policy (2026-08-28):** the bell pings only whoever ACTS —
approvals & anomalies → managers; backorders, complaints & new orders →
supply chain; collections → finance + account owner; decisions/fulfillments →
the requesting specialist; team digest → managers. Admins are not copied on
everyone else's action items — the queues themselves are always visible in-app.
| Team & access (users) | ✅ | ✖ | ✖ | ✖ | ✖ | ✖ (Justine: PS accounts only) |
| Cutover switches | ✅ | ✖ | ✖ | ✖ | ✖ | ✖ |

### Manager tightening (decided 2026-08-27)

IMPLEMENTED 2026-08-27 with the roles rollout: managers dropped to the values
shown — item master and PDC read-only, POs read-only, scan/ledger removed.
Managers do NOT see costs or margins — cost visibility is admin + finance only.
(They keep fulfillment oversight: queue, pick lists, scan-to-pick, confirm.)

### Finance forward-ownership (decided 2026-08-27)

SHIPPED 2026-08-27, owned by **finance** (not managers) as decided:
**commissions** (finance edits tiers + exports the payroll CSV), **credit
limits** (finance sets limits; over-limit orders hold for manager approval),
**supplier bills / AP** (terms, proforma refs, FX balances on POs — completes
their weekly Inventory AP table). Approval *decisions* sit with managers/admin
since they're order sign-offs. The **approval threshold** flag is super-admin
only. The **Events calendar** ships to everyone (marketing's Calendar of
Events + sales' own visit plans in one grid).

## Principles

1. **DB-enforced, not menu-hidden**: every ✖ that matters is an RLS policy,
   not a hidden button. Review comments, payments, user management, and the
   append-only ledgers are the strictest.
2. **Specialists see themselves**: own orders, own accounts (via ownership),
   own targets, own pipeline cards. Enforced by `specialist_tag` in RLS.
3. **Meeting attendees all see the meeting's numbers**: the viewer role gives
   support staff the same live figures the weekly meeting shares — nothing more.
4. Every mutation is audited regardless of role.

## What stays outside HQ (by design)

Bank/treasury balances, disbursement approvals (RTPs), supplier bill payments,
BIR filings, payroll → QBO + bank portals (finance reports these from there).
Website/social analytics → GA/Meta (Maria's tools).


## 2026-09-08 audit — what changed in the enforcement

- **Deep links** (`#/a/`, `#/o/`, `#/s/`, `#/p/`, `#/d/`, `#/m/`, `#/w/`) now run
  through `viewAllowed` like the sidebar; a specialist may deep-link only their own
  specialist page. Viewer and marketing can no longer reach AR statements, delivery
  receipts, pick slips, wave picks or credit memos by URL; supply chain not the
  statements or the reconciliation page. A specialist's `sales*` pages are an
  explicit list (no `salesrecon`).
- **Before the profile resolves** nobody is anybody: only Home, Settings, My
  profile and the manual open. A failed profile read means `viewer`, not `sales`.
- **Tables** `accounts`, `opportunities`, `account_contacts`: writes were open to
  every authenticated account (day-one policies); now role-scoped via
  `public.hs_role()`. `audit_log` read: admin + super only in RLS, not just the UI.
- **Functions**: every background job refuses to run without `JOB_KEY` (was
  "unset = open"); Ask and Slack workers require it; the Slack worker only posts to
  `hooks.slack.com`; the question log is worker-write / admin-read; sync, Shopify
  and visits fail closed when the Supabase env is missing; an admin cannot reset
  another admin's password (super admin only); attachment downloads are authorised
  by RLS as the caller; deck sharing reaches HQ accounts or the company domain only.
- **Notifications**: `link` must be an in-app route (DB check + validated and
  JS-quoted in the renderer). `esc()` escapes the single quote.
- **Backups** now include the sixteen tables that had grown up outside them
  (never `qbo_tokens`).
