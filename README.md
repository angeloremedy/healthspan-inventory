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

## 9.8 Working the gaps: short-dated stock and supplier truth

The expiry tracker says what is running out of shelf life; **Short-dated
stock** (Logistics) says what we are doing about it. Every lot with units on
hand expiring within six months appears worst-first with the peso value at
risk. Each lot takes a plan — discount, FOC to a loyal account, transfer to a
Remedy branch, quarantine, or accept the write-off — with an owner, a target
date, and a note. Lots with no plan are flagged and totalled separately: that
figure is money nobody has decided about. Closing a lot records the outcome,
so the page doubles as the record of what was recovered. Choosing the
quarantine plan offers to pull the units out of sellable stock immediately.

**Receiving & supplier score** finally reads the ordered-vs-received columns
that purchase orders have always carried. Each supplier is graded on fill rate
(units received ÷ ordered), on-time delivery against the ETA, and real lead
time (PO created → fully received) shown beside the lead time they quote us —
where the real number runs 25%+ past quoted, the reorder plan is quietly
under-buying. Below the scorecard, every line on a closed PO where received ≠
ordered, valued at PO cost: short ships are claimable, over-ships need a
costing decision. Because it exposes cost, the page follows the valuation
rule — admin, finance, and supply chain only. Auditing that boundary turned up
an older leak and closed it: the unit-cost column on Purchase orders was
visible to sales managers, which contradicts the rule that managers never see
costs or margins. That column (and the cost input on draft lines) is now gated
the same way.

Two more nightly rules join the sweep. A **quote left at "sent" for seven
days** pings the specialist who raised it (once per quote, and it says so when
the validity date has passed) — sales dies in the follow-up gap. And a
**birthday or clinic anniversary** three days out pings the account owner,
once a year, using the dates the CRM already stores.

## 9.9 Deleting things, and getting them back

The super admin can delete any record, but nothing evaporates on a click.
Deleting asks you to **type the record's number** — HS-1042, PL-1007 — so a
mis-click can't do it. The row and its lines are copied into an archive, then
removed from the app.

**Admin → Archive** lists everything ever deleted, with who deleted it, when,
and the reason they gave. **Restore** re-creates the record and its lines;
**Purge** removes the archived copy for good and asks you to type the number
again first. Both are in the Activity log, and the archive is in the nightly
backup, so even a purge is recoverable from last night.

Two honest limits. A restored record comes back with a **new id**, so links
from other records to the old one aren't rebuilt — restoring is for "that
shouldn't have gone", not for surgical repair. And a record inside a closed
accounting period is still protected by the period lock unless you, as super
admin, deliberately override it.

## 9.10 Document numbering, in one place

**Admin → Document numbering** controls how every number prints — sales orders,
quotations, credit memos, pull-outs, purchase orders, transfers and
complaints. For each
series you set the prefix, how many digits to pad to, and the number the series
appears to start at, with a live example of what the next one will look like.

The number itself always derives from the record's own position in its series,
so changing a format can never collide two documents onto one number. But it
*is* presentation applied everywhere, including documents already issued — so
agree a change with accounting before making it. Delivery receipts are the
exception: those numbers are stamped permanently onto the order at first print,
and stay on the Cutover page where the BIR series lives.

## 9.11 Finance forms

The sidebar's **Finance forms** section now holds all seven: pull-out requests,
voucher for approval, request to order/pay, proof of payment, replenishment,
expense reimbursement, and cash advance.

The six new ones share one engine rather than being six near-identical pages.
Each is a *spec* — its fields, which are required, which option list feeds each
dropdown, which sections appear only for a given answer, and whether it takes
line items. That means they behave identically: same numbering, same
attachments, same approval chain, same register, and a new form is a spec rather
than a new page.

**Anyone signed in can file one.** Who signs it off is configured per form in
**Admin → Approval routes**: a step can point at a named person, at whoever
holds a role (so it survives someone leaving), or at *the request's own fund
source* — which sends marketing spend to the marketing approver and sales spend
to the sales approver without a step each. A step can carry a minimum amount, so
small claims skip it. Requests move one step at a time and the register shows
which step each is sitting on and who it's waiting for.

