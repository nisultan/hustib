-- ---------------------------------------------------------------------------
-- Columns the student adds to the university table
--
-- The built-in fields cover what every application has — a name, a deadline, a
-- status. They cannot cover what this particular student is tracking, which
-- might be tuition, an IELTS minimum, or whether the portal has opened. Rather
-- than guess at ten more columns and be wrong for everyone, the table takes
-- columns.
--
-- Values live on the university row as jsonb keyed by column id, because
-- nothing in SQL ever queries inside them: they are read and written whole,
-- with the row they belong to. A table of (university, column, value) would
-- buy a join on every page load and no reads it cannot already do.
--
-- Every value is stored as text whatever the column's type. A column can be
-- retyped after it holds data, and a number column that briefly holds "tbc" is
-- a smaller problem than a save that refuses the word.
--
-- Safe against an older database, and the app treats both as optional.
-- ---------------------------------------------------------------------------

create table if not exists uni_columns (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  label       text not null,
  type        text not null default 'text',
  -- Only meaningful for 'select'.
  options     text[] not null default '{}',
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint label_is_not_empty check (length(trim(label)) > 0),
  constraint type_is_known check (type in ('text', 'number', 'date', 'url', 'select'))
);

alter table universities add column if not exists fields jsonb not null default '{}'::jsonb;

create index if not exists uni_columns_user_idx on uni_columns (user_id, position);

alter table uni_columns enable row level security;
alter table uni_columns force row level security;
drop policy if exists uni_columns_owner on uni_columns;
create policy uni_columns_owner on uni_columns
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table uni_columns alter column user_id set default auth.uid();
