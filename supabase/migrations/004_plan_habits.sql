-- ---------------------------------------------------------------------------
-- The daily plan, and habits
--
-- A plan item is not a task. A task is work that exists until it is done and
-- carries a deadline; a plan item is an intention about one particular day,
-- and it stops mattering when that day ends. Keeping them apart is why
-- yesterday's unfinished plan does not follow the student around while an
-- unfinished essay still does.
--
-- A habit is a rule, not a year of rows. Which days it was actually kept lives
-- on the day itself, so changing your mind about a habit costs one update
-- rather than a rewrite of the future.
--
-- Safe to run against an older database, and the app treats all of it as
-- optional, so a database that has not run this loads and works as before.
-- ---------------------------------------------------------------------------

create table if not exists plan_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  date         date not null,
  title        text not null,
  -- Null means it belongs to the day but not to an hour.
  start_time   time,
  minutes      integer not null default 30,
  done         boolean not null default false,
  category_id  uuid references categories on delete set null,
  -- The task outlives the block that set time aside for it.
  task_id      uuid references tasks on delete set null,
  created_at   timestamptz not null default now(),
  constraint title_is_not_empty check (length(trim(title)) > 0),
  constraint minutes_is_sane check (minutes > 0 and minutes <= 24 * 60)
);

create table if not exists habits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  name         text not null,
  category_id  uuid references categories on delete set null,
  -- 0 = Sunday. Empty means every day.
  weekdays     smallint[] not null default '{}',
  created_at   timestamptz not null default now(),
  -- Archived rather than deleted, so past completions stay honest.
  archived_at  timestamptz,
  constraint name_is_not_empty check (length(trim(name)) > 0)
);

-- Which habits were kept on a given day, alongside that day's weight and
-- reflection: it is one more fact about the day, not its own timeline.
alter table days add column if not exists habits_done uuid[] not null default '{}';

create index if not exists plan_items_user_date_idx on plan_items (user_id, date);
create index if not exists habits_user_idx on habits (user_id) where archived_at is null;

do $$
declare
  t text;
begin
  foreach t in array array['plan_items', 'habits']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists %I on %I', t || '_owner', t);
    execute format(
      'create policy %I on %I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_owner', t
    );
    execute format('alter table %I alter column user_id set default auth.uid()', t);
  end loop;
end
$$;
