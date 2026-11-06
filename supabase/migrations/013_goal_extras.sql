-- ---------------------------------------------------------------------------
-- Goal pages: gallery, milestones, reasons, pushes
--
-- Everything a goal page holds beyond its core columns, in one jsonb: extra
-- pictures (data URLs or https links), the cover's vertical position, a tint,
-- the reasons (what you get, what it costs to quit, a mantra), a milestone
-- checklist and the days you said you pushed towards it.
--
-- One column rather than six because none of it is queried in SQL — it is read
-- and written whole with the goal. Safe to run more than once; the app saves
-- goals without it on a database that has not run this.
-- ---------------------------------------------------------------------------

alter table goals add column if not exists extras jsonb not null default '{}'::jsonb;

comment on column goals.extras is
  'Goal page content: gallery, coverY, color, reward, cost, mantra, milestones, pushes. Read and written whole by the client.';
