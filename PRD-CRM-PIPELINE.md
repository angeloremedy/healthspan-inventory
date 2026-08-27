# PRD — CRM Pipeline Module: Contacts, Leads, Opportunities & Ownership

| | |
|---|---|
| **Product** | Healthspan Platform (healthspan-inventory.netlify.app) |
| **Module** | CRM pipeline — the last pieces of the Zoho replacement |
| **Author** | Angelo Mojica + Claude · **Date** 2026-08-26 · **Status** Draft for review |
| **Related docs** | ROADMAP.md · ARCHITECTURE.md · SUPABASE-SETUP.md |

## 1. Problem

The platform already handles the *transactional* CRM: unified accounts, visit
logging, follow-ups, statements, health scores, upsell recommendations. What it
does not yet model is the *funnel* — the journey from "clinic we've heard of"
to "active buying account", who owns that journey, and where each pursuit
stands. Today that lives in specialists' heads and Viber threads. Zoho cannot
be switched off until this module exists (see the Zoho cutover criteria in
ROADMAP.md).

## 2. Goals

1. Every account has an **owner** (a specialist) — coverage, follow-ups,
   commissions, and the leaderboard follow ownership.
2. Every prospect moves through a visible **pipeline** with stages, values, and
   win/loss reasons — Jojo can answer "what's coming this month and who's on it"
   from one screen.
3. **Contacts** (shipped 2026-08) are first-class: multiple people per account
   with roles and numbers.
4. Nothing new to learn for specialists: leads are worked through the same
   visit log and follow-ups queue they already use.

**Non-goals:** email sequence automation (reps visit, they don't email);
marketing campaign attribution; web-to-lead forms (until the public site sends
inquiries); CPQ beyond the planned quotations feature.

## 3. Users

| Persona | Needs |
|---|---|
| Product specialist (14) | See *my* accounts and *my* open pursuits; log activity fast on iPad; know what's next per account |
| Sales manager (Jojo, Marj) | Whole-team pipeline view; reassign ownership; conversion rates; stalled-deal alerts |
| Admin (Angelo, Paul) | Same as manager + configuration; pipeline value feeding revenue projections |

## 4. Current state (what this builds on)

- `accounts` table + unified in-browser index (sheet ∪ Shopify ∪ visit log), merge/branch links
- **Prospects tab**: 500+ Shopify-only/visit-log-only accounts, fuzzy-matched, exportable — this is the raw lead pool
- `account_contacts` — shipped
- Visits with outcomes, products endorsed (bida), planned visits, follow-ups queue
- Health score, upsell recs, reorder gaps — signals a pipeline can consume
- Roles: admin / manager / sales with RLS enforcement; audit log

## 5. Feature requirements

### 5.1 Account ownership (build first — everything hangs off it)

- `owner_tag` on accounts (nullable text = specialist tag). Unowned = house account.
- Set/change owner: admin & manager only, from the account page; bulk-assign
  from the Accounts list (filter → assign). Every change audited.
- "My accounts" filter for specialists across Accounts, Follow-ups, and
  reorder-due alerts (when built).
- Coverage metrics (Field coverage view) gain an "owned universe" denominator.
- **Acceptance:** a specialist opens Accounts and sees an accurate "Mine" list;
  reassignment reflects everywhere within one reload; audit shows who moved what.

### 5.2 Leads view

A *lead* is an account-shaped record that hasn't bought yet (or lapsed >12
months). No separate table — a `stage` field on accounts keeps the CRM unified
(one page per clinic forever, no lead→account conversion data loss).

- `stage`: `lead` → `contacted` → `qualified` → `active` (auto once first order
  lands) → plus `lost` (with `lost_reason`) and `dormant` (auto, no activity 12mo).
- **Leads view** (new, Sales & CRM group): Kanban-style columns by stage, cards
  show name, owner, health/last activity, next planned visit; drag or tap-to-move
  between stages (tap-to-move on iPad). List fallback on small screens.
- Seeding: the Prospects tab gets "→ add to pipeline" per row (sets stage,
  optional owner) — turns the 513-list cleanup into funnel building.
