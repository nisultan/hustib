# IB Learner

A student productivity hub. One place for tasks, notes, grades and university
applications — and, more to the point, a clear answer to *what should I work on next*.

The dashboard is the product. Everything else feeds it.

```bash
npm install
npm run dev
```

Then open http://localhost:3000. You start with an empty hub — it is your platform, not a
demo. An animated tour opens on the first visit to explain what each page is for; you can
replay it any time from **Settings**, and load sample data from there if you want to poke
at a populated dashboard before committing to your own.

## What it does

**Home** answers five questions above the fold: what's due today, what's coming, how
grades are going, what to focus on, and which application deadline is next.

**Tasks & Notes** keep notes on the task itself rather than in a separate app. Views:
All, Today, Upcoming, Completed, By course, By priority.

**Quick add** takes a sentence and fills in the form:

> "Need to finish physics lab by friday at 5pm, it's important"
> → Physics SL · Fri 18 Sep · 17:00 · High · "Need to finish physics lab"

Everything it extracted is shown and stays editable before you save.

**Grades** computes weighted course averages (plain means when no weights are given, and
it says which it used), an overall average, a damped projection, and a **What if?**
calculator: name a score and see where the course and your overall average land.

**Universities** tracks each application with status, priority, deadline and a free-form
notes field.

**Recommendations** combine signals rather than reporting them separately — a weak
course *plus* an approaching test *plus* unfinished work outranks any one of those:

> 💡 Prioritize Physics SL today. It is your lowest course at 77.7%, "Physics test" is in
> 2 days, and you have 3 unfinished tasks.

**Global search** (⌘K / Ctrl-K) covers tasks, notes, courses, grades and universities.

**The tour** is eight animated steps — the dashboard fills itself in, the quick-add box
types a sentence and the fields pop out of it, the grade chart draws itself, three signals
converge into one recommendation. It opens once on a first visit, is skippable at every
step, navigable with arrow keys, and ends on two ways to begin: start adding courses, or
load sample data. Everything it animates is disabled under `prefers-reduced-motion`.

**Light and dark** both ship as first-class themes, with a third "match system" option.
The header has a one-click cycle; Settings has the explicit picker.

## Where things live

| Path | What's in it |
| --- | --- |
| `src/lib/store.tsx` | The single data interface every page uses |
| `src/lib/grades.ts` | Averages, trend, prediction, What-if |
| `src/lib/recommendations.ts` | The suggestion rules |
| `src/lib/quickparse.ts` | Sentence → structured task |
| `src/lib/dates.ts` | Local-date handling (see the note in the file) |
| `src/components/` | UI primitives, nav, dialogs, chart |
| `src/components/Tour.tsx` | Tour shell: steps, transitions, first-run gating |
| `src/components/TourArt.tsx` | The animated mini-mockup per step |
| `src/lib/theme.ts` | Theme constants and the pre-paint init script |
| `supabase/schema.sql` | Postgres schema, indexes and RLS policies |

## Data and storage

This version stores everything in the browser via `localStorage`. That makes it private
and instant, but it is per-device, and clearing site data removes it — Settings has a
JSON export.

`src/lib/store.tsx` is the only module that touches storage. Moving to multi-device sync
means running `supabase/schema.sql` against a Supabase project and reimplementing that
file's mutators as queries; the pages already treat every mutation as fire-and-forget, so
they don't change. The schema carries a `user_id` on every table, enables *and forces*
row-level security with `using` **and** `with check`, and defaults `user_id` to
`auth.uid()` so clients never send it.

## AI

Quick-add parsing and recommendations are deterministic rules — offline, instant, free,
and inspectable. Both are single modules with a clear input and output, so swapping in a
model call later is a contained change. There is no AI tutor and no learning engine; the
brief asked for neither.

## Stack

Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS v4. No UI library
and no charting library — the grade chart is hand-rolled SVG, about 130 lines.

```bash
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

## Notes for whoever works on this next

- Dates are `"YYYY-MM-DD"` strings read in local time. `new Date(iso)` parses them as UTC
  and shifts the day, so go through `src/lib/dates.ts`.
- Overlays are portalled to `document.body`. The header uses `backdrop-blur`, which makes
  it the containing block for `position: fixed` and would otherwise trap a dialog inside
  the header's height.
- `fieldClass` in `components/ui.tsx` deliberately sets no width. Tailwind utilities share
  one specificity, so a baked-in `w-full` wins over a `w-auto` passed via `className`
  regardless of class order.
- Pages wait on `store.ready` before rendering. Without it the first paint shows an empty
  state before saved data arrives.
- `src/lib/theme.ts` is deliberately hook-free and has no `"use client"`: the server layout
  imports `THEME_INIT_SCRIPT` from it to inline into `<head>`, which a module containing
  hooks cannot do. The hook lives in `src/lib/use-theme.ts`.
- Tour animations are driven by a `--d` custom property for per-element delay, with the
  keyframes at the bottom of `globals.css`. Each step remounts its illustration (it is
  keyed on the step id), so the animation replays every time you return to a step.
