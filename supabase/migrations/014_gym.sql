-- Gym days: one flag per day on the journal row, next to the weigh-in.
--
-- A column rather than a fake habit: a habit can be renamed or deleted, and
-- a year of gym squares should not disappear with it.
alter table days add column if not exists gym boolean not null default false;