Two rules worth knowing. **Nobody approves their own request** — not even an
admin; only the super admin can, because someone has to be able to unstick
things, and it's on the record. And the register is **not** open to everyone
inside the company: these carry bank details and personal claims, so you see
your own, the ones you must decide, and finance/admin see all. Attachments
follow the same rule.

**Option lists** (Admin → Option lists, finance + admin) hold the dropdowns
finance keeps changing: 41 event codes, 35 cash-flow tags, product lines,
payment modes, replenishment and reimbursement types, teams. Add a code when a
programme starts; *retire* rather than delete when one ends, so historical
requests keep reading correctly.

Each form has its own document series — `V-`, `RO-`, `PP-`, `RP-`, `RE-`, `CA-`
— editable like every other series on the Document numbering page. One honest
note: the underlying counter is shared across the forms, so each series will
have gaps (your first voucher might be V-1001 and your first order-to-pay
RO-1002). The numbers are unique and stable, just not contiguous per form.

**Attachments now work.** Files go to a Google Shared Drive through a service
account: the browser uploads straight to Google (so a large scan never hits
Netlify's request limit), Supabase keeps only the pointer, and opening a file
goes back through HQ — so your access *here* decides what you can see, rather
than whether you happen to be on the Drive. Files over about 4 MB open in Drive
instead of streaming back, because a function response can't exceed 6 MB.
Pull-out requests carry attachments today; the finance forms will use the same
control. The super admin can verify the wiring at any time from Cutover →
Attachments → Test the connection.

## 9.12 Favourites

Star any page — the star sits next to the bell in the top bar — and it pins to
the **top of the sidebar** and the **top of your home page**. One list, both
places, up to ten. The star fills in when you're on a page you've favourited,
so it doubles as "is this one of mine?".

To pick several at once: **Favourites → edit** on the home page, or **★
Favourites** in the phone menu. Both open the same chip picker as the bottom-bar
customiser. Editing them repaints the sidebar and the home row at once — there is
no refresh step.

Home sits above Favourites in the sidebar, and the Favourites heading collapses
and expands like every other section, remembering which way you left it.

Favourites are yours and live on the device you set them on, the same as your
custom bottom bar. They're a shortcut, not company data — nothing about them
changes what you're allowed to open, and a page you can't access can't be
favourited.

## 9.13 Attachments on the CRM

Account profiles have a **Documents** panel: licences (LTO, PRC), signed
delivery receipts, agreements — anything that belongs to the clinic rather than
to a single order. And when you log a visit, the confirmation offers an attach
button right there, so a photo of the shelf or a signed slip goes on the visit
while you're still standing in the clinic.

Both use the same Google Drive storage as the finance forms, so the same rule
applies: HQ decides who can open a file, not who happens to be on the Drive.

## 9.14 Pages refresh in place, not from scratch

Every view used to start by wiping the screen to "Loading…" and re-querying the
database. That's right when you *navigate* somewhere — there's nothing to look at
yet. It was wrong every other time: adding a line to a pull-out, filing a
complaint, approving something, releasing stock all made the whole page blank for
a moment and then reappear scrolled back to the top.

Now the placeholder only shows for a real navigation. Anything that redraws the
page you're already on keeps the current content on screen until the new markup
is ready, and puts your scroll position back where it was. That's 28 views —
every form in the app, not just the two you spotted.

The pull-out cart goes further: adding or removing an item you just typed doesn't
touch the database at all. It repaints from what's already loaded, so the line
appears instantly.

## 9.16 With or without Remedy

Remedy is a sister company and one of Healthspan's customers, and Healthspan also
sells to its own staff and academy. Accounting's Sales Booked excludes both, so
the sales views now do too — **external only is the default**, and the figures
line up with the Sales Report instead of running ahead of it.

Every Shopify-fed sales view carries one control in its toolbar:

| | What you see |
|---|---|
| **External only** *(default)* | Third-party sales. Matches accounting. |
| **Incl. Remedy** | Everything, including Remedy branches and Healthspan staff/academy. |

It is one setting, remembered per person per device, and it drives all eight
sales views, the home page's booked chip and the Accounts list, so those pages can
never disagree with each other. Every figure is labelled with which population it
is showing, so a number is never ambiguous.

On the Accounts list, External only **subtracts** each account's internal orders
rather than hiding the account. Only an account whose every order was internal
drops out. That matters because one mis-tagged order at a real clinic would
otherwise remove the whole clinic and all of its revenue from the list, while the
sales views subtracted only that one order — the two pages would then disagree,
and which way would depend on the order Shopify happened to return them in.

**Targets and commissions ignore the toggle entirely.** Attainment is measured and
commission is paid on external sales only, always — that is a rule, not a setting,
and both pages say so on the page.

An order counts as internal if its customer name or its specialist tag says so.
Both matter: the tag is how accounting recognises an internal sale, and the
customer name catches a Remedy order that was booked under a real specialist's tag
— which the old tag-only rule missed, leaving the difference in the Vs accounting
gap column.

The split is computed in the nightly Shopify rebuild. Until that has run, the
toolbar says so rather than showing a control that does nothing.

## 9.15 Sorting any table

Click any column header to sort A–Z; click it again for Z–A. The header you
sorted by turns blue with a ▲ or ▼. It works on every table in HQ — the
register, AR aging, batches, quotes, POs, pull-outs, all of them — without each
page needing its own sort.

It understands what it's looking at rather than sorting text blindly: money
(₱1,200 before ₱45,000, not after), counts with units (3u, 12u, 105u), dates in
either the ISO or the MM/YYYY expiry format, and percentages. Blanks and dashes
always sort to the bottom, whichever direction you pick, so an empty cell never
buries the rows you care about.

Two things it deliberately doesn't touch. Section headings, TOTAL lines and
"nothing here yet" rows stay where the page put them, and the data sorts around
them. And All SKUs keeps its own sorting, which is smarter — it sorts the whole
dataset rather than the page you're looking at.

A sort lasts until the page redraws (a filter, a refresh, an action you take).
That's intentional: it's a way to look at what's on screen, not a saved setting.

## 9.16 Inventory pull-outs — the form, with teeth

Stock leaves the warehouse for internal reasons all the time: KOL engagements,
brand campaigns, FOC promos, trade partnerships, launches and training. That
used to run on a Google form — request, email the fund source, hope, then tell
Alex and Verna, then book it in Shopify. Nothing reserved the stock, so the same
units could be promised to a clinic and to a KOL on the same afternoon, and
nobody could see the queue.

**Pull-out requests** (Logistics) is that process, in the app. Anyone signed in
can file one, because the fund-source approval is the real control:

1. **Request** — pick products from the catalogue (with on-hand and
   available-to-promise beside each one), quantity and unit, the fund source
   (QBO class), the reason, product line, date needed and what it's for.
   Submitting **reserves** the units immediately: they drop out of
   available-to-promise, so no specialist can sell them while the request is
   pending. If there isn't enough available, it warns and lets you proceed —
   the warehouse sees the shortfall at release.
2. **Approve** — only the person mapped to that fund source (or their named
   backup, or the super admin as a fallback) can decide. They're pinged the
   moment the request lands. Approving notifies finance (the class charge) and
   the warehouse (the goods); rejecting sends the reason back to the requester
   and frees the reservation.
3. **Release** — the warehouse hands the goods over, and *that* is when stock
   actually moves: FEFO batch-stamped movements against the PL number, so a
   pulled-out lot is as traceable as a sold one. The reservation ends there.
4. **Booked** — during the parallel run the specialist still records it in
   Shopify; ticking "mark booked" with the reference closes the loop so nothing
   sits half-done.

Fund sources are configurable (admin): each of the eight QBO classes has an
**approver dropdown** (and one for an optional backup) listing every HQ login —
pick a name and it saves immediately. A class with no approver shows a red
outline.

**Approval rights come from the fund-source list, not from a role.** Several
approvers — Digital Marketing, People Ops — hold viewer access, which is
read-only everywhere else in HQ. They can still approve their class, and the page
tells them so: an approver sees a banner naming the classes they own and what is
waiting on them. This is stated as a rule in `viewAllowed` and enforced by an RLS
policy that keys off `fund_sources`, not `profiles.role`, so no future permission
change can quietly revoke it. A class with no approver is flagged loudly, since
its requests can't be routed.

**Finance sees the money side.** Admin and finance get a **fund-source spend**
panel: per class, per month — requests, units, value at item-master cost (the
basis QBO wants for a class charge, not list price), how many have been released
and how many are still open. **Export for QBO** gives one row per line item with
the class, reason, requester, approver, unit cost, value, release date and
booking reference. Rejected and cancelled requests are excluded; lines with no
cost on the item master are called out rather than silently counted as zero.

Pull-outs are internal issues and never count as sales, consistent with the
long-standing pull-out convention. The QBO side stays as it is for now: the
Shopify↔QBO integration carries it, and pushing *all* orders to QBO directly is
a separate piece of work.

## 9.17 Accounting integrity: closing a period, and what freezes

Until now any month could be edited forever. A July order's amount could change
in September, after accounting had signed July off — and nothing said no. The
**period close** on the Cutover page fixes that: the super admin sets a
closed-through date, and everything dated on or before it freezes — order
amounts, order dates, order lines, credit memos, cheque maturities, and monthly
targets. Reopening is the same control, and it warns you what you're doing.

The important part is *where* it is enforced. Database triggers do the work, not
the app, so a bug in a view — or the nightly job running with a service key —
cannot quietly restate a signed-off month. Every blocked write raises a Postgres
error naming the date and the reason. The UI checks the same date first purely so
it can say no politely instead of showing a database error.

Three things deliberately stay open inside a closed period, because they are
operational rather than revenue-changing: **collections** (a July invoice paid in
September is September cash), **shipping marks**, and **DR number assignment**.
Fulfilment and reopening also stay open — picking a closed-period order that
was already booked is operational. What is refused is **cancelling, trashing or
restoring** a closed order, because that removes booked revenue from a signed-off
month; record a credit memo instead, which is the accounting-correct move anyway.
Back-dating an open order *into* a closed month is refused too.

One asymmetry worth knowing: the nightly Shopify backfill may still *import* a
historical order it has never seen, because that is recording a fact rather than
changing one. What it may not do is rewrite the amounts, dates or lines of an
order already inside a closed period — for those it sends payment and shipping
fields only, and the trigger is the backstop if that logic ever regresses. The
job status reports how many orders were treated this way.

**Payments now have their own date.** Recording a payment used to just increment
`orders.paid` with no date anywhere, which made "collections in August"
unanswerable. Each payment is now an append-only row with a date, method and
reference; `orders.paid`/`balance` stay as the rollup the Shopify sync owns. A
wrong payment is corrected with an offsetting negative row, never an edit. AR
aging has a **Collections CSV** beside the accounting export: the individual
dated payments received in a period — what actually came in, by day. (Payments
recorded before this shipped have no date; they survive only in the order totals
and the Activity log.)

**Month-end valuation snapshots.** Inventory value was recomputed live from
today's costs and today's stock, so "value at 31 July" moved every time someone
edited a cost. Landed cost & valuation now has a **Freeze** button that writes
the month's value, units and per-SKU detail permanently; the page shows the
snapshot history. On the 1st of each month the nightly sweep pings finance and
admin if last month isn't frozen yet.

**Credit memos finally net.** They carry a date and a specialist now, and
Commissions computes on **net** — booked less that month's credit memos for that
specialist — so a return can also drop someone a tier. Previously a specialist
who booked ₱500k and had ₱200k credit-memoed was paid on the full ₱500k. CMs
ticked "already refunded in Shopify" are skipped, because during the parallel run
the sales cache has already removed those units at source and deducting again
would double-count the reversal. CMs recorded without a specialist show on their
own card but can't be attributed to anyone — name the specialist when recording.

**Purchase orders have a spend gate.** Sales orders always held above a
threshold; purchasing had none. A PO over the purchase threshold now stays a
draft and lands in Approvals as a "purchase" hold, pinging admin. Approving marks
it ordered; rejecting cancels it. Both thresholds are super-admin settings on the
Approvals page.

## 9.18 Your manual, in-app

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
- **Mobile/iPad**: role-aware bottom navigation — and the four quick-access
  slots are YOURS to pick (Menu → ☆ Customize bar; Home and Menu stay fixed).
  The top bar stays pinned while you scroll.
- **Ask AI**: in-app chat over EVERYTHING HQ knows — inventory, sales, AR,
  cheques, approvals, backorders, quotes, pipeline — automatically scoped to
  your role (specialists get their own numbers; costs only answer for finance
  and admin).
- **Something looks wrong?** Check **Data health** first (feed freshness and
  reconciliation), then tell Angelo.
