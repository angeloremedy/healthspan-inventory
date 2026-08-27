# Healthspan Platform — User Guide

The all-in-one system for Healthspan: inventory, sales analytics, CRM, order-taking,
receivables, and fulfillment. Live at **https://hq.healthspan.ph** — on a phone
or iPad, use *Add to Home Screen* to install it as an app.

This guide explains how to *use* the app. For how it's *built*, see
[ARCHITECTURE.md](ARCHITECTURE.md). For the plan, see [ROADMAP.md](ROADMAP.md)
(the living copy is on Notion).

---

## 1. Signing in

Open the site and sign in with your Healthspan email and password.

- **Remember me** checked = you stay signed in on that device. Unchecked = signed
  out when the browser closes (use this on shared computers).
- Change your password any time: bottom of the sidebar → **password** (mobile:
  from your profile page).
- Forgot your password? Ask an admin — they can set a new one for you in
  **Team & access**.

### Access levels

| Role | What they see |
|---|---|
| **Super admin** | Everything + Cutover switches + permanent user deletion. One account, protected — no other admin can touch it. |
| **Admin** | Everything operational, plus Team & access, order trash, payment recording. |
| **Sales manager** | Whole team's data, all accounts, merges, targets, scorecards, approvals. No costs/margins, no user management. |
| **Product specialist** | Their own page, orders, quotes, visits, follow-ups, pipeline, and the sales views — locked to their own name by the database. |
| **Supply chain** | Warehouse suite: fulfillment, scan, ledger, POs + receiving, recall — plus the weekly-meeting numbers. |
| **Finance** | AR, payments, PDCs, returns, exports, costs/margins, commissions, credit limits, supplier AP — plus the circle read. |
| **Marketing** | Campaigns, promotions, events calendar, pipeline + analytics read. |
| **Viewer** | The weekly-meeting numbers, read-only. |
| **IT** | Viewer, plus Team & access limited to creating and disabling product-specialist accounts. |

Full matrix: [PERMISSIONS.md](PERMISSIONS.md).

Everyone lands on the **Home page** — a launcher with the tools for their role.

---

## 2. Home page

Big cards for what you use most, grouped by area. Tap any card to jump there.
On the phone the bottom bar mirrors the essentials (Home is the first tab).

---

## 3. For product specialists

### Your page ("My page")
Your numbers in one place: monthly sales vs your target (chart), coverage, your
accounts, visit history, open follow-ups, and your **calendar** — planned and
logged visits and orders by month. Managers and admins can see everyone's page;
you see yours.

