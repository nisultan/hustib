-- ---------------------------------------------------------------------------
-- Adds the journal to a database that already has schema.sql.
--
-- schema.sql is written to build the whole database from nothing, so running
-- it a second time fails on the first thing that already exists — the enum
-- types, before it ever reaches anything new. This file adds only what the
-- journal needs, and is safe to run more than once.
-- ---------------------------------------------------------------------------

create table if not exists days (
  user_id     uuid not null references auth.users on delete cascade,
  date        date not null,
  -- Kilograms. numeric, not float: 72.4 should come back as 72.4.
  weight      numeric(5, 2),
  reflection  jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, date),
  constraint weight_is_plausible check (weight is null or (weight > 0 and weight < 700))
);

-- The journal reads newest first, and the weight chart scans a date range.
create index if not exists days_user_date_idx on days (user_id, date desc);

-- Defaulting user_id means client inserts never send it, and the policy below
-- rejects any row that tries to claim another account.
alter table days alter column user_id set default auth.uid();

alter table days enable row level security;
alter table days force row level security;

drop policy if exists days_owner on days;
create policy days_owner on days
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