- New accounts created via order entry / visit log auto-enter as `lead`
  (or `active` if the first touch is an order).
- Stage changes: owner, manager, or admin; all audited with timestamps so
  stage-age ("in *contacted* for 34 days") is computable.
- **Acceptance:** Jojo sees every open lead by stage and owner; stage history
  survives; a lead that orders flips to `active` automatically.

### 5.3 Opportunities

For deals bigger than a routine reorder (machine sales, first big stocking
order, clinic-chain rollouts):

- `opportunities` table: account, title, owner_tag, est. value (₱), expected
  close month, stage (`open` → `won`/`lost` + reason), notes, created/updated.
- Shown on the account page (open opportunities panel) and in a **Pipeline**
  section at the top of the Leads view: total open value, weighted value
  (stage-based %), expected this month/next.
- Won → prompt to link the resulting order(s). Lost → reason required
  (price, competitor, timing, no budget, other).
- Feeds pace forecasting later: projected month-end = booked pace + weighted
  pipeline closing this month (phase 2 of this module).
- **Acceptance:** manager sees open pipeline value by specialist and month;
  win rate and loss reasons are queryable; an opportunity's history is audited.

### 5.4 Activity integration (no new habits)

- Logging a visit against a `lead`/`contacted` account offers a stage bump
  ("Move to qualified?") when the outcome warrants.
- Follow-ups queue groups by stage; overdue lead follow-ups float up.
- Weekly digest (roadmap) includes pipeline movement per specialist.

## 6. Data model & security

```sql
alter table accounts add column owner_tag text;          -- specialist tag
alter table accounts add column stage text default 'active'
  check (stage in ('lead','contacted','qualified','active','dormant','lost'));
alter table accounts add column stage_since timestamptz;
alter table accounts add column lost_reason text;

create table opportunities (
  id bigint generated always as identity primary key,
  acct_key text not null, account text not null,
  title text not null, owner_tag text,
  est_value bigint, expected_month text,     -- 'YYYY-MM'
  stage text not null default 'open' check (stage in ('open','won','lost')),
  lost_reason text, notes text,
  created_by uuid references auth.users,
  created_at timestamptz default now(), updated_at timestamptz
);
```

RLS: reads authenticated. Ownership + stage writes: admin/manager, plus the
owning specialist for stage moves on their own accounts. Opportunities: insert
by any signed-in user for owned accounts; admin/manager anywhere. All mutations
call `audit()` — no exceptions (standing convention).

## 7. UX notes

- Leads view lives beside Accounts in the Sales & CRM nav group; specialists see
  their own cards, managers see all with an owner filter.
- Stage pill on account pages and in the Accounts list (replacing the current
  binary "prospect" pill).
- Mobile: list-first; stage move via a tap menu, not drag.

## 8. Rollout

1. **Phase A:** ownership column + bulk assign + "Mine" filters. Assign the
   existing 800 accounts with Jojo/Marj in one working session (bulk tool).
2. **Phase B:** stages + Leads view + Prospects "add to pipeline". Backfill:
   accounts with orders → `active`; visit-log-only → `contacted`; Shopify-only
   lapsed → `dormant`.
3. **Phase C:** opportunities + pipeline value + win/loss reporting.
4. Zoho parallel run for one month → export Zoho archive → cancel (cutover
   criteria in ROADMAP.md).

## 9. Success metrics

- 100% of active accounts owned within 2 weeks of Phase A.
- ≥80% of new accounts enter via the pipeline (not straight to first order) by
  month 2 of Phase B.
- Manager can produce "pipeline value closing this month per specialist"
  without asking anyone.
- Zoho cancelled.

## 10. Open questions

1. Stage-weighting percentages for the weighted pipeline (suggest 25/50/75%
   for lead/contacted/qualified until we have win-rate history).
2. Should ownership drive commission splits when territory transfers happen
   mid-deal? (Decide with the commissions feature.)
3. Do machine/equipment deals need their own opportunity type with demo
   scheduling? (Ask the team after Phase C ships.)
