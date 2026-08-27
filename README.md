# Healthspan Platform — User Guide

The all-in-one system for Healthspan: inventory, sales analytics, CRM, order-taking,
receivables, and fulfillment. Live at **https://healthspan-inventory.netlify.app**.

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

| Role | Who | What they see |
|---|---|---|
| **Product specialist** (`sales`) | The PS team | Their own page, orders, visits, follow-ups, and the sales views. Orders and visits are locked to their own name — the database enforces it. |
| **Sales manager** (`manager`) | Jojo, Marj | Everything except user management. Whole team's data, all accounts, can merge accounts and set parent/child groupings. |
| **Admin** | Angelo, Paul | Everything, plus Team & access, order delete/trash, payment recording. |

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

## 10. Team & access (admin only)

Sidebar → Admin → **Team & access**. Create accounts (name, email, starter
password, role, specialist tag), edit roles/tags, reset passwords, and
disable/enable accounts — no Supabase console needed. Disabling blocks sign-in
immediately but keeps all their data; re-enable anytime. You can't disable
yourself. Send starter passwords privately; people change them in-app.

## 11. Odds and ends

- **Themes**: sidebar theme selector — *Healthspan* (brand) or *Classic*
  (+dark mode).
- **URLs**: every page has a real URL — bookmark accounts, orders, pick lists;
  the browser back button works.
- **Mobile/iPad**: role-aware bottom navigation; everything works on a phone.
- **Ask AI**: in-app chat that answers questions over live inventory and sales.
- **Something looks wrong?** Check **Data health** first (feed freshness and
  reconciliation), then tell Angelo.