### Taking an order (~1 minute)
1. **New order** (Home card, sidebar, or the **+ New order** button on an
   account's profile page — that pre-fills the customer).
2. Start typing the account name and pick it. If the account owes money you'll
   see a credit note — check with your manager before promising delivery.
3. Add products: start typing, pick, set quantity. Deals (e.g. 5+1) add the
   free line automatically. Use **FOC** for true giveaways.
4. Submit. The order gets an HS-number and appears instantly in the register
   and the fulfillment queue.

Your name is fixed as the specialist — you can only order under yourself.

### Logging a visit (~10 seconds, right after the call)
**Log visit** → account → outcome → optional note → save. Set a **future date**
to plan a visit instead (it shows on your calendar and in Follow-ups & plans).

### Follow-ups & plans
Your to-do queue: follow-ups created from visit outcomes plus planned visits.
Overdue items are flagged red. Tick things done as you go. Managers see the
whole team's queue.

---

## 4. Accounts (CRM)

One row per customer, merged automatically across Verna's OUT sheet (shipments),
Shopify (bookings), and the visit log. Tap any row for the **full profile page**:
booked / shipped / momentum / visits cards, a merged timeline (orders are
clickable), what they buy, contact details (edit via the **Edit** button),
branches, and shortcut buttons for a new order or visit.

### Tabs
- **All accounts** — everything, sorted by value.
- **Prospects** — accounts that booked on Shopify but never appear in the OUT
  sheet, split into: *likely name mismatches* (the ≈ column suggests the
  existing account it probably matches), *active real prospects* (ordered in
  the last 12 months — reactivation targets), and *lapsed* one-time buyers.
  **Export CSV** hands the list to the team.
- **Growing / Declining / Dormant** — momentum screens.
- **Vs Shopify** — booked vs shipped reconciliation per account.

### Merging duplicates (admin & sales manager)
Same customer under two spellings? Open the *wrong/duplicate* account →
**⇢ Merge into…** → type the real account's name → confirm. All its orders,
shipments, and visits now show under the real account. The target page lists
everything merged into it, each with an **unmerge** link. From the Prospects
tab you can merge in one click via **merge →** next to the ≈ suggestion.

> Rule of thumb: open both pages side by side before merging. Merges are
> reversible, but check first.

### Parent / child grouping (admin & sales manager)
A clinic that belongs to a group? Open the child → **⌂ Set parent…** → name the
parent. The child stays its own account but rolls up into the parent's totals
and branch chips. "Branch of X · unlink" on the child page undoes it.
(Accounts named "X - Branch" group automatically when X exists.)

---

## 5. Orders

The all-time register: every order ever (native HS orders + the full Shopify
history), searchable, paginated (50/100/250 per page). Tap an order for its
full page — lines, status, payment panel.

- **Statuses**: pending → fulfilled, or cancelled. Admin can fulfill /
  unfulfill / cancel / reopen from the order page.
- **Payment panel** (native orders): paid, balance, terms. Admin records
  payments here.
- **Trash** (admin): deleting asks for confirmation, moves the order to the
  recycle bin; restore anytime; **Empty trash** permanently removes
  (double-confirmed).

## 6. Fulfillment (Verna / admin)

**Fulfillment queue** = every pending order, oldest first, age-flagged. Open an
order → **Pick list**: the exact batch and bin to pull for every line (FEFO —
earliest expiry first), printable, doubles as the packing slip / delivery
receipt. Mark fulfilled when it ships.

## 7. Money

- **AR aging** (Finance): who owes what, bucketed current / 30 / 60 / 90+ days
  past terms. Terms come from order notes (e.g. "PDC 30 days"). Partial
  payments show a remaining balance. Admin records payments; re-running the
  Shopify sync also refreshes payment statuses for imported orders.
- Credit warnings appear automatically in order entry when the chosen account
  has overdue balances.

## 8. Sales analytics (managers, admins)

- **Sales overview** — units/value, deals vs à-la-carte vs free split, any
  period (today → 12 months → custom).
- **Vs target** — monthly attainment by total / line / product / specialist.
- **Specialists** — per-PS performance with drill-downs.
- **Field coverage** — contacts/day, accounts reached vs universe, the
  not-reached list sorted by value.
- **Vs accounting** — live reconciliation against the official Sales Report
  sheet.

Conventions baked in everywhere: deal +1s count as deal units (not free);
"free" = ₱0 outside a deal; pull-outs and TEST orders are excluded from sales
(kept in finance/logistics views).

## 9. Inventory (the original dashboard)

Dashboard, action center, all SKUs, alerts (out/low/negative stock, expiry,
reorder), planning suite (forecasts, coverage, reorder points, ABC, Monte
Carlo…), simulators, batch/FEFO view, data health, finance and logistics
views. Synced from Verna's master Google Sheet every 15 minutes; every view
has a plain-language description, a "how is this calculated" section, and CSV
export.

## 9.1 Quotations

**Sales & CRM → Quotations.** Build a formal quote exactly like an order (same
catalog prices, deals, live promos), set a validity date, print it for the
clinic, then track it: draft → sent → accepted or lost (with a reason — win
rate shows on the view). One tap converts an accepted quote into a prefilled
order. Specialists see their own quotes.

## 9.2 Promotions (marketing + admin)

**Promotions** = deals as configuration. Define a name, a start/end window, the
eligible SKUs (or `*` for all), and a mechanic — *buy N get M free* or *% off*.
While the promo is live, order entry and quotations apply it automatically and
tag the lines with the promo name. Turn promos off or delete them anytime.

## 9.3 Product registrations (compliance)

**Inventory → Product registrations.** CPR/FDA registration number and expiry
per SKU. Expired and expiring-within-6-months float to the top with red/amber
flags so renewals start early. Editing rides item-master permissions.

## 9.4 Approvals, credit limits & commissions

Over-limit or over-threshold specialist orders **hold automatically** and land
in **Approvals**, where managers/admins approve or reject. Finance sets credit
limits on account pages and owns **Commissions** (tiered %-of-target, CSV for
payroll) and **supplier AP** on purchase orders. The events calendar merges
campaigns, planned visits, and demos into one month grid.

## 9.5 Notifications & available-to-promise

The bell in the top bar pings you when the machine needs you: a held order
pings managers, the decision pings the specialist, an approved order pings the
warehouse, and a fulfillment pings whoever took the order. Tap any ping to jump
straight to the right view. And at order entry, every product shows *on hand ·
promised · available to promise* — a submitted order commits its stock, so two
orders can never promise the same units. Specialists are held to the limit;
managers can override with a confirmation.

## 9.55 Order paper & the register

Delivery receipts carry a permanent, BIR-friendly **DR number** from a
configurable series (assigned the first time a DR is printed; the order keeps
it forever). The orders register is served page-by-page with a search box —
account, specialist, or order number. Account pages also have **Call / Viber**
quick-log buttons: a phone touch counts like a visit for the timeline,
coverage, and the going-quiet alert. And an accepted quotation now moves the
account's pipeline automatically — opportunity won, stage active; a lost quote
records the reason.

## 9.6 The machine works nights

At 2am the system syncs Shopify, rebuilds the sales cache, exports a full
backup, and runs the automation rules: a fulfilled order becomes a follow-up
task two weeks later, a first order becomes a welcome call, a balance past 60
days pings finance and the account owner, a quiet account alerts its owner,
and a campaign launch pings the field. Monday mornings, every specialist gets
their week in one ping — booked, orders, visits, open follow-ups — and
managers get the team version. Unusual orders (3× an account's usual
size, or deep discounts) ping managers the moment they're submitted. Finance
also gets a **Cash-flow forecast** — expected collections week by week from
payment terms and cheque maturities.

## 9.7 The warehouse, hardened

ATP overrides become **backorders** that sit on the fulfillment queue and
auto-release (with pings) the moment a PO receive covers them. Returned units
walk back into stock — sellable straight to the ledger, doubtful into
**Quarantine & disposal**, the compliance trail where expiring, damaged, and
QA-hold stock waits (out of ATP) for release or a documented disposal.
**Warehouse KPIs** score the operation: cycle time, ≤48h share, fill rate,
queue age. And the **Complaints log** takes quality reports from the field
with the batch on record — one tap into the recall trace.

## 9.8 Your manual, in-app

Sidebar → **manual** (mobile: Menu → My manual) opens the user manual for YOUR
role right inside the app — read it there, download it, or pop it full screen.
Served through a session check, so each person gets exactly their own book.
Read-only pages say so: a banner names who actually edits them, and view-only
cards on Home carry a 👁 badge.

## 9.85 Rhythm, nudges & transfers

Dormancy alerts follow the account's tier — an A-clinic going 30 days quiet
pings its owner; C-tier gets 60. Monday mornings each specialist also gets
**their 3 best calls this week** — the highest-value accounts drifting past
their rhythm. And Remedy branch shipments are now **transfer orders**: proper
documents that write FEFO batch-stamped ledger movements on dispatch and show
what's in transit.

## 9.9 Buying side: suppliers, imports & true margins

**Suppliers & imports** (Logistics) holds the supplier master — currencies,
payment terms, lead times — plus every PO on the water with ETD, ETA, and
customs status. Receiving now offers a **QA hold** (units wait in quarantine
until inspection releases them as sellable). And **Landed cost & valuation**
(Finance; admin + finance only) turns PO costs × payment FX + landed charges
into real unit costs — true margins per product and inventory value at cost.

## 10. Team & access (admin only)

Sidebar → Admin → **Team & access**. Create accounts (name, email, starter
password, role, specialist tag), edit roles/tags, reset passwords, and
disable/enable accounts — no Supabase console needed. Disabling blocks sign-in
immediately but keeps all their data; re-enable anytime. You can't disable
yourself, nobody can touch the super admin account, and only the super admin
can permanently delete a login. IT (`can_manage_ps`) sees this page too, but
only to create and disable/enable product-specialist accounts. Send starter
passwords privately; people change them in-app.

## 11. Odds and ends

- **Themes**: sidebar theme selector — *Healthspan* (brand) or *Classic*
  (+dark mode).
- **URLs**: every page has a real URL — bookmark accounts, orders, pick lists;
  the browser back button works.
- **Mobile/iPad**: role-aware bottom navigation; everything works on a phone.
- **Ask AI**: in-app chat over EVERYTHING HQ knows — inventory, sales, AR,
  cheques, approvals, backorders, quotes, pipeline — automatically scoped to
  your role (specialists get their own numbers; costs only answer for finance
  and admin).
- **Something looks wrong?** Check **Data health** first (feed freshness and
  reconciliation), then tell Angelo.
