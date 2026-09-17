-- ---------------------------------------------------------------------------
-- Goals
--
-- Not a task and not a habit. A task is finished by doing it once, a habit by
-- doing it repeatedly; a goal is what both of those are for, and it is usually
-- too big to tick.
--
-- The picture is a data URL in a text column rather than a file in storage.
-- The rest of the hub is already encrypted on the student's device and synced
-- as rows, and a bucket would be the one part of it living somewhere else with
-- its own lifecycle and its own way to leak. The client downscales hard before
-- anything is sent.
--
-- Safe to run against an older database, and the app treats the table as
-- optional, so a database that has not run this still loads.
-- ---------------------------------------------------------------------------

create table if not exists goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  title        text not null,
  note         text not null default '',
  image        text,
  -- Optional: plenty of what matters has no date, and inventing one to satisfy
  -- a column turns an ambition into an overdue item.
  deadline     date,
  priority     task_priority not null default 'medium',
  status       text not null default 'active',
  -- Null when the student is not tracking it as a percentage.
  progress     smallint,
  category_id  uuid references categories on delete set null,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  achieved_at  date,
  constraint title_is_not_empty check (length(trim(title)) > 0),
  constraint status_is_known check (status in ('active', 'achieved', 'paused')),
  constraint progress_is_a_percentage check (progress is null or (progress >= 0 and progress <= 100)),
  constraint achieved_has_a_date check ((status = 'achieved') = (achieved_at is not null))
);

create index if not exists goals_user_position_idx on goals (user_id, position);

alter table goals enable row level security;
alter table goals force row level security;
drop policy if exists goals_owner on goals;
create policy goals_owner on goals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table goals alter column user_id set default auth.uid();
