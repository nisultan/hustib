# LifeOS

A personal operating system. One place for tasks, notes, grades and university
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

**Make it yours** — eight accent colours and three block sizes (Small / Medium / Large),
plus a colour per course. Block size is one lever: Tailwind v4 multiplies `--spacing` for
every padding, margin and gap, so changing it resizes every card, row and gutter at once.
Only the accent moves — priority, trend and application-status colours stay put, because
those carry meaning rather than taste.

**Delete anything** — every task row, grade row and university card has an inline delete
that arms on the first click and acts on the second, disarming on blur or after a few
seconds. Courses delete from their edit dialog, taking their tasks and grades with them.

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
| `src/lib/appearance.ts` | Theme, accent and block-size constants + pre-paint init script |
| `src/lib/vault.ts` | PBKDF2 + AES-GCM encryption for the local store |
| `src/lib/supabase/` | Client, row types and the full CRUD repository |
| `supabase/schema.sql` | Postgres schema, indexes and RLS policies |

## Password

On first entry you're asked to set a password (skippable, and changeable later in
Settings). It isn't a cosmetic gate: the password is stretched with PBKDF2-HMAC-SHA256
(310k iterations) into an AES-GCM key, and the whole data blob is encrypted with it before
it reaches `localStorage`. The plaintext copy is deleted when you set one.

The password itself is stored nowhere — not even hashed. That's what makes it meaningful,
and also why **there is no recovery**: forget it and the data is unreadable. The UI says so
before you commit, and pushes an export.

Honest about scope: this protects against someone with access to your browser reading your
grades and application notes out of storage. It does not protect against code running in
the page while the hub is unlocked, since the key has to be in memory then. A lock on a
drawer, not a safe. `crypto.subtle` needs a secure origin, so over plain HTTP the app says
so rather than offering encryption it can't perform.

## Data and storage

This version stores everything in the browser via `localStorage`. That makes it private
and instant, but it is per-device, and clearing site data removes it — Settings has a
JSON export.

`src/lib/store.tsx` is the only module that touches storage, which is what keeps the swap
to Supabase contained.

## Connecting Supabase

The backend code is written and compiles; it just needs a project.

1. Create a project at supabase.com.
2. Run `supabase/schema.sql` in the SQL editor. It creates every table, index, enum and
   RLS policy, plus a trigger that makes a profile row on sign-up.
3. `cp .env.example .env.local` and fill in the URL and anon key from
   Project Settings → API.

| File | What it gives you |
| --- | --- |
| `src/lib/supabase/client.ts` | The browser client. Returns `null` when unconfigured, so the app keeps working locally until you add keys |
| `src/lib/supabase/types.ts` | Row types matching the schema (regenerable with `supabase gen types`) |
| `src/lib/supabase/repository.ts` | Auth, a one-round-trip `fetchAll`, and full CRUD — one function per store mutator |

`repository.ts` also has `migrateLocalData`, which pushes an existing local hub into a
freshly signed-in account so nothing entered before the switch is lost.

Switching over means having `StoreProvider` call those functions instead of writing to
localStorage. The component tree doesn't change: it already treats every mutation as
fire-and-forget and reads one `AppData` object.

Security-wise, the schema carries a `user_id` on every table, enables *and forces*
row-level security with `using` **and** `with check`, and defaults `user_id` to
`auth.uid()` — so the client never sends it and cannot write into another account even if
it tried. The anon key is public by design; RLS is what protects the data, not the key.

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
- `src/lib/appearance.ts` is deliberately hook-free and has no `"use client"`: the server
  layout imports `APPEARANCE_INIT_SCRIPT` from it to inline into `<head>`, and a module
  containing hooks cannot be imported from a server component at all. The hook lives in
  `src/lib/use-appearance.ts`.
- Row types in `src/lib/supabase/types.ts` are `type` aliases, not `interface`s. supabase-js
  constrains every Row/Insert/Update to `Record<string, unknown>`, and an interface has no
  implicit index signature to satisfy that — using `interface` makes every query in the app
  silently resolve to `never`. Each table also needs a `Relationships` key for the same
  reason.
- Encrypted writes are sequenced through a counter in `store.tsx`. Encryption is async, so
  without it a fast edit could let an older ciphertext land last and overwrite a newer one.
- Tour animations are driven by a `--d` custom property for per-element delay, with the
  keyframes at the bottom of `globals.css`. Each step remounts its illustration (it is
  keyed on the step id), so the animation replays every time you return to a step.
