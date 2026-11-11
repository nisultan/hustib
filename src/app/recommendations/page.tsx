"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "@/lib/store";
import { AREA_LABEL, RecArea, Recommendation, recommend } from "@/lib/recommendations";
import { productivity } from "@/lib/productivity";
import { habitPatterns, HabitPattern, planPatterns, weekdayNames } from "@/lib/consistency";
import { daysUntil, todayISO } from "@/lib/dates";
import { SectionTitle } from "@/components/ui";
import { Insights } from "@/components/Insights";
import { Flame } from "@/components/Flame";

/**
 * Advice: one clear next move, then everything else worth doing.
 *
 * The old page was a board of numbers with the suggestions squeezed into
 * one-line rows, so the most useful thing on it was the least visible. Now
 * the strongest suggestion is the page: what to do, why, the numbers behind
 * it and a button that goes and does it. The rest follow as cards that can be
 * filtered by area and put off until later or marked done. The evidence the
 * suggestions come from sits on the right, for anyone who wants to check it.
 */

const AREA_TONE: Record<RecArea, string> = {
  school: "var(--accent)",
  body: "var(--up)",
  habits: "var(--high)",
  life: "#e879f9",
};

const HIDDEN_KEY = "lockin.advice.hidden";
const LATER_MS = 20 * 3600_000;
const DONE_MS = 7 * 86_400_000;

function useHidden() {
  const [hidden, setHidden] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      setHidden(JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "{}"));
    } catch {}
  }, []);
  const save = (next: Record<string, number>) => {
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {}
  };
  const now = Date.now();
  return {
    isHidden: (id: string) => (hidden[id] ?? 0) > now,
    hide: (id: string, ms: number) => save({ ...hidden, [id]: Date.now() + ms }),
    restore: () => save({}),
  };
}

export default function RecommendationsPage() {
  const store = useStore();
  const today = todayISO();
  const all = useMemo(() => (store.ready ? recommend(store, 14) : []), [store]);
  const score = useMemo(() => productivity(store), [store]);
  const habits = useMemo(() => habitPatterns(store, today), [store, today]);
  const plan = useMemo(() => planPatterns(store, today), [store, today]);
  const { isHidden, hide, restore } = useHidden();
  const [area, setArea] = useState<RecArea | "all">("all");

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  const visible = all.filter((r) => !isHidden(r.id));
  const hiddenCount = all.length - visible.length;
  const [hero, ...rest] = visible;
  const areas = (Object.keys(AREA_LABEL) as RecArea[]).filter((a) => rest.some((r) => r.area === a));
  const list = area === "all" ? rest : rest.filter((r) => r.area === area);
  const urgent = visible.filter((r) => r.weight >= 70).length;

  const open = store.tasks.filter((t) => t.status !== "completed");
  const overdue = open.filter((t) => t.dueDate != null && daysUntil(t.dueDate) < 0).length;
  const week = open.filter((t) => t.dueDate != null && daysUntil(t.dueDate) >= 0 && daysUntil(t.dueDate) <= 7).length;

  return (
    <div className="page-in">
      <header className="mb-6">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">
          {new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight">Advice</h1>
        <p className="mt-1 text-[14px] text-ink-2">
          {visible.length === 0
            ? "Nothing left to act on. Enjoy it."
            : urgent > 0
              ? `${urgent} ${urgent === 1 ? "thing needs" : "things need"} you soon. ${Math.max(0, visible.length - urgent)} more can wait.`
              : `Nothing urgent. ${visible.length} ${visible.length === 1 ? "idea" : "ideas"} for making the week better.`}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start">
        <div className="grid min-w-0 gap-6">
          <AnimatePresence mode="popLayout" initial={false}>
            {hero ? (
              <Hero key={hero.id} rec={hero} onLater={() => hide(hero.id, LATER_MS)} onDone={() => hide(hero.id, DONE_MS)} />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-dashed border-line px-6 py-12 text-center"
              >
                <p className="text-[18px] font-semibold">You are clear</p>
                <p className="mt-1 text-[13.5px] text-ink-3">New advice shows up as your week changes.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {rest.length > 0 && (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[15px] font-bold tracking-tight">Also worth doing</h2>
                <div className="flex flex-wrap gap-1">
                  <Chip on={area === "all"} onClick={() => setArea("all")} label="All" n={rest.length} />
                  {areas.map((a) => (
                    <Chip
                      key={a}
                      on={area === a}
                      onClick={() => setArea(a)}
                      label={AREA_LABEL[a]}
                      n={rest.filter((r) => r.area === a).length}
                      tone={AREA_TONE[a]}
                    />
                  ))}
                </div>
              </div>
              <motion.div layout className="grid gap-3 sm:grid-cols-2">
                <AnimatePresence initial={false}>
                  {list.map((r, i) => (
                    <Card key={r.id} rec={r} i={i} onLater={() => hide(r.id, LATER_MS)} onDone={() => hide(r.id, DONE_MS)} />
                  ))}
                </AnimatePresence>
              </motion.div>
            </section>
          )}

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={restore}
              className="justify-self-start text-[12.5px] font-medium text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink"
            >
              {hiddenCount} put aside · bring back
            </button>
          )}
        </div>

        <aside className="grid min-w-0 gap-6">
          <ScoreCard
            score={score.score}
            delta={score.delta}
            streak={score.streak}
            best={score.bestStreak}
            habits={habitsRate(habits)}
            plan={plan.planned === 0 ? null : plan.done / plan.planned}
            week={week}
            overdue={overdue}
          />
          <Insights />
          <HoldingSlipping habits={habits} />
          <Rhythm plan={plan} />
          <Signals signals={score.signals} />
        </aside>
      </div>
    </div>
  );
}

function habitsRate(habits: HabitPattern[]): number | null {
  let kept = 0;
  let due = 0;
  for (const h of habits) {
    if (h.recent == null) continue;
    const n = h.due / 2;
    kept += h.recent * n;
    due += n;
  }
  return due === 0 ? null : kept / due;
}

/* ------------------------------- The next move ------------------------------- */

function AreaTag({ area }: { area: RecArea }) {
  const tone = AREA_TONE[area];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: tone }}>
      <span className="size-1.5 rounded-full" style={{ background: tone }} />
      {AREA_LABEL[area]}
    </span>
  );
}

