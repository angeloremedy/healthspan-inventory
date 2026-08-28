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

## Account ownership (PRD Phase A) + catalog deal definitions

```sql
alter table public.accounts add column if not exists owner_tag text;
alter table public.items add column if not exists deals text;  -- JSON: [{"buy":5,"free":1,"price":237500}]
```

## ALL ROLES ROLLOUT (run this whole block once): super admin + supply_chain /
## finance / marketing / viewer + manager tightening

```sql
-- 1. super admin flag (Angelo only)
alter table public.profiles add column if not exists is_super boolean not null default false;
update public.profiles set is_super = true
where id = (select id from auth.users where email = 'angelo@remedy.ph');

drop policy if exists "write settings (admin)" on public.app_settings;
drop policy if exists "update settings (admin)" on public.app_settings;
drop policy if exists "write settings (super)" on public.app_settings;
drop policy if exists "update settings (super)" on public.app_settings;
create policy "write settings (super)" on public.app_settings for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super));
create policy "update settings (super)" on public.app_settings for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super));

-- 2. seven roles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','manager','sales','supply_chain','finance','marketing','viewer'));

-- 3. order/visit entry: sales-shaped roles only (circle roles are read-only there)
drop policy if exists "insert own orders" on public.orders;
create policy "insert own orders" on public.orders for insert
with check (auth.uid() = user_id and exists (select 1 from public.profiles p
  where p.id = auth.uid() and (p.role in ('admin','manager') or lower(coalesce(p.specialist_tag,'')) = lower(spec))));
drop policy if exists "insert own visits" on public.visits;
create policy "insert own visits" on public.visits for insert
with check (auth.uid() = user_id and exists (select 1 from public.profiles p
  where p.id = auth.uid() and (p.role in ('admin','manager') or lower(coalesce(p.specialist_tag,'')) = lower(spec))));
drop policy if exists "update visits" on public.visits;
create policy "update visits" on public.visits for update
using (exists (select 1 from public.profiles p where p.id = auth.uid()
  and (p.role in ('admin','manager') or lower(coalesce(p.specialist_tag,'')) = lower(spec))));

-- 4. orders update: owners + ops roles (status, payments, edits)
drop policy if exists "update orders" on public.orders;
create policy "update orders" on public.orders for update
using (auth.uid() = user_id or exists (select 1 from public.profiles p
  where p.id = auth.uid() and p.role in ('admin','manager','supply_chain','finance')));
drop policy if exists "insert lines" on public.order_lines;
create policy "insert lines" on public.order_lines for insert
with check (exists (select 1 from public.orders o where o.id = order_id
  and (o.user_id = auth.uid() or exists (select 1 from public.profiles p
       where p.id = auth.uid() and p.role in ('admin','manager')))));
drop policy if exists "delete lines" on public.order_lines;
create policy "delete lines" on public.order_lines for delete
using (exists (select 1 from public.orders o where o.id = order_id
  and (o.user_id = auth.uid() or exists (select 1 from public.profiles p
       where p.id = auth.uid() and p.role in ('admin','manager')))));

-- 5. role-scoped writes (tightening + new owners)
drop policy if exists "write pdcs" on public.pdcs;
drop policy if exists "update pdcs" on public.pdcs;
drop policy if exists "delete pdcs" on public.pdcs;
create policy "write pdcs" on public.pdcs for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','finance')));
create policy "update pdcs" on public.pdcs for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','finance')));
create policy "delete pdcs" on public.pdcs for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','finance')));

drop policy if exists "write items" on public.items;
drop policy if exists "update items" on public.items;
create policy "write items" on public.items for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','finance')));
create policy "update items" on public.items for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','finance')));

drop policy if exists "write pos" on public.pos;
drop policy if exists "update pos" on public.pos;
create policy "write pos" on public.pos for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','supply_chain')));
create policy "update pos" on public.pos for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','supply_chain')));
drop policy if exists "write po lines" on public.po_lines;
drop policy if exists "update po lines" on public.po_lines;
create policy "write po lines" on public.po_lines for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','supply_chain')));
create policy "update po lines" on public.po_lines for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','supply_chain')));

drop policy if exists "write returns" on public.returns;
drop policy if exists "update returns" on public.returns;
create policy "write returns" on public.returns for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','finance')));
create policy "update returns" on public.returns for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','finance')));

drop policy if exists "write campaigns" on public.campaigns;
drop policy if exists "delete campaigns" on public.campaigns;
create policy "write campaigns" on public.campaigns for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','marketing')));
create policy "delete campaigns" on public.campaigns for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','marketing')));

drop policy if exists "read audit (admin/manager)" on public.audit_log;
create policy "read audit (mgmt+finance)" on public.audit_log for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','finance')));

drop policy if exists "write snapshots" on public.forecast_snapshots;
drop policy if exists "update snapshots" on public.forecast_snapshots;
create policy "write snapshots" on public.forecast_snapshots for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','supply_chain')));
create policy "update snapshots" on public.forecast_snapshots for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','supply_chain')));
```

## Super admin (Angelo only): cutover switches + permanent user deletion

```sql
alter table public.profiles add column if not exists is_super boolean not null default false;
update public.profiles set is_super = true
where id = (select id from auth.users where email = 'angelo@remedy.ph');

-- cutover switches: super admin only (was: any admin)
drop policy if exists "write settings (admin)" on public.app_settings;
drop policy if exists "update settings (admin)" on public.app_settings;
create policy "write settings (super)" on public.app_settings for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super));
create policy "update settings (super)" on public.app_settings for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super));
```

User deletion is enforced server-side (admin-users function checks `is_super`);
deletion is blocked automatically for anyone with orders/visits on record —
history is protected, disable is the reversible path.

## Pipeline (PRD Phases B–C) + Purchase orders & receiving

```sql
-- pipeline stages on accounts
alter table public.accounts add column if not exists stage text
  check (stage in ('lead','contacted','qualified','active','dormant','lost'));
alter table public.accounts add column if not exists stage_since timestamptz;
alter table public.accounts add column if not exists lost_reason text;

-- opportunities (big deals with value + expected close)
create table if not exists public.opportunities (
  id bigint generated always as identity primary key,
  acct_key text not null,
  account text not null,
  title text not null,
  owner_tag text,
  est_value bigint,
  expected_month text,
  stage text not null default 'open' check (stage in ('open','won','lost')),
  lost_reason text,
  notes text,
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
alter table public.opportunities enable row level security;
create policy "read opps" on public.opportunities for select
  using (auth.role() = 'authenticated');
create policy "insert opps" on public.opportunities for insert
  with check (auth.role() = 'authenticated');
create policy "update opps" on public.opportunities for update
  using (auth.role() = 'authenticated');

-- purchase orders + lines (receiving writes into stock_moves)
create table if not exists public.pos (
  id bigint generated always as identity primary key,
  supplier text not null,
  status text not null default 'draft' check (status in ('draft','ordered','partial','received','cancelled')),
  eta date,
  notes text,
  created_by uuid references auth.users,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create table if not exists public.po_lines (
  id bigint generated always as identity primary key,
  po_id bigint not null references public.pos(id) on delete cascade,
  sku text not null,
  name text,
  qty int not null check (qty > 0),
  unit_cost bigint,
  received int not null default 0
);
alter table public.pos enable row level security;
alter table public.po_lines enable row level security;
create policy "read pos" on public.pos for select using (auth.role() = 'authenticated');
create policy "write pos" on public.pos for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "update pos" on public.pos for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "read po lines" on public.po_lines for select using (auth.role() = 'authenticated');
create policy "write po lines" on public.po_lines for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "update po lines" on public.po_lines for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
```

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

## Finance suite — approvals, credit limits, commissions, supplier AP, scoped PS admin (2026-08-27)

SQL Editor → Run:

```sql
-- 1) Credit limits per account (finance sets them)
alter table public.accounts add column if not exists credit_limit bigint;

-- 2) Orders can be held for approval (existing rows stay approved)
alter table public.orders add column if not exists approved boolean not null default true;

-- 3) Approvals queue
create table if not exists public.approvals (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('credit','threshold')),
  order_id uuid,
  order_label text,
  account text,
  amount bigint,
  reason text,
  requested_by uuid,
  requested_name text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.approvals enable row level security;
create policy "approvals read mgmt" on public.approvals for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','finance')));
create policy "approvals insert own" on public.approvals for insert to authenticated
  with check (auth.uid() = requested_by);
create policy "approvals decide mgmt" on public.approvals for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));

-- 4) Commission rules (single row, finance-editable)
create table if not exists public.comm_rules (
  id int primary key default 1 check (id = 1),
  rules text,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.comm_rules enable row level security;
create policy "comm read" on public.comm_rules for select to authenticated using (true);
create policy "comm write" on public.comm_rules for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','finance')));
create policy "comm update" on public.comm_rules for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','finance')));

-- 5) Supplier AP fields on purchase orders
alter table public.pos add column if not exists terms text;
alter table public.pos add column if not exists proforma text;
alter table public.pos add column if not exists currency text;
alter table public.pos add column if not exists fx_total numeric;
alter table public.pos add column if not exists amount_paid numeric;
alter table public.pos add column if not exists peso_value bigint;

-- 6) Let finance edit the AP fields on POs (drop + recreate the update policy)
drop policy if exists "pos update" on public.pos;
create policy "pos update" on public.pos for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','supply_chain','finance')));

-- 7) Scoped PS-account admin for Justine (create/disable specialists only)
alter table public.profiles add column if not exists can_manage_ps boolean not null default false;
update public.profiles set can_manage_ps = true
  where id = (select id from auth.users where email = 'itops@remedy.ph');
```

If your existing PO
update policy has a different name, check it under Database → Policies → pos
and drop that name instead. The approval threshold itself is set in-app
(Approvals view, super admin only) — it's stored in `app_settings` as
`approval_threshold`, no SQL needed.

## CRM fields on accounts + richer contacts (2026-08-27)

SQL Editor → Run:

```sql
-- Accounts: CRM enrichment fields
alter table public.accounts add column if not exists email text;
alter table public.accounts add column if not exists viber text;
alter table public.accounts add column if not exists region text;
alter table public.accounts add column if not exists city text;
alter table public.accounts add column if not exists clinic_type text;
alter table public.accounts add column if not exists tier text check (tier is null or tier in ('A','B','C'));
alter table public.accounts add column if not exists source text;
alter table public.accounts add column if not exists delivery_notes text;
alter table public.accounts add column if not exists birthday date;
alter table public.accounts add column if not exists anniversary date;
alter table public.accounts add column if not exists lto_no text;
alter table public.accounts add column if not exists lto_expiry date;
alter table public.accounts add column if not exists prc_no text;
alter table public.accounts add column if not exists prc_expiry date;

-- Contacts: email + Viber per person
alter table public.account_contacts add column if not exists email text;
alter table public.account_contacts add column if not exists viber text;
```

No RLS changes — these ride the existing accounts / account_contacts policies.
Delivery notes print on the DR under "Deliver to"; LTO/PRC expiries show
red/amber pills on the account page.

## Quotations + Promotions engine + Product registrations (2026-08-28)

SQL Editor → Run:

```sql
-- 1) Quotations
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  num bigint generated always as identity,
  account text not null,
  spec text,
  date date not null default current_date,
  expiry date,
  status text not null default 'draft' check (status in ('draft','sent','accepted','lost')),
  lost_reason text,
  total bigint not null default 0,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.quote_lines (
  id bigint generated always as identity primary key,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  sku text, name text, qty int, price bigint, amount bigint,
  is_free boolean not null default false, deal text
);
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
create policy "quotes read" on public.quotes for select to authenticated using (true);
create policy "quotes insert" on public.quotes for insert to authenticated
  with check (auth.uid() = created_by and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','sales')));
create policy "quotes update" on public.quotes for update to authenticated
  using (created_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));
create policy "qlines read" on public.quote_lines for select to authenticated using (true);
create policy "qlines insert" on public.quote_lines for insert to authenticated
  with check (exists (select 1 from public.quotes q where q.id = quote_id and q.created_by = auth.uid()));

-- 2) Promotions engine
create table if not exists public.promos (
  id bigint generated always as identity primary key,
  name text not null,
  start_date date not null,
  end_date date not null,
  skus text not null,          -- comma-separated SKUs, or * for all
  mechanic text not null check (mechanic in ('nplusm','pct')),
  buy_n int, free_m int, pct numeric,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.promos enable row level security;
create policy "promos read" on public.promos for select to authenticated using (true);
create policy "promos write" on public.promos for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','marketing')));
create policy "promos update" on public.promos for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','marketing')));
create policy "promos delete" on public.promos for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','marketing')));

-- 3) Product registrations (CPR/FDA) on the item master
alter table public.items add column if not exists reg_type text;
alter table public.items add column if not exists reg_no text;
alter table public.items add column if not exists reg_expiry date;
```

Registration edits ride the existing items policies (admin + finance).
Quotes: everyone signed-in can read; sales/manager/admin create; owner or
manager/admin update status. Promos: everyone reads (order entry applies
them); admin + marketing configure.

## Notifications (2026-08-28)

SQL Editor → Run:

```sql
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid,            -- direct recipient, or…
  role text,               -- …broadcast to everyone with this role
  kind text not null,      -- approval / decision / order / fulfilled
  title text not null,
  body text,
  link text,               -- in-app hash route
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "notif read mine" on public.notifications for select to authenticated
  using (user_id = auth.uid()
     or (role is not null and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = notifications.role)));
create policy "notif insert" on public.notifications for insert to authenticated
  with check (auth.uid() = created_by);
```

Unread state is a per-device watermark (localStorage) — no read-tracking table
needed. Stock reservations / ATP need **no SQL**: pending native orders ARE the
reservation (derived live from order_lines), so reservations release
automatically on fulfill/cancel.

## Cycle counts + opening-balance snapshot (2026-08-28)

SQL Editor → Run:

```sql
create table if not exists public.count_sessions (
  id bigint generated always as identity primary key,
  scope text not null default 'all',
  started_by uuid,
  started_name text,
  started_at timestamptz,
  closed_at timestamptz,
  skus int not null default 0,
  matched int not null default 0,
  variance_units int not null default 0
);
create table if not exists public.count_lines (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.count_sessions(id) on delete cascade,
  sku text, name text, expected int, counted int, variance int
);
alter table public.count_sessions enable row level security;
alter table public.count_lines enable row level security;
create policy "cc read" on public.count_sessions for select to authenticated using (true);
create policy "cc write" on public.count_sessions for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','supply_chain')));
create policy "ccl read" on public.count_lines for select to authenticated using (true);
create policy "ccl write" on public.count_lines for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','supply_chain')));
```

The opening-balance snapshot needs **no SQL**: it writes `kind='adjust'`
rows with `ref='OPENING'` (note = the epoch timestamp) through the existing
stock_moves policies, and stores `ledger_epoch` in app_settings via the
existing super-admin flag write. When `ledger_is_truth` is ON, `stk()`
everywhere = opening rows (latest epoch) + movements after the epoch; count
rows are observations and never sum.

## Supabase Pro at cutover — backup & restore drill (decided: staying on Supabase, no AWS)

Before flipping ANY cutover switch:
1. Upgrade the project to **Pro** (Dashboard → Settings → Billing): daily
   backups, 7-day PITR, no pause policy.
2. Verify backups: Dashboard → Database → Backups shows a completed daily backup.
3. **Restore drill** (do once, ~20 min): create a throwaway Supabase project →
   Dashboard → Backups → download → restore via `psql` → open the app pointed
   at it (swap SUPABASE_URL locally) → confirm orders/accounts load → delete
   the throwaway project. Document the date it was done here.
4. Optional belt-and-braces: a weekly `pg_dump` kept off-platform. The schema
   and data are plain Postgres — restorable anywhere, which is the exit
   strategy: self-hosted Supabase accepts this same app unchanged if ever needed.
