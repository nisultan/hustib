-- ---------------------------------------------------------------------------
-- How a goal measures itself
--
-- A goal used to carry a number someone dragged to where it felt right, which
-- is a record of a mood on a day rather than of progress. This column holds a
-- measurement spec instead: which source counts (habit ticks, finished tasks,
-- planned blocks, days written, weight), which ids or words count within it,
-- how many make a hundred percent, and over what window.
--
-- jsonb rather than a dozen columns, because nothing in SQL ever queries inside
-- it. The spec is read and written whole with the goal it belongs to, and the
-- arithmetic happens in the client, which has the habits and days loaded
-- already. Splitting it into columns would buy a migration every time a new
-- kind of goal becomes measurable and no query that is not already possible.
--
-- Null means the student sets the bar by hand, which stays supported: plenty of
-- goals — an offer from a university, feeling less behind — have no honest
-- proxy in a hub, and a confident bar over a made-up number is worse than a
-- slider that admits what it is.
--
-- Safe to run more than once, and safe on a database that never ran 006.
-- ---------------------------------------------------------------------------

alter table goals add column if not exists tracker jsonb;

comment on column goals.tracker is
  'Measurement spec written once at creation and evaluated client-side. Null means the progress bar is set by hand.';