function Facts({ facts, big = false }: { facts?: string[]; big?: boolean }) {
  if (!facts?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {facts.map((f) => (
        <span
          key={f}
          className={`nums rounded-md bg-panel-2 font-medium text-ink-2 ${big ? "px-2.5 py-1 text-[12.5px]" : "px-2 py-0.5 text-[11.5px]"}`}
        >
          {f}
        </span>
      ))}
    </div>
  );
}

function Hero({ rec, onLater, onDone }: { rec: Recommendation; onLater: () => void; onDone: () => void }) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="relative overflow-hidden rounded-2xl border border-line bg-panel p-6 shadow-[var(--shadow-lg),var(--edge)] sm:p-8"
    >
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">Your next move</p>
          <AreaTag area={rec.area} />
        </div>
        <h2 className="mt-3 text-[clamp(22px,3vw,30px)] font-bold leading-tight tracking-tight">{rec.title}</h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">{rec.text}</p>
        <div className="mt-4">
          <Facts facts={rec.facts} big />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Link
            href={rec.href}
            className="group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold text-white transition-transform active:scale-[0.97]"
            style={{ background: "var(--accent)" }}
          >
            {rec.action}
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <button
            type="button"
            onClick={onDone}
            className="rounded-xl border border-line px-4 py-2.5 text-[13.5px] font-semibold text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink"
          >
            Done
          </button>
          <button
            type="button"
            onClick={onLater}
            className="rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
          >
            Later
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function Chip({ on, onClick, label, n, tone }: { on: boolean; onClick: () => void; label: string; n: number; tone?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
        on ? "border-transparent bg-ink text-bg" : "border-line text-ink-2 hover:bg-panel-2"
      }`}
    >
      {tone && <span className="size-1.5 rounded-full" style={{ background: tone }} />}
      {label}
      <span className={`nums ${on ? "opacity-70" : "text-ink-3"}`}>{n}</span>
    </button>
  );
}

function Card({ rec, i, onLater, onDone }: { rec: Recommendation; i: number; onLater: () => void; onDone: () => void }) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.03 } }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      className="group flex flex-col rounded-2xl border border-line bg-panel p-4 shadow-[var(--shadow),var(--edge)] transition-colors hover:bg-[color-mix(in_srgb,var(--panel-2)_45%,var(--panel))]"
    >
      <AreaTag area={rec.area} />
      <h3 className="mt-2 text-[15px] font-semibold leading-snug tracking-tight">{rec.title}</h3>
      <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-ink-2" title={rec.text}>
        {rec.text}
      </p>
      {rec.facts?.length ? (
        <div className="mt-3">
          <Facts facts={rec.facts} />
        </div>
      ) : null}
      <div className="mt-auto flex items-center gap-1 pt-4">
        <Link href={rec.href} className="mr-auto inline-flex items-center gap-1 text-[13px] font-semibold text-accent-text hover:underline">
          {rec.action}
          <span aria-hidden>→</span>
        </Link>
        <button
          type="button"
          onClick={onLater}
          className="rounded-md px-2 py-1 text-[12px] font-medium text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
        >
          Later
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-2 py-1 text-[12px] font-medium text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
        >
          Done
        </button>
      </div>
    </motion.article>
  );
}

/* ------------------------------- The evidence ------------------------------- */

const RING = 2 * Math.PI * 34;

function ScoreCard({
  score,
  delta,
  streak,
  best,
  habits,
  plan,
  week,
  overdue,
}: {
  score: number | null;
  delta: number | null;
  streak: number;
  best: number;
  habits: number | null;
  plan: number | null;
  week: number;
  overdue: number;
}) {
  const tone = score == null ? "var(--text-3)" : score >= 70 ? "var(--up)" : score >= 45 ? "var(--high)" : "var(--urgent)";
  const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 shadow-[var(--shadow),var(--edge)]">
      <div className="flex items-center gap-4">
        <span className="relative grid size-[76px] shrink-0 place-items-center">
          <svg viewBox="0 0 80 80" className="absolute inset-0 size-full -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke={tone} strokeWidth="7" opacity="0.14" />
            {score != null && (
              <motion.circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke={tone}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={RING}
                initial={{ strokeDashoffset: RING }}
                animate={{ strokeDashoffset: RING * (1 - score / 100) }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
          </svg>
          <span className="nums relative text-[24px] font-bold tracking-tight" style={{ color: tone }}>
            {score ?? "—"}
          </span>
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3">Consistency</p>
          <p className="mt-0.5 text-[14px] font-medium leading-snug">{verdict(score)}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-3">
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
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4">
        <Mini label="Habits kept" value={pct(habits)} />
        <Mini label="Plan done" value={pct(plan)} />
        <Mini label="Due in 7 days" value={String(week)} hint={overdue > 0 ? `${overdue} late` : undefined} />
      </div>
    </section>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="nums text-[19px] font-bold leading-none tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-ink-3">{label}</p>
      {hint && <p className="text-[11px] font-medium text-[var(--urgent)]">{hint}</p>}
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

  return <HabitsCard holding={holding} slipping={slipping} />;
}

/**
 * Four habits at most until asked — the two worst slipping and the two best
 * holding — and the per-habit reasons only once the list is opened. Nine bars
 * each with a "last kept 26 days ago" under it was a report; the four that say
 * the most are a glance.
 */
function HabitsCard({ holding, slipping }: { holding: HabitPattern[]; slipping: HabitPattern[] }) {
  const [all, setAll] = useState(false);
  const total = holding.length + slipping.length;
  const s = all ? slipping : slipping.slice(0, 2);
  const h = all ? holding : holding.slice(0, Math.max(0, 4 - s.length));

  return (
    <section>
      <SectionTitle right={<span className="text-xs text-ink-3">last 14 days</span>}>
        What you keep
      </SectionTitle>
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="grid gap-3 p-4">
          {s.length > 0 && <Group title="Slipping" tone="var(--urgent)" habits={s} showWhy={all} />}
          {s.length > 0 && h.length > 0 && <div className="border-t border-line" />}
          {h.length > 0 && <Group title="Holding" tone="var(--up)" habits={h} showWhy={all} />}
        </div>
        {total > 4 && (
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            className="w-full border-t border-line px-4 py-2.5 text-left text-[13px] font-medium text-accent-text transition-colors hover:bg-panel-2"
          >
            {all ? "Show fewer" : `Show all ${total} habits`}
          </button>
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
      <p className="text-[12.5px] font-semibold tracking-[0.08em]" style={{ color: tone }}>
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
            {showWhy && (h.weakDays.length > 0 || h.lastKept == null || h.lastKept > 2) && (
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
  const [open, setOpen] = useState(false);
  const used = signals.filter((s) => s.rate != null);
  if (used.length === 0) return null;

  // The working, for anyone who wants to argue with the number — and folded
  // away for everyone else.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="justify-self-start text-[13px] font-medium text-accent-text hover:underline"
      >
        How is the consistency score worked out?
      </button>
    );
  }

  return (
    <section>
      <SectionTitle
        right={
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-3 hover:text-ink">
            Hide
          </button>
        }
      >
        What the score is made of
      </SectionTitle>
      <div className="grid gap-3 rounded-xl border border-line bg-panel p-4">
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