5. After confirming the new-format API keys everywhere: disable the legacy JWT
   keys (Dashboard → Settings → API).

Restore drill completed: ____________ (date, by Angelo)

## Workflow automations + nightly backup (2026-08-28)

SQL Editor → Run:

```sql
-- dedup memory for the automation rules (service-role only; RLS with no policies)
create table if not exists public.auto_log (
  id bigint generated always as identity primary key,
  rule text not null,
  entity text not null,
  fired_at timestamptz not null default now(),
  unique (rule, entity)
);
alter table public.auto_log enable row level security;
```

The nightly job (2am Manila) now also runs: **backup-background** (full JSON
export of every table → Netlify Blobs, 14 kept; download from the Cutover page
or /.netlify/functions/backup — super admin session required) and
**automations-background** (the nine workflow rules → bell pings + planned
visits, deduped via auto_log). No new env vars — both use JOB_KEY +
SUPABASE_SERVICE_KEY already in Netlify.

## DR numbering series + register pagination (2026-08-28)

SQL Editor → Run:

```sql
-- BIR-friendly document numbering (atomic, race-safe)
create table if not exists public.doc_series (
  kind text primary key,
  prefix text not null default 'DR-',
  next_no bigint not null default 1001,
  pad int not null default 6
);
insert into public.doc_series (kind) values ('dr') on conflict do nothing;
alter table public.doc_series enable row level security;
create policy "series read" on public.doc_series for select to authenticated using (true);
create policy "series write" on public.doc_series for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super));
create policy "series update" on public.doc_series for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super));

-- atomic number assignment (callable by fulfillment roles)
create or replace function public.next_doc_no(k text)
returns text language plpgsql security definer as $$
declare r record;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid()
                 and p.role in ('admin','manager','supply_chain')) then
    raise exception 'not allowed';
  end if;
  update public.doc_series set next_no = next_no + 1 where kind = k
    returning prefix, next_no - 1 as issued, pad into r;
  if r is null then raise exception 'series % not configured', k; end if;
  return r.prefix || lpad(r.issued::text, r.pad, '0');
end $$;

-- permanent DR number on the order
alter table public.orders add column if not exists dr_no text;
```

Register pagination needs no SQL — the register now queries page-by-page
server-side (search on account/specialist/order no.). If the dr_no column is
missing, the register quietly falls back to the old client-side mode.

## Ledger-truth pack: backorders, quarantine, complaints, KPIs (2026-08-28)

SQL Editor → Run:

```sql
-- cycle-time stamp (set automatically by every fulfill path from this deploy)
alter table public.orders add column if not exists fulfilled_at timestamptz;

-- backorders: ATP overrides become tracked shortfalls that auto-release
create table if not exists public.backorders (
  id bigint generated always as identity primary key,
  order_id uuid,
  order_label text,
  account text,
  sku text, name text,
  qty_short int not null,
  status text not null default 'open' check (status in ('open','released','cancelled')),
  created_by uuid,
  created_at timestamptz not null default now(),
  released_at timestamptz
);
alter table public.backorders enable row level security;
create policy "bo read" on public.backorders for select to authenticated using (true);
create policy "bo insert" on public.backorders for insert to authenticated
  with check (auth.uid() = created_by);
create policy "bo update" on public.backorders for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','supply_chain')));

-- quarantine & disposal: the compliance trail for unsellable stock
create table if not exists public.quarantine (
  id bigint generated always as identity primary key,
  sku text not null, name text,
  qty int not null,
  batch text,
  reason text,             -- return / expiry / damage / QA hold
  source_ref text,         -- CM-xxxx etc.
  pulled boolean not null default false,  -- true = removed from ledger on entry
  status text not null default 'held' check (status in ('held','released','disposed')),
  notes text,
  created_by uuid, created_name text,
  created_at timestamptz not null default now(),
  decided_at timestamptz, decided_by text
);
alter table public.quarantine enable row level security;
create policy "quar read" on public.quarantine for select to authenticated using (true);
create policy "quar write" on public.quarantine for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','supply_chain','finance')));
create policy "quar update" on public.quarantine for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','supply_chain')));

-- complaints: quality reports with the batch on record
create table if not exists public.complaints (
  id bigint generated always as identity primary key,
  account text, sku text, batch text,
  description text not null,
  status text not null default 'open' check (status in ('open','investigating','closed')),
  resolution text,
  created_by uuid, created_name text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
alter table public.complaints enable row level security;
create policy "cmp read" on public.complaints for select to authenticated using (true);
create policy "cmp insert" on public.complaints for insert to authenticated
  with check (auth.uid() = created_by);
create policy "cmp update" on public.complaints for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','supply_chain')));
```

In-app manuals need no SQL — manual.mjs checks the session and serves the
role's PDF (bundled via netlify.toml included_files; /manuals/* static paths
are force-redirected through the function so the PDFs are never public).

## Procure-to-pay pack (2026-08-28)

SQL Editor → Run:

```sql
-- Supplier master
create table if not exists public.suppliers (
  id bigint generated always as identity primary key,
  name text not null,
  currency text default 'PHP',
  terms text,
  lead_time_days int,
  contact text, email text, phone text,
  notes text,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.suppliers enable row level security;
create policy "sup read" on public.suppliers for select to authenticated using (true);
create policy "sup write" on public.suppliers for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','supply_chain','finance')));
create policy "sup update" on public.suppliers for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','supply_chain','finance')));

-- Import tracking + multi-currency + landed cost on POs
alter table public.pos add column if not exists etd date;
alter table public.pos add column if not exists customs_status text;
alter table public.pos add column if not exists broker text;
alter table public.pos add column if not exists fx_rate numeric;      -- ₱ per unit of PO currency, at payment
alter table public.pos add column if not exists landed_cost bigint;   -- ₱ freight+customs+brokerage for the whole PO
```

(pos.eta already exists.) Landed cost & valuation needs no further SQL —
it computes from po_lines.unit_cost × fx_rate + landed_cost allocation,
falling back to the item-master cost. Role-scoped Ask AI needs no SQL.

## Transfer orders (2026-08-28)

SQL Editor → Run:

```sql
create table if not exists public.transfers (
  id bigint generated always as identity primary key,
  to_branch text not null,
  status text not null default 'draft' check (status in ('draft','in_transit','delivered')),
  created_by uuid, created_name text,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz, delivered_at timestamptz
);
create table if not exists public.transfer_lines (
  id bigint generated always as identity primary key,
  transfer_id bigint not null references public.transfers(id) on delete cascade,
  sku text not null, name text, qty int not null check (qty > 0), batch text
);
alter table public.transfers enable row level security;
alter table public.transfer_lines enable row level security;
create policy "tr read" on public.transfers for select to authenticated using (true);
create policy "tr write" on public.transfers for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','supply_chain')));
create policy "tr update" on public.transfers for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','supply_chain')));
create policy "tr delete" on public.transfers for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','supply_chain')));
create policy "trl read" on public.transfer_lines for select to authenticated using (true);
create policy "trl write" on public.transfer_lines for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','supply_chain')));
create policy "trl update" on public.transfer_lines for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','supply_chain')));
```

Tiered cadences and next-best-action ride existing tables (accounts.tier +
auto_log). The in-app manual viewer, view-only banners, homepage rework, and
HD icons need no SQL. New icon files: icon-192/512, icon-512-maskable,
apple-touch-icon (white logo on brand blue).

---

## Working the gaps pack (2026-08-28)

Quote chase and birthday/anniversary pings are automation rules only — they run
on the existing `quotes`, `accounts` and `auto_log` tables and need no SQL. The
supplier scorecard reads `pos` / `po_lines` / `suppliers` as they already are.
Only the short-dated queue adds a table.

