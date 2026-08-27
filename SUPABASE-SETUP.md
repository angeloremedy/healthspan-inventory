# Phase A — Supabase accounts for the Healthspan dashboard

The dashboard now supports real per-person logins. Until the two keys are pasted
into `index.html`, it keeps using the old passcode gate — nothing breaks.

## 1. Create the project (5 minutes, you do this part)

1. Go to https://supabase.com → Sign in → **New project**
2. Organization: create one (e.g. "Healthspan"), Project name: `healthspan-crm`,
   Region: **Southeast Asia (Singapore)**, set a strong database password and save
   it somewhere safe (you rarely need it again).
3. Wait ~2 minutes for the project to provision.

## 2. Create the tables — paste this in SQL Editor → New query → Run

```sql
-- Who can log in, and what they are
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  role text not null default 'sales' check (role in ('admin','sales')),
  specialist_tag text   -- must match their Shopify order tag, e.g. 'Rhas'
);
alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Field visit log (CRM)
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  date date not null default current_date,
  spec text not null,
  account text not null,
  type text,
  outcome text,
  notes text,
  user_id uuid not null references auth.users on delete cascade
);
alter table public.visits enable row level security;
create policy "insert own visits" on public.visits
  for insert with check (auth.uid() = user_id);
create policy "read visits" on public.visits
  for select using (auth.role() = 'authenticated');
```

## 3. Create the users

Account structure:
- **1 joint admin account** — shared by Paul, Alex, Angelo, Verna (sees everything)
- **1 account each for the sales managers** — Jojo and Marj (all Sales views;
  can log visits on behalf of any specialist)
- **1 account per product specialist** (Sales views; visit log locked to their own name)

Authentication → Users → **Add user** → "Create new user" for each
(email + a starter password, tick **Auto confirm user**). Suggested emails —
adjust to real ones:

| Account | Email (example) | Role | specialist_tag |
|---|---|---|---|
| Healthspan Admin (joint) | admin@healthspan.ph | admin | — |
| Jojo (manager) | jojo@healthspan.ph | sales | — |
| Marj (manager) | marj@healthspan.ph | sales | — |
| Lady | lady@healthspan.ph | sales | Lady |
| Pinky | pinky@healthspan.ph | sales | Pinky |
| Rhas | rhas@healthspan.ph | sales | Rhas |
| Tin | tin@healthspan.ph | sales | Tin |
| Rechel | rechel@healthspan.ph | sales | Rechel |
| Charmaine | charmaine@healthspan.ph | sales | Charmaine |
| Ruth | ruth@healthspan.ph | sales | Ruth |
| Joy | joy@healthspan.ph | sales | Joy |
| RJ | rj@healthspan.ph | sales | RJ |
| Jonathan | jonathan@healthspan.ph | sales | Jonathan |
| Abby | abby@healthspan.ph | sales | Abby |
| Frank | frank@healthspan.ph | sales | Frank |
| Orland (Orly) | orland@healthspan.ph | sales | Orland Reyes |
| Cyra | cyra@healthspan.ph | sales | Cyra |

