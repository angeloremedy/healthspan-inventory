# Healthspan HQ — Access Levels & Permissions Matrix

The one-page truth for who can do what. Roles marked **live** exist today;
**planned** roles reuse the same RLS pattern and ship when their people onboard.
Last updated: 2026-08-28.

## Roles & people

| Role | People | Status |
|---|---|---|
| **super admin** | Angelo only — everything below, plus Cutover switches and permanent user deletion (DB-enforced via `is_super`) | live |
| **admin** | Paul, Dr. April | live |
| **manager** (sales manager) | Jojo, Marj | live |
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
pipeline, campaigns, forecasts, Ask AI. No writes of any kind; no PDC/returns/
POs/scan/audit; no costs or margins.

## The design: circle read, role write (decided 2026-08-27)

Everyone in the weekly meeting — Jojo, Marj, Verna, Alex, Tal, Sean, Maricris,
Mench — forms one **trust circle**: they all get the same broad READ access
(sales analytics, inventory suite & simulators, AR aging, accounts, pipeline,
forecasts, campaigns), because the meeting already shares these numbers with
all of them. **Writes stay strictly role-scoped** per the matrix below.

Exceptions to circle read (stay restricted regardless):
- **Costs & margins** (item master cost column, margin %): admin + finance only.
  Note: the weekly AP table already exposes supplier invoice totals to the room —
  per-SKU cost/margin stays out of HQ's circle read regardless; meeting-side
  sharing is Paul's call.
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
| Ask AI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Activity log (audit) | ✅ | ✅ | ✖ | ✖ | 👁 | ✖ |
| Approvals queue (credit/threshold holds) | ✅ decide | ✅ decide | auto-request | ✖ | 👁 | ✖ |
| Credit limits (set per account) | ✅ | 👁 | 👁 own accts | ✖ | ✅ | ✖ |
| Commissions (tiers, monthly compute, CSV) | ✅ | ✖ | ✖ | ✖ | ✅ | ✖ |
| Supplier bills / AP (terms, proforma, FX, payments on POs) | ✅ | 👁 | ✖ | 👁 | ✅ | ✖ |
| Events calendar | ✅ | ✅ | ✅ own | ✅ | ✅ | ✅ |
| Quotations (create, send, convert to order) | ✅ | ✅ | ✅ own | ✖ | 👁 | 👁 |
| Promotions engine (configure promos) | ✅ | 👁 | auto-applied | 👁 | 👁 | ✅ |
| Product registrations (CPR/FDA per SKU) | ✅ | 👁 | ✖ | 👁 | ✅ (rides item master) | 👁 |
| Notifications (bell) | ✅ own+role | ✅ own+role | ✅ own | ✅ own+role | ✅ own+role | ✅ own+role |
| ATP / reservations at order entry | ✅ override | ✅ override | hard limit | 👁 | 👁 | ✖ |
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