```sql
-- Short-dated stock queue: one row per lot we've decided something about.
-- The lot list itself comes from live batch data; this table holds the PLAN.
create table if not exists public.shortdated (
  id bigint generated always as identity primary key,
  sku text not null,
  batch text not null default '',   -- '' not null, so the unique key always bites
  name text,
  expiry text,
  qty int,
  plan text not null check (plan in ('discount','foc','transfer','quarantine','accept')),
  owner_tag text,
  target_date date,
  notes text,
  status text not null default 'open' check (status in ('open','done')),
  outcome text,
  created_by uuid,
  created_name text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by text
);
-- one plan per lot — this is the upsert target used by sdPlan (on_conflict sku,batch)
alter table public.shortdated drop constraint if exists shortdated_lot;
alter table public.shortdated add constraint shortdated_lot unique (sku, batch);

alter table public.shortdated enable row level security;
create policy "sd read" on public.shortdated for select to authenticated using (true);
create policy "sd write" on public.shortdated for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
              and p.role in ('admin','supply_chain','manager','marketing')));
create policy "sd update" on public.shortdated for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
         and p.role in ('admin','supply_chain','manager','marketing')));
```

Note: `batch` is `not null default ''` on purpose. If it were nullable, Postgres
would treat every batchless lot as distinct under the unique constraint and the
upsert would keep inserting duplicate plans for the same product.

---

## Accounting integrity pack (2026-08-28)

Four things: a real period close enforced in the database, dated payments,
month-end valuation snapshots, and PO approvals. Plus columns so credit memos
can finally be attributed and dated.

```sql
-- ─────────────────────────────────────────────────────────────────────────
-- 1) PERIOD CLOSE — enforced by triggers, not by the UI.
--    The date itself is app_settings.closed_through ('YYYY-MM-DD'), which is
--    already super-admin-only to write and readable by everyone.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.period_closed(d date) returns boolean
language sql stable as $$
  select coalesce((select nullif(value,'')::date from public.app_settings where key = 'closed_through'),
                  '1900-01-01'::date) >= coalesce(d, '1900-01-01'::date);
$$;

-- super admin bypasses everything; service_role is identified separately
create or replace function public.caller_is_super() returns boolean
language sql stable as $$
  select coalesce((select p.is_super from public.profiles p where p.id = auth.uid()), false);
$$;
create or replace function public.caller_is_service() returns boolean
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (current_setting('request.jwt.claims', true)::json ->> 'role'),
                  '') = 'service_role';
$$;

-- ORDERS: a closed order's revenue facts are frozen, but collections and
-- shipping may still move (a July invoice paid in September is September cash).
create or replace function public.guard_orders_period() returns trigger
language plpgsql as $$
begin
  if public.caller_is_super() then return coalesce(NEW, OLD); end if;

  if TG_OP = 'INSERT' then
    -- the nightly Shopify backfill legitimately imports historical orders
    if public.caller_is_service() then return NEW; end if;
    if public.period_closed(NEW.date) then
      raise exception 'Period closed through the accounting cut-off — an order cannot be dated %. Ask the super admin to reopen the period.', NEW.date;
    end if;
    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    if public.period_closed(OLD.date) then
      raise exception 'Period closed — order dated % cannot be deleted.', OLD.date;
    end if;
    return OLD;
  end if;

  -- moving an OPEN order back into a closed month is also a restatement
  if public.period_closed(NEW.date) and not public.period_closed(OLD.date) then
    raise exception 'Period closed — an order cannot be back-dated to %, inside a signed-off month.', NEW.date;
  end if;

  if public.period_closed(OLD.date) then
    -- fulfilment and reopening are operational and stay open; cancelling or
    -- deleting removes booked revenue from a signed-off month, so they do not.
    if (NEW.status is distinct from OLD.status
        and (NEW.status = 'cancelled' or OLD.status = 'cancelled'))
    or NEW.deleted_at is distinct from OLD.deleted_at then
      raise exception 'Period closed — order dated % cannot be cancelled, restored or deleted. Record a credit memo instead.', OLD.date;
    end if;
    if NEW.date        is distinct from OLD.date
    or NEW.total       is distinct from OLD.total
    or NEW.account     is distinct from OLD.account
    or NEW.spec        is distinct from OLD.spec
    or NEW.terms_days  is distinct from OLD.terms_days then
      raise exception 'Period closed — order dated % is frozen. Payments, shipping, fulfilment and DR numbers still work; amounts, dates and ownership do not.', OLD.date;
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_orders_period on public.orders;
create trigger trg_orders_period before insert or update or delete on public.orders
  for each row execute function public.guard_orders_period();

-- ORDER LINES: inherit the parent order's period. No service_role exemption —
-- if the backfill ever tries to rewrite a closed order's lines we want it to
-- fail loudly in the job log rather than quietly restate a signed-off month.
create or replace function public.guard_order_lines_period() returns trigger
language plpgsql as $$
declare d date;
begin
  if public.caller_is_super() then return coalesce(NEW, OLD); end if;
  select o.date into d from public.orders o where o.id = coalesce(NEW.order_id, OLD.order_id);
  if d is not null and public.period_closed(d) then
    raise exception 'Period closed — the lines of an order dated % are frozen.', d;
  end if;
  return coalesce(NEW, OLD);
end $$;

drop trigger if exists trg_order_lines_period on public.order_lines;
create trigger trg_order_lines_period before insert or update or delete on public.order_lines
  for each row execute function public.guard_order_lines_period();

-- ─────────────────────────────────────────────────────────────────────────
-- 2) DATED PAYMENTS — cash needs its own period. Until now a payment was just
--    an increment to orders.paid with no date at all, so "collections in
--    August" was unanswerable. orders.paid/balance stay the rollup (the
--    Shopify sync still owns them); this is the dated detail, append-only.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,   -- orders.id is uuid
  order_label text,
  account text,
  amount bigint not null check (amount <> 0),
  date date not null default current_date,
  method text,
  ref text,
  note text,
  created_by uuid,
  created_name text,
  created_at timestamptz not null default now()
);
create index if not exists payments_date on public.payments (date);
create index if not exists payments_order on public.payments (order_id);

alter table public.payments enable row level security;
drop policy if exists "pay read" on public.payments;
create policy "pay read" on public.payments for select to authenticated using (true);
drop policy if exists "pay write" on public.payments;
create policy "pay write" on public.payments for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
              and (p.role in ('admin','finance'))));
-- no update/delete policy: payments are append-only, like the stock ledger.
-- A wrong payment is corrected with an offsetting negative row.

create or replace function public.guard_payments_period() returns trigger
language plpgsql as $$
begin
  if public.caller_is_super() then return NEW; end if;
  if public.period_closed(NEW.date) then
    raise exception 'Period closed — a payment cannot be dated %.', NEW.date;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_payments_period on public.payments;
create trigger trg_payments_period before insert on public.payments
  for each row execute function public.guard_payments_period();

-- ─────────────────────────────────────────────────────────────────────────
-- 3) CREDIT MEMOS get a date and an owner, so they can be netted by period
--    and attributed to a specialist. shopify_refunded marks CMs that were
--    ALSO refunded in Shopify during the parallel run — those are already
--    netted upstream and must not be deducted twice.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.returns add column if not exists date date not null default current_date;
alter table public.returns add column if not exists spec text;
alter table public.returns add column if not exists shopify_refunded boolean not null default false;
create index if not exists returns_date on public.returns (date);

create or replace function public.guard_returns_period() returns trigger
language plpgsql as $$
begin
  if public.caller_is_super() then return coalesce(NEW, OLD); end if;
  if TG_OP = 'DELETE' then
    if public.period_closed(OLD.date) then
      raise exception 'Period closed — a credit memo dated % cannot be deleted.', OLD.date;
    end if;
    return OLD;
  end if;
  if TG_OP = 'UPDATE' then
    -- marking a CM applied to an order balance is a collections act, allowed;
    -- changing its money, date or attribution is not
    if NEW.amount is distinct from OLD.amount
    or NEW.date   is distinct from OLD.date
    or NEW.spec   is distinct from OLD.spec
    or NEW.action is distinct from OLD.action then
      if public.period_closed(OLD.date) then
        raise exception 'Period closed — credit memo dated % is frozen.', OLD.date;
      end if;
    end if;
    return NEW;
  end if;
  if public.period_closed(coalesce(NEW.date, current_date)) then
    raise exception 'Period closed — a credit memo cannot be dated %.', NEW.date;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_returns_period on public.returns;
create trigger trg_returns_period before insert or update or delete on public.returns
  for each row execute function public.guard_returns_period();

-- PDCs: a cheque maturing inside a closed period is part of that period.
create or replace function public.guard_pdcs_period() returns trigger
language plpgsql as $$
begin
  if public.caller_is_super() then return coalesce(NEW, OLD); end if;
  if TG_OP = 'DELETE' and public.period_closed(OLD.maturity) then
    raise exception 'Period closed — a cheque maturing % cannot be deleted.', OLD.maturity;
  end if;
  if TG_OP = 'INSERT' and public.period_closed(NEW.maturity) then
    raise exception 'Period closed — a cheque cannot be entered with maturity %.', NEW.maturity;
  end if;
  -- status changes (deposited/cleared/bounced) are collections and stay open;
  -- the amount and maturity of a cheque inside a closed period do not
  if TG_OP = 'UPDATE' and public.period_closed(OLD.maturity)
     and (NEW.amount is distinct from OLD.amount or NEW.maturity is distinct from OLD.maturity) then
    raise exception 'Period closed — cheque maturing % is frozen (status may still change).', OLD.maturity;
  end if;
  return coalesce(NEW, OLD);
end $$;
drop trigger if exists trg_pdcs_period on public.pdcs;
create trigger trg_pdcs_period before insert or update or delete on public.pdcs
  for each row execute function public.guard_pdcs_period();

-- ORDER OVERRIDES: status/trash for MIGRATED Shopify orders lives here, keyed by
-- the Shopify order number. Without this trigger a closed-period Shopify order
-- could still be cancelled or trashed — the same restatement by another door.
create or replace function public.guard_overrides_period() returns trigger
language plpgsql as $$
declare d date;
begin
  if public.caller_is_super() then return coalesce(NEW, OLD); end if;
  select o.date into d from public.orders o
   where o.ext_ref = coalesce(NEW.ref, OLD.ref) limit 1;
  if d is not null and public.period_closed(d) then
    if TG_OP = 'DELETE'
    or coalesce(NEW.status,'') = 'cancelled'
    or NEW.deleted_at is not null then
      raise exception 'Period closed — order dated % cannot be cancelled or trashed. Record a credit memo instead.', d;
    end if;
  end if;
  return coalesce(NEW, OLD);
end $$;
drop trigger if exists trg_overrides_period on public.order_overrides;
create trigger trg_overrides_period before insert or update or delete on public.order_overrides
  for each row execute function public.guard_overrides_period();

-- Targets for a closed month drive historical attainment and commission.
create or replace function public.guard_targets_period() returns trigger
language plpgsql as $$
declare d date;
begin
  if public.caller_is_super() then return coalesce(NEW, OLD); end if;
  d := (coalesce(NEW.month, OLD.month) || '-01')::date;
  if public.period_closed(d) then
    raise exception 'Period closed — the target for % is frozen.', coalesce(NEW.month, OLD.month);
  end if;
  return coalesce(NEW, OLD);
end $$;
drop trigger if exists trg_targets_period on public.spec_targets;
create trigger trg_targets_period before insert or update or delete on public.spec_targets
  for each row execute function public.guard_targets_period();

-- ─────────────────────────────────────────────────────────────────────────
-- 4) MONTH-END VALUATION SNAPSHOTS — inventory value is currently recomputed
--    from today's costs and today's stock, so "value at 31 July" changes every
--    time a cost is edited. Freezing it makes the number permanent.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.valuation_snapshots (
  id bigint generated always as identity primary key,
  month text not null unique,          -- 'YYYY-MM'
  taken_at timestamptz not null default now(),
  taken_by text,
  basis text,                          -- 'ledger' | 'sheet' — which stock truth was live
  total_value bigint not null default 0,
  total_units bigint not null default 0,
  sku_count int not null default 0,
  lines jsonb                          -- per-SKU [{sku,name,units,cost,value}]
);
alter table public.valuation_snapshots enable row level security;
-- it is a costs artefact: same audience as the valuation page
drop policy if exists "vsnap read" on public.valuation_snapshots;
create policy "vsnap read" on public.valuation_snapshots for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid()
         and (p.role in ('admin','finance'))));
drop policy if exists "vsnap write" on public.valuation_snapshots;
create policy "vsnap write" on public.valuation_snapshots for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid()
              and (p.role in ('admin','finance'))));
-- re-freezing a month is a super-admin act (the unique index blocks a second insert)
drop policy if exists "vsnap update" on public.valuation_snapshots;
create policy "vsnap update" on public.valuation_snapshots for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super));

-- ─────────────────────────────────────────────────────────────────────────
-- 5) PO APPROVALS — sales orders have a spending gate; purchasing had none.
--    Threshold lives in app_settings.po_approval_threshold.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.pos add column if not exists approved boolean not null default false;
alter table public.pos add column if not exists awaiting_approval boolean not null default false;
alter table public.approvals drop constraint if exists approvals_kind_check;
alter table public.approvals add constraint approvals_kind_check
  check (kind in ('credit','threshold','po'));
alter table public.approvals add column if not exists po_id bigint references public.pos(id);

-- IMPORTANT one-off: every existing credit memo was stamped with today's date by
-- the DEFAULT above. Put them back on the day they were recorded, or this month's
-- commissions will be netted against the entire CM history.
update public.returns set date = created_at::date where date = current_date;
```

