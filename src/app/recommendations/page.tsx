"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { recommend, RecKind } from "@/lib/recommendations";
import { productivity } from "@/lib/productivity";
import { habitPatterns, HabitPattern, planPatterns, weekdayNames } from "@/lib/consistency";
import { daysUntil, todayISO } from "@/lib/dates";
import { EmptyState, SectionTitle } from "@/components/ui";
import { Insights } from "@/components/Insights";
import { Flame } from "@/components/Flame";

/**
 * What the week actually says.
 *
 * Was a single reading-width column: a score, three counters and a list of
 * sentences, every one the same white card. It held the right information and
 * gave none of it a shape, so the page read as a report to get through rather
 * than something to look at.
 *
 * Now it is a board. The top row is the answer at a glance — one score and the
 * three numbers it is made of. Below, the left column is what to *do* (what
 * Lifee noticed, what the rules suggest), and the right is the evidence: which
 * habits are holding and which are slipping, and which part of the planned day
 * actually happens. Someone who reads only the top row has the gist; someone
 * who wants to argue with it has the working on the right.
 */
export default function RecommendationsPage() {
  const store = useStore();
  const today = todayISO();

  const recs = useMemo(() => recommend(store, 8), [store]);
  const score = useMemo(() => productivity(store), [store]);
  const habits = useMemo(() => habitPatterns(store, today), [store, today]);
  const plan = useMemo(() => planPatterns(store, today), [store, today]);

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  const open = store.tasks.filter((t) => t.status !== "completed");
  const overdue = open.filter((t) => t.dueDate != null && daysUntil(t.dueDate) < 0).length;
  const week = open.filter((t) => {
    if (t.dueDate == null) return false;
    const d = daysUntil(t.dueDate);
    return d >= 0 && d <= 7;
  }).length;

  // Habits across the board, last fortnight against the one before.
  const sum = (key: "recent" | "before") => {
    let kept = 0;
    let due = 0;
    for (const h of habits) {
      const rate = h[key];
      if (rate == null) continue;
      // The halves are fourteen calendar days each; weighting by how often the
      // habit was actually due keeps a weekly habit from counting like a daily.
      const n = h.due / 2;
      kept += rate * n;
      due += n;
    }
    return due === 0 ? null : kept / due;
  };
  const habitsNow = sum("recent");
  const habitsBefore = sum("before");

  return (
    <div className="page-in">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Recommendations</h1>
        <p className="mt-1 text-sm text-ink-2">What your week actually says — and what to do about it.</p>
      </header>

      {/* ---- the answer at a glance ------------------------------------- */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3 xl:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <ScoreTile
          score={score.score}
          delta={score.delta}
          streak={score.streak}
          best={score.bestStreak}
        />
        <Stat
          label="Habits kept"
          value={habitsNow == null ? "—" : `${Math.round(habitsNow * 100)}%`}
          hint="last 14 days"
          trend={habitsNow != null && habitsBefore != null ? habitsNow - habitsBefore : null}
        />
        <Stat
          label="Plan done"
          value={plan.planned === 0 ? "—" : `${Math.round((plan.done / plan.planned) * 100)}%`}
          hint={plan.planned === 0 ? "nothing planned yet" : `${plan.done} of ${plan.planned} blocks`}
        />
        <Stat
          label="Due this week"
          value={String(week)}
          hint={overdue > 0 ? `${overdue} already late` : "nothing late"}
          alarm={overdue > 0}
        />
      </div>

      <div className="grid gap-x-6 gap-y-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        {/* ---- what to do --------------------------------------------- */}
        <div className="grid min-w-0 gap-2">
          <Insights />

          <section>
            <SectionTitle right={<span className="text-xs text-ink-3">{recs.length}</span>}>
              Suggestions
            </SectionTitle>
            {recs.length === 0 ? (
              <EmptyState
                title="Nothing to suggest yet"
                hint="Add tasks and deadlines and suggestions will appear here."
              />
            ) : (
              <div className="grid gap-2">
                {recs.map((r, i) => (
                  <Suggestion key={r.id} kind={r.kind} text={r.text} href={r.href} index={i} />
                ))}
              </div>
            )}
            <p className="mt-4 text-[11px] leading-relaxed text-ink-3">
              Fourteen rules read your own data and each produces at most one line. The strongest
              few are shown. Nothing here is sent anywhere.
            </p>
          </section>
        </div>

        {/* ---- the evidence ------------------------------------------- */}
        <div className="grid min-w-0 gap-8">
          <HoldingSlipping habits={habits} />
          <Rhythm plan={plan} />
          <Signals signals={score.signals} />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The top row                                                                */
/* -------------------------------------------------------------------------- */

const RING = 2 * Math.PI * 34;

function ScoreTile({
  score,
  delta,
  streak,
  best,
}: {
  score: number | null;
  delta: number | null;
  streak: number;
  best: number;
}) {
  const tone =
    score == null
      ? "var(--text-3)"
      : score >= 70
        ? "var(--up)"
        : score >= 45
          ? "var(--high)"
          : "var(--urgent)";

  return (
    <div className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-line bg-panel p-4 shadow-[var(--shadow),var(--edge)] sm:col-span-3 xl:col-span-1">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(220px 140px at 10% 50%, color-mix(in srgb, ${tone} 12%, transparent), transparent 70%)`,
        }}
      />

      <span className="relative grid size-[84px] shrink-0 place-items-center">
        <svg viewBox="0 0 80 80" className="absolute inset-0 size-full -rotate-90">
          <circle cx="40" cy="40" r="34" fill="none" stroke={tone} strokeWidth="7" opacity="0.14" />
          {score != null && (
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke={tone}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - score / 100)}
              className="transition-[stroke-dashoffset] duration-1000 ease-out"
            />
          )}
        </svg>
        <span className="nums relative text-[26px] font-semibold tracking-tight" style={{ color: tone }}>
          {score ?? "—"}
        </span>
      </span>

      <div className="relative min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Consistency</p>
        <p className="mt-1 text-[14px] font-medium leading-snug">{verdict(score)}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-3">
          {delta != null && delta !== 0 && (
            <span style={{ color: delta > 0 ? "var(--up)" : "var(--urgent)" }}>
              {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} vs before
            </span>
          )}
          {streak > 0 && (
            <span className="inline-flex items-center gap-0.5">
              {streak}-day streak <Flame streak={streak} />
              {best > streak && <span className="ml-1 opacity-70">· best {best}</span>}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function verdict(score: number | null): string {
  if (score == null) return "A few more days of logging and this starts meaning something.";
  if (score >= 85) return "You're showing up almost every day.";
  if (score >= 70) return "Steady, with the odd gap.";
  if (score >= 50) return "On and off. The system works when you use it.";
  if (score >= 30) return "Slipping. Pick one thing to keep daily.";
  return "Mostly not logging. Start with one thing.";
}

function Stat({
  label,
  value,
  hint,
  trend = null,
  alarm = false,
}: {
  label: string;
  value: string;
  hint: string;
  trend?: number | null;
  alarm?: boolean;
}) {
  const moved = trend != null && Math.abs(trend) >= 0.05;
  return (
    <div className="rounded-2xl border border-line bg-panel p-4 shadow-[var(--shadow),var(--edge)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</p>
      <p className="mt-2 flex items-baseline gap-2">
        <span
          className="nums text-[28px] font-semibold leading-none tracking-tight"
          style={alarm ? { color: "var(--urgent)" } : undefined}
        >
          {value}
        </span>
        {moved && (
          <span
            className="nums text-[12px] font-medium"
            style={{ color: (trend as number) > 0 ? "var(--up)" : "var(--urgent)" }}
          >
            {(trend as number) > 0 ? "▲" : "▼"} {Math.round(Math.abs(trend as number) * 100)}
          </span>
        )}
      </p>
      <p className="mt-1.5 text-[11.5px] text-ink-3" style={alarm ? { color: "var(--urgent)" } : undefined}>
        {hint}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Suggestions                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Each rule gets its own mark and colour, instead of the same lightbulb on
 * every line. Eight identical bulbs say "here are some sentences"; a red mark
 * on the overdue one and a green one on "you're ahead" lets the list be read
 * as a shape before it is read as words.
 */
const KIND: Record<RecKind, { label: string; tone: string; glyph: string }> = {
  overdue: { label: "Overdue", tone: "var(--urgent)", glyph: "!" },
  focus: { label: "Focus", tone: "var(--accent)", glyph: "◎" },
  test: { label: "Test soon", tone: "var(--high)", glyph: "✎" },
  deadline: { label: "Deadline", tone: "var(--high)", glyph: "◷" },
  university: { label: "Application", tone: "var(--accent)", glyph: "◆" },
  ahead: { label: "Ahead", tone: "var(--up)", glyph: "✓" },
  clear: { label: "All clear", tone: "var(--up)", glyph: "✓" },
  declining: { label: "Sliding", tone: "var(--urgent)", glyph: "↘" },
  cluster: { label: "Busy stretch", tone: "var(--high)", glyph: "▤" },
  thin: { label: "Thin evidence", tone: "var(--medium)", glyph: "…" },
  stale: { label: "Gathering dust", tone: "var(--medium)", glyph: "◌" },
  untested: { label: "No grades", tone: "var(--medium)", glyph: "?" },
  momentum: { label: "Momentum", tone: "var(--up)", glyph: "↗" },
  journal: { label: "Journal", tone: "var(--accent)", glyph: "✍" },
  weight: { label: "Weight", tone: "var(--accent)", glyph: "⚖" },
};

function Suggestion({
  kind,
  text,
  href,
  index,
}: {
  kind: RecKind;
  text: string;
  href: string;
  index: number;
}) {
  const k = KIND[kind];
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border border-line bg-panel px-3.5 py-3 shadow-[var(--shadow),var(--edge)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-md),var(--edge)]"
      style={{ animation: `fade-up 360ms ease-out ${index * 40}ms both` }}
    >
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-lg text-[14px] font-semibold"
        style={{ background: `color-mix(in srgb, ${k.tone} 14%, transparent)`, color: k.tone }}
      >
        {k.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-[10.5px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: k.tone }}
        >
          {k.label}
        </span>
        <span className="mt-0.5 block text-[13.5px] leading-relaxed text-ink-2">{text}</span>
      </span>
      <span
        aria-hidden
        className="mt-2 shrink-0 text-ink-3 transition-transform duration-200 group-hover:translate-x-0.5"
      >
        →
      </span>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* The evidence                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Which habits are holding and which are not.
 *
 * Split into two groups rather than one sorted list, because the two need
 * different things from the reader: the holding ones need nothing but to be
 * seen, and the slipping ones need a reason — which is why only they carry the
 * weekday they tend to die on.
 */
function HoldingSlipping({ habits }: { habits: HabitPattern[] }) {
  const measured = habits.filter((h) => h.recent != null);
  if (measured.length === 0) return null;

  const slipping = measured
    .filter((h) => h.trend === "down" || (h.recent ?? 0) < 0.45)
    .sort((a, b) => (a.recent ?? 0) - (b.recent ?? 0));
  const holding = measured
    .filter((h) => !slipping.includes(h))
    .sort((a, b) => (b.recent ?? 0) - (a.recent ?? 0));

  return (
    <section>
      <SectionTitle right={<span className="text-xs text-ink-3">last 14 days</span>}>
        What you keep
      </SectionTitle>
      <div className="grid gap-3 rounded-2xl border border-line bg-panel p-4 shadow-[var(--shadow),var(--edge)]">
        {holding.length > 0 && (
          <Group title="Holding" tone="var(--up)" habits={holding} />
        )}
        {holding.length > 0 && slipping.length > 0 && <div className="border-t border-line" />}
        {slipping.length > 0 && (
          <Group title="Slipping" tone="var(--urgent)" habits={slipping} showWhy />
        )}
      </div>
    </section>
  );
}

function Group({
  title,
  tone,
  habits,
  showWhy = false,
}: {
  title: string;
  tone: string;
  habits: HabitPattern[];
  showWhy?: boolean;
}) {
  return (
    <div className="grid gap-2.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: tone }}>
        {title}
      </p>
      {habits.map((h) => {
        const rate = h.recent ?? 0;
        // Green, amber, red. Not --medium: that is the blue of the "medium"
        // priority, and a 67% habit drawn in a different colour family from a
        // 71% one reads as a different kind of thing rather than a little worse.
        const bar = rate >= 0.7 ? "var(--up)" : rate >= 0.45 ? "var(--high)" : "var(--urgent)";
        return (
          <div key={h.id} className="grid gap-1">
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px]">{h.name}</span>
              {h.trend === "up" && <span className="text-[11px] text-[var(--up)]">▲ improving</span>}
              {h.trend === "down" && <span className="text-[11px] text-[var(--urgent)]">▼ slipping</span>}
              <span className="nums w-10 shrink-0 text-right text-[12px] font-medium">
                {Math.round(rate * 100)}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${Math.max(rate * 100, 3)}%`, background: bar }}
              />
            </div>
            {/* The weekday it dies on shows for every habit, holding or not —
                "holds, except Fridays" is the most useful thing on this card.
                How long since it was last kept only matters once it is
                slipping. */}
            {(h.weakDays.length > 0 || (showWhy && (h.lastKept == null || h.lastKept > 2))) && (
              <p className="text-[11px] text-ink-3">
                {h.weakDays.length > 0 && `Usually missed on ${weekdayNames(h.weakDays)}. `}
                {showWhy &&
                  (h.lastKept == null
                    ? "Never kept yet."
                    : h.lastKept > 2
                      ? `Last kept ${h.lastKept} days ago.`
                      : "")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Which part of the planned day actually happens.
 *
 * Bars rather than a percentage, and a sentence written from them, because the
 * finding is almost always a contrast — mornings hold, evenings do not — and a
 * contrast is something you see before you read it.
 */
function Rhythm({ plan }: { plan: ReturnType<typeof planPatterns> }) {
  const parts = plan.byPart.filter((p) => p.planned > 0);
  if (plan.planned < 4 || parts.length === 0) return null;

  const rate = (p: { planned: number; done: number }) => p.done / p.planned;
  const best = [...parts].sort((a, b) => rate(b) - rate(a))[0];
  const worst = [...parts].sort((a, b) => rate(a) - rate(b))[0];
  const contrast = parts.length > 1 && rate(best) - rate(worst) >= 0.25;

  return (
    <section>
      <SectionTitle right={<span className="text-xs text-ink-3">last 14 days</span>}>
        When your plan happens
      </SectionTitle>
      <div className="rounded-2xl border border-line bg-panel p-4 shadow-[var(--shadow),var(--edge)]">
        <div className="flex h-32 items-end gap-3">
          {parts.map((p) => {
            const r = rate(p);
            const tone = r >= 0.7 ? "var(--up)" : r >= 0.45 ? "var(--high)" : "var(--urgent)";
            return (
              <div key={p.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                <span className="nums text-[12px] font-semibold" style={{ color: tone }}>
                  {Math.round(r * 100)}%
                </span>
                <div className="relative w-full max-w-[56px] flex-1 overflow-hidden rounded-lg bg-panel-2">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-lg transition-[height] duration-700"
                    style={{ height: `${Math.max(r * 100, 4)}%`, background: tone }}
                  />
                </div>
                <span className="text-center text-[11px] capitalize text-ink-3">{p.label}</span>
                <span className="nums text-[10px] text-ink-3">
                  {p.done}/{p.planned}
                </span>
              </div>
            );
          })}
        </div>
        {contrast && (
          <p className="mt-3 border-t border-line pt-3 text-[12.5px] leading-relaxed text-ink-2">
            <span className="capitalize">{best.label}</span> blocks happen {Math.round(rate(best) * 100)}% of
            the time; {worst.label} ones, {Math.round(rate(worst) * 100)}%. Put the work that
            matters where it actually gets done.
          </p>
        )}
      </div>
    </section>
  );
}

/** What the score is made of, so it can be argued with. */
function Signals({ signals }: { signals: ReturnType<typeof productivity>["signals"] }) {
  const used = signals.filter((s) => s.rate != null);
  if (used.length === 0) return null;

  return (
    <section>
      <SectionTitle>What the score is made of</SectionTitle>
      <div className="grid gap-3 rounded-2xl border border-line bg-panel p-4 shadow-[var(--shadow),var(--edge)]">
        {used.map((s) => {
          const r = s.rate ?? 0;
          return (
            <div key={s.key} className="grid gap-1">
              <div className="flex items-baseline gap-2">
                <span className="flex-1 text-[13px]">{s.label}</span>
                <span className="text-[11px] text-ink-3">{s.detail}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-700"
                  style={{ width: `${Math.max(r * 100, 3)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
