-- IB Learner — Postgres schema for Supabase.
--
-- Run this in the Supabase SQL editor to create the multi-device backend.
-- Every table carries a user_id and is closed by row-level security, so a
-- student can only ever read or write their own rows.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type task_status   as enum ('not_started', 'in_progress', 'completed');

create type assessment_type as enum ('Test', 'Quiz', 'Homework', 'Project', 'Exam', 'Other');

create type application_status as enum (
  'interested', 'researching', 'preparing',
  'applied', 'accepted', 'rejected', 'waitlisted'
);
create type application_priority as enum ('dream', 'target', 'safety');

-- ---------------------------------------------------------------------------
-- Profiles
--
-- auth.users is managed by Supabase; this holds the app-level profile and is
-- created automatically on sign-up by the trigger at the bottom of this file.
-- ---------------------------------------------------------------------------

create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null default 'there',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Courses and their topics
-- ---------------------------------------------------------------------------

create table courses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  code        text not null default '',
  color       text not null default 'violet',
  created_at  timestamptz not null default now(),

  -- Two courses with the same name under one user would make every course
  -- picker ambiguous.
  unique (user_id, name)
);

create table lessons (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  course_id   uuid not null references courses on delete cascade,
  name        text not null,
  position    integer not null default 0,

  unique (course_id, name)
);

-- ---------------------------------------------------------------------------
-- Tasks
--
-- Notes live on the task rather than in a separate app, which is the whole
-- point of the product. `task_notes` exists for longer follow-up notes added
-- after the fact; short notes stay in tasks.notes.
-- ---------------------------------------------------------------------------

create table tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  course_id     uuid references courses on delete cascade,
  lesson        text,
  title         text not null,
  notes         text not null default '',
  -- A date with no time is the common case, so the two are stored separately
  -- rather than as one timestamp that would force a meaningless midnight.
  due_date      date,
  due_time      time,
  priority      task_priority not null default 'medium',
  status        task_status   not null default 'not_started',
  completed_at  date,
  created_at    timestamptz not null default now(),

  constraint due_time_needs_due_date check (due_time is null or due_date is not null),
  constraint completed_has_timestamp check (
    (status = 'completed') = (completed_at is not null)
  )
);

create table task_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  task_id     uuid not null references tasks on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Grades
-- ---------------------------------------------------------------------------

-- Reusable weightings per course ("Tests are 40% of this course"), so a
-- student can set the scheme once instead of typing a weight on every row.
create table grade_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  course_id   uuid not null references courses on delete cascade,
  name        text not null,
  weight      numeric(5,2) check (weight >= 0 and weight <= 100),

  unique (course_id, name)
);

create table grades (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  course_id    uuid not null references courses on delete cascade,
  category_id  uuid references grade_categories on delete set null,
  assessment   text not null,
  type         assessment_type not null default 'Test',
  score        numeric(5,2) not null check (score >= 0 and score <= 100),
  -- Null means "no weight given" — the app falls back to a plain mean.
  weight       numeric(5,2) check (weight >= 0 and weight <= 100),
  date         date not null default current_date,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Universities
-- ---------------------------------------------------------------------------

create table universities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  country     text not null default '',
  flag        text not null default '',
  city        text not null default '',
  program     text not null default '',
  deadline    date,
  status      application_status   not null default 'interested',
  priority    application_priority not null default 'target',
  notes       text not null default '',
  website     text not null default '',
  created_at  timestamptz not null default now()
);

create table university_notes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  university_id  uuid not null references universities on delete cascade,
  title          text not null default '',
  body           text not null,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Recommendations
--
-- The app computes these on the fly. This table exists so a suggestion can be
-- dismissed and stay dismissed across devices.
-- ---------------------------------------------------------------------------

create table recommendations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  kind          text not null,
  body          text not null,
  href          text,
  dismissed_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
--
-- Every query the app makes is scoped to one user, and the hot paths are
-- "my open tasks by deadline" and "my grades for this course".
-- ---------------------------------------------------------------------------

create index on courses (user_id);
create index on lessons (user_id, course_id);
create index on tasks (user_id, due_date) where status <> 'completed';
create index on tasks (user_id, course_id);
create index on task_notes (user_id, task_id);
create index on grades (user_id, course_id, date);
create index on grade_categories (user_id, course_id);
create index on universities (user_id, deadline);
create index on university_notes (user_id, university_id);
create index on recommendations (user_id) where dismissed_at is null;

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Default-deny: RLS is enabled on every table, and each gets one policy that
-- matches rows to the caller. `with check` is set as well as `using`, so a row
-- cannot be inserted or updated into someone else's account.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'courses', 'lessons', 'tasks', 'task_notes',
    'grades', 'grade_categories',
    'universities', 'university_notes', 'recommendations'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_owner', t
    );
  end loop;
end
$$;

alter table profiles enable row level security;
alter table profiles force row level security;

create policy profiles_owner on profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Defaults
--
-- Defaulting user_id means client inserts never have to send it, and the RLS
-- check above still rejects anything that tries to override it.
-- ---------------------------------------------------------------------------

alter table courses          alter column user_id set default (select auth.uid());
alter table lessons          alter column user_id set default (select auth.uid());
alter table tasks            alter column user_id set default (select auth.uid());
alter table task_notes       alter column user_id set default (select auth.uid());
alter table grades           alter column user_id set default (select auth.uid());
alter table grade_categories alter column user_id set default (select auth.uid());
alter table universities     alter column user_id set default (select auth.uid());
alter table university_notes alter column user_id set default (select auth.uid());
alter table recommendations  alter column user_id set default (select auth.uid());

-- ---------------------------------------------------------------------------
-- Create a profile row whenever someone signs up.
-- ---------------------------------------------------------------------------

create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'there')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