Set the cut-off from the Cutover page (super admin): **Period close → set
closed-through date**. Everything dated on or before it freezes. Reopening is
the same control — set an earlier date, or blank to disable. Every attempt to
write into a closed period raises a database error with the reason, so a
client-side bug cannot quietly restate a signed-off month.

One deliberate asymmetry: the nightly Shopify backfill (service key) may still
INSERT historical orders into a closed period — it is importing facts, not
changing them — but it may not rewrite an existing closed order's amounts,
dates or lines. `backfill-background.mjs` sends payment/shipment fields only for
those orders, and the trigger is the backstop if that logic ever regresses.

---

## Inventory pull-outs (2026-08-28)

Replaces the Google form. A pull-out is stock leaving the warehouse for internal
use — KOL engagements, campaigns, FOC promos, trade partnerships, launches and
training — charged to a department's fund source (QBO class). Requesting
**reserves** the units so nobody sells them; the warehouse **releases** them,
which is when the stock ledger actually moves.

```sql
-- Fund sources (QBO classes) and who approves each one. Editable by admin, so
-- an approver can be someone whose HQ role is otherwise read-only.
create table if not exists public.fund_sources (
  class text primary key,                 -- 'SALES', 'PRODUCT MARKETING', ...
  sort int not null default 0,
  approver_id uuid,                       -- profiles.id
  approver_name text,
  backup_id uuid,                         -- optional second decider
  backup_name text,
  active boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.fund_sources (class, sort) values
  ('SALES',1), ('PRODUCT MARKETING',2), ('DIGITAL MARKETING',3),
  ('SUPPLY CHAIN MANAGEMENT',4), ('FINANCE',5), ('PEOPLE OPS',6),
  ('IT',7), ('EXECUTIVE',8)
on conflict (class) do nothing;

alter table public.fund_sources enable row level security;
drop policy if exists "fs read" on public.fund_sources;
create policy "fs read" on public.fund_sources for select to authenticated using (true);
drop policy if exists "fs write" on public.fund_sources;
create policy "fs write" on public.fund_sources for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "fs update" on public.fund_sources;
create policy "fs update" on public.fund_sources for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- The request itself. Numbered PL-1000+ for paper.
create table if not exists public.pullouts (
  id bigint generated always as identity primary key,
  requester_id uuid,
  requester_name text,
  requester_email text,
  date_requested date not null default current_date,
  date_needed date,
  product_line text,
  reason text,                            -- one of the five reasons
  fund_class text not null references public.fund_sources(class),
  purpose text,                           -- free text: the event, the KOL, the account
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','released','cancelled')),
  approver_name text,
  decided_at timestamptz,
  decision_note text,
  released_at timestamptz,
  released_by text,
  booked_ref text,                        -- Shopify order / native order once booked
  created_at timestamptz not null default now()
);
create index if not exists pullouts_status on public.pullouts (status);
create index if not exists pullouts_class on public.pullouts (fund_class);

create table if not exists public.pullout_lines (
  id bigint generated always as identity primary key,
  pullout_id bigint not null references public.pullouts(id) on delete cascade,
  sku text not null,
  name text,
  qty int not null check (qty > 0),
  uom text,
  released_qty int not null default 0,
  batch text
);
create index if not exists pullout_lines_po on public.pullout_lines (pullout_id);

alter table public.pullouts enable row level security;
alter table public.pullout_lines enable row level security;

-- Anyone signed in may request and may read (the fund-source approval is the control)
drop policy if exists "pl read" on public.pullouts;
create policy "pl read" on public.pullouts for select to authenticated using (true);
drop policy if exists "pl write" on public.pullouts;
create policy "pl write" on public.pullouts for insert to authenticated
  with check (auth.uid() = requester_id);
-- Deciding / releasing / cancelling: the mapped approver or backup for that class,
-- the warehouse and finance (release + booking), admins, and the requester
-- (their own request, while it is still pending — i.e. cancelling it).
drop policy if exists "pl update" on public.pullouts;
create policy "pl update" on public.pullouts for update to authenticated
using (
  exists (select 1 from public.fund_sources f where f.class = fund_class
          and (f.approver_id = auth.uid() or f.backup_id = auth.uid()))
  or exists (select 1 from public.profiles p where p.id = auth.uid()
             and p.role in ('admin','supply_chain','finance','manager','sales'))
  or (requester_id = auth.uid() and status = 'pending')
)
-- WITH CHECK is required: without it Postgres re-applies USING to the NEW row,
-- so a requester cancelling their own pending request (status → 'cancelled')
-- would fail its own policy.
with check (
  exists (select 1 from public.fund_sources f where f.class = fund_class
          and (f.approver_id = auth.uid() or f.backup_id = auth.uid()))
  or exists (select 1 from public.profiles p where p.id = auth.uid()
             and p.role in ('admin','supply_chain','finance','manager','sales'))
  or requester_id = auth.uid()
);

drop policy if exists "pll read" on public.pullout_lines;
create policy "pll read" on public.pullout_lines for select to authenticated using (true);
drop policy if exists "pll write" on public.pullout_lines;
create policy "pll write" on public.pullout_lines for insert to authenticated
  with check (exists (select 1 from public.pullouts p where p.id = pullout_id and p.requester_id = auth.uid()));
drop policy if exists "pll update" on public.pullout_lines;
create policy "pll update" on public.pullout_lines for update to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','supply_chain'))
);
drop policy if exists "pll delete" on public.pullout_lines;
create policy "pll delete" on public.pullout_lines for delete to authenticated using (
  exists (select 1 from public.pullouts p where p.id = pullout_id
          and p.requester_id = auth.uid() and p.status = 'pending')
);

```

