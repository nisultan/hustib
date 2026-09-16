-- ---------------------------------------------------------------------------
-- Categories
--
-- A part of the student's life, for sorting tasks that are not coursework.
--
-- Named by the student rather than fixed here: the split that matters differs
-- for everyone — swimming, a side project, a part-time job — and a list chosen
-- in a migration would be wrong for most people and unfixable without another
-- one. Courses stay separate: a course says which subject, a category says
-- which part of life, and a task can carry both.
--
-- Safe to run against a database created before these existed. The app also
-- treats the table and the column as optional, so a database that has not run
-- this yet loads and works exactly as before, minus categories.
-- ---------------------------------------------------------------------------

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  color       text not null default 'violet',
  created_at  timestamptz not null default now(),
  constraint name_is_not_empty check (length(trim(name)) > 0),
  unique (user_id, name)
);

-- `set null`, never `cascade`: deleting a label must not delete the work filed
-- under it. The task survives and simply loses its category.
alter table tasks
  add column if not exists category_id uuid references categories on delete set null;

create index if not exists categories_user_idx on categories (user_id);
create index if not exists tasks_user_category_idx on tasks (user_id, category_id);

-- Same default-deny shape as every other table in schema.sql.
alter table categories enable row level security;
alter table categories force row level security;
drop policy if exists categories_owner on categories;
create policy categories_owner on categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table categories alter column user_id set default auth.uid();
