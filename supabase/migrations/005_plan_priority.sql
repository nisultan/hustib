-- ---------------------------------------------------------------------------
-- Priority on plan items
--
-- A day has an order in time and an order in importance, and they are not the
-- same: the thing at 9am is not automatically the thing that matters. Keeping
-- them apart is what lets a plan survive a day that goes wrong — you can still
-- see what has to happen.
--
-- Reuses the task_priority enum rather than inventing a parallel one, so a
-- block that stands in for a task carries the same word the task does.
--
-- The app inserts without this column when it is missing, so a database that
-- has not run this keeps saving plans — just without priorities.
-- ---------------------------------------------------------------------------

alter table plan_items
  add column if not exists priority task_priority not null default 'medium';

-- The plan is read a day at a time, and within a day the interesting order is
-- what matters most.
create index if not exists plan_items_user_date_priority_idx
  on plan_items (user_id, date, priority);