The approver picker reads the roster through the existing `admin-users` function
(service-role, already admin-verified) rather than querying `profiles` directly —
`profiles` is own-row-only on select, so a direct query would have listed only
the admin themselves. No extra RLS policy is needed.

Set each class's approver in **Pull-out requests → fund sources** (admin only).
Until a class has an approver, its requests sit unrouted and the page says so.

---

## Numbering settings + super-admin archive (2026-08-28)

```sql
-- ─────────────────────────────────────────────────────────────────────────
-- 1) DOCUMENT NUMBER FORMATS — one place for every number the app prints.
--    Numbers are still generated from the row's own identity; this controls
--    how they are FORMATTED (prefix, padding, and the number the series
--    appears to start at). Changing a format changes how existing documents
--    display, so it is a super-admin setting. Permanent DR numbers already
--    written onto orders are NOT affected — those are stored, not derived.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.doc_formats (
  kind text primary key,          -- order | quote | cm | pullout | po | transfer
  label text not null,
  prefix text not null default '',
  pad int not null default 0,     -- 0 = no zero padding
  offset_no int not null default 1000,  -- displayed number = offset + row id
  sort int not null default 0
);
insert into public.doc_formats (kind,label,prefix,pad,offset_no,sort) values
  ('order','Sales orders','HS-',0,1000,1),
  ('quote','Quotations','QT-',4,0,2),   -- historically QT-0007: pad 4, no offset
  ('cm','Credit memos','CM-',0,1000,3),
  ('pullout','Pull-outs','PL-',0,1000,4),
  ('po','Purchase orders','PO-',0,1000,5),
  ('transfer','Transfer orders','TR-',0,1000,6),
  ('complaint','Complaints','C-',0,0,7)   -- historically C-1, C-2: no offset
on conflict (kind) do nothing;

alter table public.doc_formats enable row level security;
drop policy if exists "df read" on public.doc_formats;
create policy "df read" on public.doc_formats for select to authenticated using (true);
drop policy if exists "df write" on public.doc_formats;
create policy "df write" on public.doc_formats for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super));

-- ─────────────────────────────────────────────────────────────────────────
-- 2) ARCHIVE BIN — the super admin can delete anything, but nothing
--    evaporates on the first click. Deleting copies the row (and its child
--    rows) here as JSON and removes the original; the Archive page can
--    restore it or purge it for good, each behind its own confirmation.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.archive_bin (
  id bigint generated always as identity primary key,
  src_table text not null,
  src_id text not null,
  label text,                     -- what it was called on screen: HS-1042, PL-1007
  summary text,                   -- a human line so the bin is readable
  payload jsonb not null,         -- {row:{...}, children:{table:[...]}}
  reason text,
  archived_by uuid,
  archived_name text,
  archived_at timestamptz not null default now(),
  restored_at timestamptz,
  restored_by text
);
create index if not exists archive_bin_at on public.archive_bin (archived_at desc);
create index if not exists archive_bin_src on public.archive_bin (src_table, src_id);

alter table public.archive_bin enable row level security;
-- the bin can hold anything, including costs and customer data: super admin only
drop policy if exists "bin read" on public.archive_bin;
create policy "bin read" on public.archive_bin for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super));
drop policy if exists "bin write" on public.archive_bin;
create policy "bin write" on public.archive_bin for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super));
drop policy if exists "bin update" on public.archive_bin;
create policy "bin update" on public.archive_bin for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super));
drop policy if exists "bin purge" on public.archive_bin;
create policy "bin purge" on public.archive_bin for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super));
```

Deleting requires typing the record's number, restoring re-inserts it (child
rows get re-pointed at the restored parent), and purging asks again. Every step
is written to the Activity log. The archive is also in the nightly backup, so a
purge is still recoverable from the previous night's snapshot.

---

## Attachments (2026-08-28)

Files live in a Google Shared Drive (see ATTACHMENTS-SETUP.md); Supabase keeps
only the pointer. Reading a file goes through the `upload` function, so HQ's own
permissions decide who can see it — not who happens to have Drive access.