The `specialist_tag` must match their Shopify order tag (case doesn't matter;
Kristine's old orders merge into Tin automatically). Managers get **no tag** —
that's what lets them pick any specialist in the Log visit form.

Then in SQL Editor, run this after fixing the emails to the real ones:

```sql
insert into public.profiles (id, name, role, specialist_tag)
select u.id, v.name, v.role, v.tag
from (values
  ('admin@healthspan.ph',     'Healthspan Admin', 'admin', null),
  ('jojo@healthspan.ph',      'Jojo',             'sales', null),
  ('marj@healthspan.ph',      'Marj',             'sales', null),
  ('lady@healthspan.ph',      'Lady',             'sales', 'Lady'),
  ('pinky@healthspan.ph',     'Pinky',            'sales', 'Pinky'),
  ('rhas@healthspan.ph',      'Rhas',             'sales', 'Rhas'),
  ('tin@healthspan.ph',       'Tin',              'sales', 'Tin'),
  ('rechel@healthspan.ph',    'Rechel',           'sales', 'Rechel'),
  ('charmaine@healthspan.ph', 'Charmaine',        'sales', 'Charmaine'),
  ('ruth@healthspan.ph',      'Ruth',             'sales', 'Ruth'),
  ('joy@healthspan.ph',       'Joy',              'sales', 'Joy'),
  ('rj@healthspan.ph',        'RJ',               'sales', 'RJ'),
  ('jonathan@healthspan.ph',  'Jonathan',         'sales', 'Jonathan'),
  ('abby@healthspan.ph',      'Abby',             'sales', 'Abby'),
  ('frank@healthspan.ph',     'Frank',            'sales', 'Frank'),
  ('orland@healthspan.ph',    'Orland Reyes',     'sales', 'Orland Reyes'),
  ('cyra@healthspan.ph',      'Cyra',             'sales', 'Cyra')
) as v(email, name, role, tag)
join auth.users u on lower(u.email) = lower(v.email)
on conflict (id) do update set name = excluded.name, role = excluded.role,
  specialist_tag = excluded.specialist_tag;
```

Only rows whose email exists in Authentication → Users get inserted, so it's
safe to run again after adding more users. Note: the joint admin account means
no individual audit trail for Paul/Alex/Angelo/Verna — fine for now, easy to
split into personal accounts later.

## 4. Connect the dashboard

Project Settings → **API** → copy:
- **Project URL** (https://xxxx.supabase.co)
- **anon public** key (long string — this one is safe to put in the page;
  security is enforced by the row-level policies above, not by hiding the key)

Open `index.html`, search for `SUPABASE_URL`, paste both values, deploy.

## What changes when it's live

- The passcode screen becomes email + password sign-in.
- Role (admin / sales) comes from the person's profile row.
- Specialists land on **Log visit** with their name locked to their own tag.
- Visits save to the `visits` table (each person can only insert their own —
  enforced by the database, not the browser).
- Sign-out link sits at the bottom of the sidebar.
- To reset a password: Supabase → Authentication → Users → ⋯ → Send password
  recovery (or set a new one directly).

## Phase A.2 — CRM tables (account profiles, follow-ups, planned visits)

Paste in SQL Editor → Run (safe to run once, errors if run twice — that's fine):

```sql
-- Editable account records: the CRM layer on top of Shopify/sheet names
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- must match the Shopify customer / OUT destination name
  contact_person text,
  phone text,
  address text,
  specialty text,
  notes text,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users
);
alter table public.accounts enable row level security;
create policy "read accounts"   on public.accounts for select using (auth.role() = 'authenticated');
create policy "insert accounts" on public.accounts for insert with check (auth.role() = 'authenticated');
create policy "update accounts" on public.accounts for update using (auth.role() = 'authenticated');

-- Visits gain the follow-up workflow and planned (future) visits
alter table public.visits add column if not exists status text not null default 'done'
  check (status in ('done','planned'));
alter table public.visits add column if not exists fu_done boolean not null default false;

-- Specialists can update their own visits; managers (no tag) and admins can update anyone's
create policy "update visits" on public.visits for update
using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles p
             where p.id = auth.uid()
               and (p.role = 'admin' or p.specialist_tag is null))
);
```

## Phase A.3 — Order taking (the Shopify replacement, pilot)

Paste in SQL Editor → Run:

```sql
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  num bigint generated always as identity,        -- displayed as HS-1001, HS-1002…
  created_at timestamptz not null default now(),
  date date not null default current_date,
  account text not null,
  spec text not null,
  status text not null default 'pending' check (status in ('pending','fulfilled','cancelled')),
  notes text,
  total numeric not null default 0,
  user_id uuid not null references auth.users
);
create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  sku text not null,
  name text not null,
  qty int not null check (qty > 0),
  price numeric not null default 0,
  amount numeric not null default 0,
  is_free boolean not null default false,
  deal text
);
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
create policy "read orders"  on public.orders for select using (auth.role() = 'authenticated');
create policy "insert own orders" on public.orders for insert with check (auth.uid() = user_id);
create policy "update orders" on public.orders for update
using (auth.uid() = user_id or exists (select 1 from public.profiles p
  where p.id = auth.uid() and (p.role = 'admin' or p.specialist_tag is null)));
create policy "read lines"   on public.order_lines for select using (auth.role() = 'authenticated');
create policy "insert own lines" on public.order_lines for insert
with check (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
```

### Hardening: specialists can only submit under their own name

The app locks the specialist field in the browser, but this makes the DATABASE
refuse anything else too. Paste → Run:

```sql
drop policy "insert own visits" on public.visits;
create policy "insert own visits" on public.visits for insert
with check (
  auth.uid() = user_id
  and exists (select 1 from public.profiles p where p.id = auth.uid()
              and (p.specialist_tag is null or lower(p.specialist_tag) = lower(spec)))
);

drop policy "insert own orders" on public.orders;
create policy "insert own orders" on public.orders for insert
with check (
  auth.uid() = user_id
  and exists (select 1 from public.profiles p where p.id = auth.uid()
              and (p.specialist_tag is null or lower(p.specialist_tag) = lower(spec)))
);
```

(Managers and admins have no tag, so they can submit for anyone.)

### Order recycle bin (admin delete → trash → empty)

```sql
alter table public.orders add column if not exists deleted_at timestamptz;
create policy "purge orders (admin only)" on public.orders for delete
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
```

Deleting in the app is a soft delete (sets `deleted_at`, order moves to Trash and
can be restored). "Empty trash" permanently removes them — admin role only,
double-confirmed in the app, and lines are removed automatically with the order.

### Status control for Shopify-imported orders (fulfill / unfulfill / cancel / delete)

Imported orders live in the sales cache (rebuilt from Shopify), so their statuses
are stored as overrides keyed by order number:

```sql
create table public.order_overrides (
  ref text primary key,                -- Shopify order number, e.g. '#HG-10253'
  status text check (status in ('pending','fulfilled','cancelled')),
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users
);
alter table public.order_overrides enable row level security;
create policy "read overrides" on public.order_overrides for select using (auth.role() = 'authenticated');
create policy "write overrides (admin)" on public.order_overrides for insert
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "update overrides (admin)" on public.order_overrides for update
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
```

Note: "emptying trash" for an imported order keeps a permanent tombstone here
(the source row can't be removed from Shopify's history) — it simply never
reappears in the app.

Pilot rules: specialists enter orders here AND in Shopify for 2–3 weeks (native orders
are kept out of the sales totals meanwhile, to avoid double counting). After the
parallel run proves the numbers, we cut over and Shopify becomes read-only history.

## In-app specialist targets (admin & sales manager)

```sql
create table if not exists public.spec_targets (
  spec text not null,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  amount bigint not null check (amount >= 0),
  set_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  primary key (spec, month)
);
alter table public.spec_targets enable row level security;
create policy "read spec targets" on public.spec_targets for select
  using (auth.role() = 'authenticated');
create policy "write spec targets" on public.spec_targets for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "update spec targets" on public.spec_targets for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "delete spec targets" on public.spec_targets for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
```

In-app targets override the sheet/corporate numbers for the same specialist +
month everywhere in the app. Blank = sheet value still applies.

## Products endorsed on visits ("bida")

```sql
alter table public.visits add column if not exists products text;
```

Specialists tag which products they endorsed during a visit; shows in recent
visits, account timelines, and specialist pages ("bida: …").

## Review scorecards (quarterly performance reviews)

```sql
create table if not exists public.review_notes (
  spec text not null,
  quarter text not null check (quarter ~ '^\d{4}-Q[1-4]$'),
  rating int check (rating between 1 and 5),
  comments text,
  updated_by uuid references auth.users,
  updated_at timestamptz not null default now(),
  primary key (spec, quarter)
);
alter table public.review_notes enable row level security;
-- manager/admin ONLY — review comments are never visible to specialists
create policy "read reviews (mgmt)" on public.review_notes for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "write reviews (mgmt)" on public.review_notes for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "update reviews (mgmt)" on public.review_notes for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
```

## Independence module: cutover flags · item master · returns/CM · stock ledger

```sql
-- cutover switches (the "declare independence" flags)
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_by uuid references auth.users,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy "read settings" on public.app_settings for select
  using (auth.role() = 'authenticated');
create policy "write settings (admin)" on public.app_settings for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "update settings (admin)" on public.app_settings for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- item master (catalog): shadow until use_catalog_pricing = on
create table if not exists public.items (
  sku text primary key,
  name text not null,
  line text,
  category text,
  price bigint,
  cost bigint,
  barcode text,
  active boolean not null default true,
  updated_by uuid references auth.users,
  updated_at timestamptz not null default now()
);
alter table public.items enable row level security;
create policy "read items" on public.items for select
  using (auth.role() = 'authenticated');
create policy "write items" on public.items for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "update items" on public.items for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));

-- returns & credit memos (CM number = 1000 + id)
create table if not exists public.returns (
  id bigint generated always as identity primary key,
  account text not null,
  order_ref text,
  items text,
  amount bigint not null check (amount > 0),
  action text not null default 'restock' check (action in ('restock','writeoff')),
  reason text,
  applied boolean not null default false,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);
alter table public.returns enable row level security;
create policy "read returns" on public.returns for select
  using (auth.role() = 'authenticated');
create policy "write returns" on public.returns for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "update returns" on public.returns for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));

-- stock ledger (SHADOW until ledger_is_truth = on): append-only movements
create table if not exists public.stock_moves (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  sku text not null,
  qty int not null,                 -- signed: + receive, − pick
  kind text not null check (kind in ('receive','pick','count','adjust','return')),
  ref text,                         -- order label / PO / CM number
  batch text,
  note text,
  by_name text,
  user_id uuid references auth.users
);
alter table public.stock_moves enable row level security;
create policy "read moves" on public.stock_moves for select
  using (auth.role() = 'authenticated');
create policy "insert moves" on public.stock_moves for insert
  with check (auth.uid() = user_id);
-- deliberately NO update/delete policies: the ledger is append-only
```

## Contacts per account + PDC register

```sql
-- multiple contacts per account (doctor, purchaser, nurse…)
create table if not exists public.account_contacts (
  id bigint generated always as identity primary key,
  acct_key text not null,             -- normalized account name (survives merges)
  account text not null,              -- display name at creation
  name text not null,
  role text,
  phone text,
  email text,
  notes text,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);
alter table public.account_contacts enable row level security;
create policy "read contacts" on public.account_contacts for select
  using (auth.role() = 'authenticated');
create policy "insert contacts" on public.account_contacts for insert
  with check (auth.role() = 'authenticated');
create policy "delete contacts" on public.account_contacts for delete
  using (auth.role() = 'authenticated');

-- PDC register: post-dated cheques tracked to maturity
create table if not exists public.pdcs (
  id bigint generated always as identity primary key,
  account text not null,
  order_ref text,
  bank text,
  cheque_no text,
  amount bigint not null check (amount > 0),
  maturity date not null,
  status text not null default 'on_hand' check (status in ('on_hand','deposited','cleared','bounced')),
  notes text,
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
alter table public.pdcs enable row level security;
create policy "read pdcs" on public.pdcs for select
  using (auth.role() = 'authenticated');
create policy "write pdcs" on public.pdcs for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "update pdcs" on public.pdcs for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "delete pdcs" on public.pdcs for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
```

## Specialist roster (add / deactivate PS) + endpoint lockdown

```sql
-- roster: manually added specialists + soft-deactivation (history always kept)
create table if not exists public.spec_roster (
  spec text primary key,
  active boolean not null default true,
  updated_by uuid references auth.users,
  updated_at timestamptz not null default now()
);
alter table public.spec_roster enable row level security;
create policy "read roster" on public.spec_roster for select
  using (auth.role() = 'authenticated');
create policy "insert roster (admin/manager)" on public.spec_roster for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "update roster (admin only)" on public.spec_roster for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
```

**Endpoint lockdown (no SQL — Netlify env):** the data feed (`refresh`), sales
cache (`/api/shopify`), Ask AI (`ask`), and visits endpoints now require a
signed-in Supabase session (verified server-side). The legacy access-code gate
is REMOVED — Supabase accounts are the only way in. Background jobs
(`backfill-background`, `shopify-build-background`) require a `JOB_KEY`:

1. Netlify → Environment variables → add `JOB_KEY` = any long random string.
2. Trigger the backfill with `…/.netlify/functions/backfill-background?key=YOUR_JOB_KEY`.
3. Optionally set `ASKLOG_KEY` to protect question-log reads.

Until `JOB_KEY` is set, the background endpoints stay open (nothing bricks) —
set it right after deploying.

## Demand planning: forecast snapshots (MAPE) + campaign calendar

```sql
-- monthly forecast freeze, scored against reality a month later
create table if not exists public.forecast_snapshots (
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  sku text not null,
  name text,
  forecast_units numeric not null,
  sold_cum numeric,                -- cumulative sold at capture (used to derive actuals)
  actual_units numeric,            -- filled in by NEXT month's snapshot
  captured_at timestamptz not null default now(),
  primary key (month, sku)
);
alter table public.forecast_snapshots enable row level security;
create policy "read snapshots" on public.forecast_snapshots for select
  using (auth.role() = 'authenticated');
create policy "write snapshots" on public.forecast_snapshots for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "update snapshots" on public.forecast_snapshots for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));

-- campaign / promo calendar (demand signal)
create table if not exists public.campaigns (
  id bigint generated always as identity primary key,
  name text not null,
  from_date date not null,
  to_date date not null,
  skus text,
  uplift_pct int,
  notes text,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
create policy "read campaigns" on public.campaigns for select
  using (auth.role() = 'authenticated');
create policy "write campaigns" on public.campaigns for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "delete campaigns" on public.campaigns for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
```

Snapshots are captured automatically the first time an admin/manager loads the
app each month; actuals derive from the change in cumulative sold units between
captures. The AI planning review (Planning → AI planning review) reads the
catalog + campaigns + worst forecast misses through the existing Ask AI worker.

## Order editing (specialists edit their own; admin/manager edit any)

Run once. Lets an order's owner update it and replace its lines; managers/admins
can edit anyone's. The app only offers editing on **pending native** orders.

```sql
drop policy "update orders" on public.orders;
create policy "update orders" on public.orders for update
using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles p where p.id = auth.uid()
             and (p.role = 'admin' or p.specialist_tag is null))
);

drop policy "insert own lines" on public.order_lines;
create policy "insert lines" on public.order_lines for insert
with check (exists (select 1 from public.orders o where o.id = order_id
  and (o.user_id = auth.uid()
       or exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.specialist_tag is null)))));

create policy "delete lines" on public.order_lines for delete
using (exists (select 1 from public.orders o where o.id = order_id
  and (o.user_id = auth.uid()
       or exists (select 1 from public.profiles p where p.id = auth.uid()
                  and (p.role = 'admin' or p.specialist_tag is null)))));
```

Every edit is written to the audit log (`order.edit`) with who and the new total.

## Account merges + parent/child + the `manager` role

Run this whole block once (Supabase → SQL editor). It (1) adds the third role,
(2) creates the curated-links table behind the in-app Merge / Set parent buttons.

```sql
-- 1. three roles: admin / manager (sales manager) / sales (product specialist)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','manager','sales'));

-- promote the sales managers (adjust names if needed)
update public.profiles set role = 'manager'
where role = 'sales' and specialist_tag is null;

-- 2. curated account links (merge = same customer, different spelling;
--    branch = child clinic under a parent company)
create table if not exists public.account_links (
  from_key   text primary key,          -- normalized name of the merged/child account
  from_name  text not null,             -- display name as it was
  to_name    text not null,             -- target / parent account display name
  kind       text not null default 'merge' check (kind in ('merge','branch')),
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);
alter table public.account_links enable row level security;
create policy "read links" on public.account_links for select
  using (auth.role() = 'authenticated');
create policy "write links (admin/manager)" on public.account_links for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "update links (admin/manager)" on public.account_links for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "delete links (admin/manager)" on public.account_links for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
```

## Shipment tracking + audit trail

Run once (Supabase → SQL editor):

```sql
-- shipment tracking on orders (courier / waybill / dispatched / delivered)
alter table public.orders
  add column if not exists courier text,
  add column if not exists waybill text,
  add column if not exists dispatched_at date,
  add column if not exists delivered_at date;

-- audit trail: who changed what, when (append-only)
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid references auth.users,
  who text,
  action text not null,
  detail text
);
alter table public.audit_log enable row level security;
create policy "insert own audit" on public.audit_log for insert
  with check (auth.uid() = user_id);
create policy "read audit (admin/manager)" on public.audit_log for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
-- no update/delete policies on purpose: the log is append-only from the app
```

Logged automatically: order create/fulfill/cancel/trash/restore, payments,
shipment updates, account merges/links, accounting exports, and (server-side,
via the service key) all Team & access actions.

Role behavior: `manager` sees everything except Team & access (user management),
can merge accounts and set parent/child, sees every specialist's data, and can
submit orders/visits for anyone (no specialist_tag). Admin-only stays: user
management, order delete/trash purge, payment recording, status overrides.
Existing tag-based RLS is untouched — managers pass because their tag is null.

## Phase A.4 — Full migration: all Shopify orders & customers into Supabase

### 1. Schema changes — SQL Editor → Run

```sql
-- imported orders have no app user, and carry their Shopify number
alter table public.orders alter column user_id drop not null;
alter table public.orders add column if not exists source text not null default 'native';
alter table public.orders add column if not exists ext_ref text unique;
create index if not exists orders_date_idx on public.orders (date desc);
create index if not exists orders_account_idx on public.orders (account);
```

### 2. Give the migration function a key

The backfill runs on Netlify and needs to write past row-level security:

1. Supabase → Project Settings → API → copy the **service_role** key
   (⚠️ this one is all-powerful — it goes ONLY into Netlify env, never into the page)
2. Netlify → Site configuration → Environment variables → add
   `SUPABASE_SERVICE_KEY` = that key (mark as secret) — and `SUPABASE_URL` =
   your project URL (https://lesjigujcajxurmsmwwc.supabase.co)
3. Trigger deploy → Deploy site (env changes need a redeploy)

### 3. Run the backfill

Deploy `netlify/functions/backfill-background.mjs`, then open once:

    https://healthspan-inventory.netlify.app/.netlify/functions/backfill-background

It pulls the complete Shopify order history (all years), writes orders + lines +
customer records, and takes a few minutes. Safe to run again anytime — orders
upsert by their Shopify number (re-running refreshes them, never duplicates),
and customer records are insert-only (your CRM edits are never overwritten).
TEST orders and marketing/executive pull-outs are excluded, and Shopify's own
fulfillment/cancellation status is carried over.

Verify afterwards in SQL Editor:

```sql
select source, count(*) from public.orders group by source;
```

## Phase 2 — AR aging & payments

SQL Editor → Run:

```sql
alter table public.orders add column if not exists pay_status text not null default 'pending'
  check (pay_status in ('pending','partial','paid','refunded'));
alter table public.orders add column if not exists paid numeric not null default 0;
alter table public.orders add column if not exists balance numeric not null default 0;
alter table public.orders add column if not exists terms_days int;
alter table public.orders add column if not exists order_note text;
```

Then re-run the backfill URL once (after deploying the updated
`backfill-background.mjs`) — it now carries each Shopify order's **paid amount,
outstanding balance, financial status, the order note** (where payment terms
like "PDC 30 days" live — parsed into `terms_days` automatically), and it's
still safe to re-run anytime: **re-running = syncing payment statuses from
Shopify**, since accounting marks orders paid there. Payments recorded in-app
on migrated orders will be overwritten by a re-run — record payments in-app
only for native (HS-) orders until cutover.

## Later phases (for reference)

- Move the public data endpoints behind the Supabase session token.
- Vite restructure: split index.html into modules, deploys via git.
- CRM: account profile pages, follow-up queue from "Follow-up needed" visits.
