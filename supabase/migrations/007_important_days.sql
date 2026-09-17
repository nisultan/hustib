-- ---------------------------------------------------------------------------
-- Important days
--
-- Dates that matter on their own, rather than dates attached to something
-- else. Every other date in the schema belongs to a row that is really about
-- work — a task's due_date, a university's deadline, a goal's. The SAT is not
-- work to be finished and a birthday is not a goal, and the only way to put
-- either on the calendar before this was to invent a task and then live with
-- it sitting in the list being permanently not-done.
--
-- There is deliberately no status column. A day like this is not completed;
-- it happens.
--
-- Safe to run against an older database, and the app treats the table as
-- optional, so a database that has not run this still loads.
-- ---------------------------------------------------------------------------

create table if not exists important_days (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  title          text not null,
  date           date not null,
  kind           text not null default 'other',
  note           text not null default '',
  -- The stored date is the first occurrence, not the next one. Sixty rows to
  -- stand for one recurring fact is the mistake habits already avoid, and
  -- keeping the original means "whose eighteenth" stays answerable.
  repeats_yearly boolean not null default false,
  created_at     timestamptz not null default now(),
  constraint title_is_not_empty check (length(trim(title)) > 0),
  constraint kind_is_known check (kind in ('exam', 'birthday', 'holiday', 'trip', 'other'))
);

create index if not exists important_days_user_date_idx on important_days (user_id, date);

alter table important_days enable row level security;
alter table important_days force row level security;
drop policy if exists important_days_owner on important_days;
create policy important_days_owner on important_days
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table important_days alter column user_id set default auth.uid();