```sql
create table if not exists public.attachments (
  id bigint generated always as identity primary key,
  rec_type text not null,         -- 'pullout' | 'visit' | 'account' | 'voucher' | ...
  rec_id text not null,           -- the record's id, as text (ids are bigint or uuid)
  file_id text not null,          -- Google Drive file id
  name text not null,
  mime text,
  size bigint,
  note text,
  uploaded_by uuid,
  uploaded_name text,
  created_at timestamptz not null default now()
);
create index if not exists attachments_rec on public.attachments (rec_type, rec_id);

alter table public.attachments enable row level security;
-- Anyone signed in may see that a document exists and open it: these are
-- company records (quotations, receipts, DRs), and the pages that show them
-- are already role-gated. Cost figures are not stored here.
drop policy if exists "att read" on public.attachments;
-- receipts and bank approvals hang off finance requests, so those follow the
-- request's own visibility; everything else (pull-outs, visits) stays open.
create policy "att read" on public.attachments for select to authenticated using (
  rec_type not in ('voucher','orderpay','proofpay','replenish','reimburse','cashadvance')
  or exists (select 1 from public.fin_requests q where q.id::text = attachments.rec_id
             and (q.requester_id = auth.uid()
                  or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role in ('admin','finance') or p.is_super))
                  or exists (select 1 from public.approval_routes r where r.kind = q.kind and r.active
                             and (r.approver_id = auth.uid()
                                  or (r.approver_role is not null and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = r.approver_role))
                                  or (r.use_fund_source and exists (select 1 from public.fund_sources f where f.class = q.fund_class
                                       and (f.approver_id = auth.uid() or f.backup_id = auth.uid())))))))
);
drop policy if exists "att write" on public.attachments;
create policy "att write" on public.attachments for insert to authenticated
  with check (auth.uid() = uploaded_by);
-- remove your own, or any if you manage the area
drop policy if exists "att delete" on public.attachments;
create policy "att delete" on public.attachments for delete to authenticated using (
  uploaded_by = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid()
             and p.role in ('admin','finance','supply_chain'))
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) SUPER-ADMIN DELETE + RESTORE POLICIES
--    Without these the archive silently does nothing: RLS filters the DELETE
--    to zero rows, PostgREST returns success, and the app reports a delete
--    that never happened. Restoring needs matching inserts, because the
--    restored row keeps its ORIGINAL owner (created_by / requester_id), which
--    the normal "you may only insert your own" policies would reject.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['pullouts','pullout_lines','shortdated','quotes','quote_lines',
                           'pos','po_lines','returns','complaints','quarantine','visits',
                           'opportunities','approvals','fund_sources','transfer_lines',
                           'transfers','promos','pdcs','campaigns','payments',
                           'valuation_snapshots','attachments','fin_requests','fin_lines',
                           'code_lists','approval_routes']
  loop
    execute format('drop policy if exists "super deletes" on public.%I', t);
    execute format($f$create policy "super deletes" on public.%I for delete to authenticated
      using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super))$f$, t);
    execute format('drop policy if exists "super restores" on public.%I', t);
    execute format($f$create policy "super restores" on public.%I for insert to authenticated
      with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super))$f$, t);
  end loop;
end $$;
```


---

## Finance forms (2026-08-28)

Six Google forms become one engine: `fin_requests` + `fin_lines`, driven by a
form spec in the app. Routing is per form (`approval_routes`), and the option
lists finance keeps changing — event codes, cash-flow tags — live in
`code_lists` rather than in code.

