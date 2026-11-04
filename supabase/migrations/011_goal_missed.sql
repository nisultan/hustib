-- ---------------------------------------------------------------------------
-- Goals that were not done by their deadline
--
-- When a goal's deadline passes, the app asks whether it was achieved. "No"
-- closes it as 'missed': read-only from then on, and shown in the archive.
-- The status check gains the new value; nothing else changes.
--
-- Safe to run more than once.
-- ---------------------------------------------------------------------------

alter table goals drop constraint if exists status_is_known;
alter table goals add constraint status_is_known
  check (status in ('active', 'achieved', 'paused', 'missed'));
