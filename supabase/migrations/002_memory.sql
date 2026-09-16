-- ---------------------------------------------------------------------------
-- Memory and insights
--
-- What the hub has learned about the student, and what it noticed on its own.
--
-- Memory is a list of short separate notes rather than one growing document:
-- a note can be corrected or deleted on its own, the student can read exactly
-- what is believed about them, and a wrong inference does not contaminate
-- everything around it.
--
-- Insights are stored rather than recomputed on every render, because a
-- dismissal has to stick, and comparing what was said last week against this
-- week is the point of a hub that is supposed to know someone better over time.
--
-- Safe to run against a database created from schema.sql before these existed.
-- ---------------------------------------------------------------------------

create table if not exists memory_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  -- Free text rather than an enum: the topics are the model's own grouping,
  -- and a fixed list here would need a migration every time it found a new one.
  topic       text not null default 'General',
  note        text not null,
  source      text not null default 'pattern',
  -- A pinned note is never revised or dropped by a reflection pass.
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint note_is_not_empty check (length(trim(note)) > 0),
  constraint source_is_known check (source in ('reflection', 'conversation', 'pattern'))
);

create table if not exists insights (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  kind          text not null default 'takeaway',
  title         text not null,
  body          text not null,
  -- What in the hub it was drawn from, so the student can check the reasoning.
  basis         text not null default '',
  href          text,
  created_at    timestamptz not null default now(),
  dismissed_at  timestamptz,
  constraint kind_is_known check (kind in ('takeaway', 'recommendation', 'pattern'))
);

-- When the hub last sat down and thought about this student. On profiles
-- rather than its own table: there is exactly one value per person.
alter table profiles add column if not exists reflected_at timestamptz;

create index if not exists memory_notes_user_idx on memory_notes (user_id);
-- The dashboard only ever reads what is still standing, newest first.
create index if not exists insights_user_live_idx
  on insights (user_id, created_at desc)
  where dismissed_at is null;

-- Same default-deny shape as every other table in schema.sql.
do $$
declare
  t text;
begin
  foreach t in array array['memory_notes', 'insights']
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