```sql
-- ── the option lists finance owns ──────────────────────────────────────────
create table if not exists public.code_lists (
  id bigint generated always as identity primary key,
  list text not null,               -- 'event_code' | 'cashflow_tag' | 'replenish_type' | ...
  code text not null,
  label text,
  sort int not null default 0,
  active boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (list, code)
);
create index if not exists code_lists_list on public.code_lists (list, active, sort);

alter table public.code_lists enable row level security;
drop policy if exists "cl read" on public.code_lists;
create policy "cl read" on public.code_lists for select to authenticated using (true);
drop policy if exists "cl write" on public.code_lists;
create policy "cl write" on public.code_lists for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','finance')));
drop policy if exists "cl update" on public.code_lists;
create policy "cl update" on public.code_lists for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','finance')));

-- ── who signs off, per form and per step ───────────────────────────────────
create table if not exists public.approval_routes (
  id bigint generated always as identity primary key,
  kind text not null,               -- 'voucher' | 'orderpay' | ...
  step int not null default 1,      -- 1, then 2, … in order
  label text,                       -- 'Fund source', 'Finance countersign'
  approver_id uuid,                 -- a named person …
  approver_name text,
  approver_role text,               -- … or any holder of a role
  use_fund_source boolean not null default false,  -- … or the request's own fund source
  min_amount bigint not null default 0,            -- step only applies at/above this
  active boolean not null default true,
  unique (kind, step)
);
alter table public.approval_routes enable row level security;
drop policy if exists "ar read" on public.approval_routes;
create policy "ar read" on public.approval_routes for select to authenticated using (true);
drop policy if exists "ar write" on public.approval_routes;
create policy "ar write" on public.approval_routes for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "ar update" on public.approval_routes;
create policy "ar update" on public.approval_routes for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "ar delete" on public.approval_routes;
create policy "ar delete" on public.approval_routes for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ── the requests themselves ────────────────────────────────────────────────
create table if not exists public.fin_requests (
  id bigint generated always as identity primary key,
  num bigint generated always as identity,
  kind text not null check (kind in ('voucher','orderpay','proofpay','replenish','reimburse','cashadvance')),
  requester_id uuid,
  requester_name text,
  requester_email text,
  date_requested date not null default current_date,
  date_needed date,
  fund_class text,
  event_code text,
  cashflow_tag text,
  product_line text,
  team text,
  payee text,
  amount bigint not null default 0,
  currency text not null default 'PHP',
  purpose text,
  data jsonb not null default '{}'::jsonb,   -- the form's own fields
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled','settled')),
  step int not null default 1,               -- which approval step it is waiting on
  decisions jsonb not null default '[]'::jsonb, -- [{step,by,name,at,decision,note}]
  decision_note text,
  ref_no text,                               -- voucher no. / PO no. / previous request
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists fin_requests_kind on public.fin_requests (kind, status);
create index if not exists fin_requests_who on public.fin_requests (requester_id);

create table if not exists public.fin_lines (
  id bigint generated always as identity primary key,
  req_id bigint not null references public.fin_requests(id) on delete cascade,
  seq int not null default 1,
  description text,
  qty numeric,
  amount bigint,
  meta jsonb not null default '{}'::jsonb    -- supplier, link, unit, etc.
);
create index if not exists fin_lines_req on public.fin_lines (req_id);

alter table public.fin_requests enable row level security;
alter table public.fin_lines enable row level security;

-- These carry bank details, payslip-adjacent claims and supplier terms, so the
-- register is NOT world-readable inside the company: you see your own, ones you
-- must decide, and finance/admin see everything.
drop policy if exists "fr read" on public.fin_requests;
create policy "fr read" on public.fin_requests for select to authenticated using (
  requester_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role in ('admin','finance') or p.is_super))
  or exists (select 1 from public.approval_routes r where r.kind = fin_requests.kind and r.active
             and (r.approver_id = auth.uid()
                  or (r.approver_role is not null and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = r.approver_role))
                  or (r.use_fund_source and exists (select 1 from public.fund_sources f where f.class = fin_requests.fund_class
                       and (f.approver_id = auth.uid() or f.backup_id = auth.uid())))))
);
drop policy if exists "fr write" on public.fin_requests;
create policy "fr write" on public.fin_requests for insert to authenticated
  with check (auth.uid() = requester_id);

-- Deciding is limited to the approver of the step the request is ACTUALLY on
-- (r.step = fin_requests.step) — otherwise a step-2 approver could reach past
-- step 1 and approve outright. The requester keeps one power only: cancelling
-- their own request, enforced by the WITH CHECK, not by hiding a button.
drop policy if exists "fr update" on public.fin_requests;
create policy "fr update" on public.fin_requests for update to authenticated
using (
  exists (select 1 from public.approval_routes r where r.kind = fin_requests.kind and r.active
          and r.step = fin_requests.step
          and (r.approver_id = auth.uid()
               or (r.approver_role is not null and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = r.approver_role))
               or (r.use_fund_source and exists (select 1 from public.fund_sources f where f.class = fin_requests.fund_class
                    and (f.approver_id = auth.uid() or f.backup_id = auth.uid())))))
  or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role in ('admin','finance') or p.is_super))
  or (requester_id = auth.uid() and status = 'pending')
)
with check (
  exists (select 1 from public.approval_routes r where r.kind = fin_requests.kind and r.active
          and (r.approver_id = auth.uid()
               or (r.approver_role is not null and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = r.approver_role))
               or (r.use_fund_source and exists (select 1 from public.fund_sources f where f.class = fin_requests.fund_class
                    and (f.approver_id = auth.uid() or f.backup_id = auth.uid())))))
  or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role in ('admin','finance') or p.is_super))
  or (requester_id = auth.uid() and status = 'cancelled')   -- cancel, and nothing else
);

drop policy if exists "fl read" on public.fin_lines;
create policy "fl read" on public.fin_lines for select to authenticated using (true);
drop policy if exists "fl write" on public.fin_lines;
create policy "fl write" on public.fin_lines for insert to authenticated
  with check (exists (select 1 from public.fin_requests q where q.id = req_id and q.requester_id = auth.uid()));
drop policy if exists "fl update" on public.fin_lines;
create policy "fl update" on public.fin_lines for update to authenticated using (
  exists (select 1 from public.fin_requests q where q.id = req_id
          and q.requester_id = auth.uid() and q.status = 'pending')
  or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role in ('admin','finance') or p.is_super))
);
drop policy if exists "fl delete" on public.fin_lines;
create policy "fl delete" on public.fin_lines for delete to authenticated using (
  exists (select 1 from public.fin_requests q where q.id = req_id
          and q.requester_id = auth.uid() and q.status = 'pending')
  or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role in ('admin','finance') or p.is_super))
);

-- ── document numbers for the new forms ─────────────────────────────────────
insert into public.doc_formats (kind,label,prefix,pad,offset_no,sort) values
  ('voucher','Vouchers','V-',0,1000,10),
  ('orderpay','Requests to order/pay','RO-',0,1000,11),
  ('proofpay','Proofs of payment','PP-',0,1000,12),
  ('replenish','Replenishments','RP-',0,1000,13),
  ('reimburse','Reimbursements','RE-',0,1000,14),
  ('cashadvance','Cash advances','CA-',0,1000,15)
on conflict (kind) do nothing;

-- ── default routes: every form goes to its fund source, then finance ───────
insert into public.approval_routes (kind,step,label,use_fund_source,approver_role,min_amount) values
  ('voucher',1,'Fund source',true,null,0),
  ('voucher',2,'Finance',false,'finance',0),
  ('orderpay',1,'Fund source',true,null,0),
  ('orderpay',2,'Finance',false,'finance',0),
  ('proofpay',1,'Finance',false,'finance',0),
  ('replenish',1,'Finance',false,'finance',0),
  ('reimburse',1,'People Ops / manager',false,'manager',0),
  ('reimburse',2,'Finance',false,'finance',0),
  ('cashadvance',1,'Fund source',true,null,0),
  ('cashadvance',2,'Finance',false,'finance',0)
on conflict (kind,step) do nothing;

-- ── seed the option lists from the Google forms ────────────────────────────
insert into public.code_lists (list,code,sort) values
  ('event_code','T2 KOL Management',1),('event_code','SI 3: Local Conventions',2),
  ('event_code','T2 Machine Specialist Marketing revolving fund',3),
  ('event_code','T2 Patient Safety Assurance Program',4),('event_code','T2 Quarterly Product Awards',5),
  ('event_code','T2 Amplify Patient Demand through Clinic Focused Marketing support',6),
  ('event_code','T2 Brand Awareness',7),('event_code','Healthspan Awards',8),
  ('event_code','T2 VIP Event',9),('event_code','T2 Referral Advantage Program',10),
  ('event_code','FOC Skinpen Kits',11),('event_code','FOC Biocellulose masks',12),
  ('event_code','FOC Symmed / Neutra',13),('event_code','FOC Zionic Conducting Cream',14),
  ('event_code','Skinpen Champion Program',15),('event_code','VIP In Clinic launch event',16),
  ('event_code','Skinpen Biome Boosted program',17),('event_code','Termosalud Experts Summit',18),
  ('event_code','Skinpen Promotional Materials',19),('event_code','Termosalud Promotional Materials',20),
  ('event_code','Healthspan CME Sponsorship',21),('event_code','Healthspan Roadshow',22),
  ('event_code','KAM New Drs Training Belo',23),('event_code','T2 Marketing Manager Engagement Budget',24),
  ('event_code','KOL Engagement',25),('event_code','SI 1: Masterclass - GMA',26),
  ('event_code','SI 1: Masterclass - Luzon',27),('event_code','SI 1: Masterclass - Visayas',28),
  ('event_code','SI 1: Masterclass - Mindanao',29),('event_code','SI 1: Masterclass - Contingency',30),
  ('event_code','SI 1: Spain Training 2027',31),('event_code','SI 2: Bidens Starter Kit',32),
  ('event_code','SI 2: Bidens Promo Bundle',33),('event_code','SI 2: Inno-TDS Promo Bundle',34),
  ('event_code','SI 2: Return and Renew Program',35),('event_code','SI 3: Aivee Bidens Exclusive Launch',36),
  ('event_code','SI 3: Innoaesthetics Plaque Provider',37),('event_code','SI 3: Innoaesthetics Awarding',38),
  ('event_code','SI 3: Digital Program',39),('event_code','Key Accounts Program - Belo Medical Group',40),
  ('event_code','2025 Budget - Accrual',41)
on conflict (list,code) do nothing;

insert into public.code_lists (list,code,sort) values
  ('cashflow_tag','Advances to employees',1),('cashflow_tag','BOC',2),
  ('cashflow_tag','Business Taxes and Licenses',3),('cashflow_tag','Courier',4),
  ('cashflow_tag','Event',5),('cashflow_tag','Executives',6),('cashflow_tag','Fuel',7),
  ('cashflow_tag','Honorarium',8),('cashflow_tag','Intercompany remittance - Remedy',9),
  ('cashflow_tag','Intercompany Remittance - Cosimo',10),('cashflow_tag','Inventory',11),
  ('cashflow_tag','Investment purchase',12),('cashflow_tag','Leasehold Improvements',13),
  ('cashflow_tag','Loan repayment',14),('cashflow_tag','Marketing',15),
  ('cashflow_tag','Medify - Disbursement',16),('cashflow_tag','Miscellaneous',17),
  ('cashflow_tag','Office Expenses',18),('cashflow_tag','Opex',19),
  ('cashflow_tag','Outsourced Services',20),('cashflow_tag','Other Licenses',21),
  ('cashflow_tag','Paul Reim',22),('cashflow_tag','PCF',23),('cashflow_tag','People Ops',24),
  ('cashflow_tag','Purchase of PPE',25),('cashflow_tag','Rebates',26),('cashflow_tag','Refund',27),
  ('cashflow_tag','Rent',28),('cashflow_tag','Rev fund',29),('cashflow_tag','Shipping',30),
  ('cashflow_tag','Supplies & Consumables',31),('cashflow_tag','Travel & Accom',32),
  ('cashflow_tag','Utilities',33),('cashflow_tag','Intercompany Remittance - Tihrse',34),
  ('cashflow_tag','Car Reim',35)
on conflict (list,code) do nothing;

insert into public.code_lists (list,code,sort) values
  ('product_line','Inno',1),('product_line','Skinpen / Biojuve',2),('product_line','Termosalud',3),
  ('product_line','MarkVu',4),('product_line','GTG',5),('product_line','Mesoestetic',6),('product_line','All',7),
  ('replenish_type','Borzo',1),('replenish_type','Petty Cash',2),('replenish_type','LBC Pad',3),('replenish_type','Lalamove',4),
  ('reimburse_type','Car Reimbursement',1),('reimburse_type','Healthspan Other Expense',2),('reimburse_type','Remedy Other Expense',3),
  ('car_type','Preventive Maintenance Services (PMS)',1),('car_type','Parts Replacements (Car battery/tires)',2),
  ('car_type','Change oil',3),('car_type','Car Insurance',4),
  ('pay_mode','Bank transfer via PNB',1),('pay_mode','Bank transfer via UnionBank',2),
  ('pay_mode','Check Payment',3),('pay_mode','Cash Advance c/o Finance',4),
  ('team','Sales',1),('team','Product Marketing',2),('team','Digital Marketing',3),('team','Logistics',4),
  ('team','Finance',5),('team','IT',6),('team','Executives',7),('team','People Ops',8)
on conflict (list,code) do nothing;
```
