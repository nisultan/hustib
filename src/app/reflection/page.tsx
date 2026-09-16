"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { addDays, formatDate, pastLabel, todayISO } from "@/lib/dates";
import { Block } from "@/lib/types";
import { BlockEditor } from "@/components/BlockEditor";
import { DateField } from "@/components/DateField";
import { Button, PageHeader, Panel, SectionTitle } from "@/components/ui";
import { motion } from "motion/react";
import { spring } from "@/lib/motion";

/** Where the wide-column preference is kept. */
const WIDE_KEY = "iblearner.reflectionWide";

export default function ReflectionPage() {
  const store = useStore();
  const [date, setDate] = useState(() => todayISO());
  const [focus, setFocus] = useState(false);

  // Escape leaves focus mode. It is the only way out that does not require
  // finding a button on a page deliberately stripped of them.
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocus(false);
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll under the overlay.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [focus]);

  const byDate = useMemo(() => new Map(store.days.map((d) => [d.date, d])), [store.days]);

  const written = useMemo(
    () =>
      store.days
        .filter((d) => d.reflection.some((b) => b.text.trim() !== ""))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [store.days],
  );

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  const today = todayISO();
  const reflection = byDate.get(date)?.reflection ?? [];

  if (focus) {
    return (
      <FocusMode
        date={date}
        today={today}
        blocks={reflection}
        streak={streak(store.days, today)}
        onChange={(blocks) => store.setDay(date, { reflection: blocks })}
        onDate={setDate}
        onClose={() => setFocus(false)}
      />
    );
  }

  return (
    <div className="page-in">
      <PageHeader
        title="Reflection"
        subtitle="A page a day. What happened, what it felt like, what to do about it."
      />

      <Panel className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-1">
            <Step
              label="Previous day"
              onClick={() => setDate(addDays(date, -1))}
              d="M10 3.5 L5.5 8 L10 12.5"
            />
            <div className="min-w-[132px] text-center">
              <p className="text-base font-semibold tracking-tight">{formatDate(date)}</p>
              <p className="text-xs text-ink-3">{pastLabel(date)}</p>
            </div>
            <Step
              label="Next day"
              onClick={() => setDate(addDays(date, 1))}
              d="M6 3.5 L10.5 8 L6 12.5"
            />
          </div>

          <div className="flex items-center gap-2">
            {date !== today && (
              <Button size="sm" onClick={() => setDate(today)}>
                Today
              </Button>
            )}
            <button
              onClick={() => setFocus(true)}
              aria-label="Focus mode"
              title="Focus mode"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
            >
              <svg viewBox="0 0 16 16" aria-hidden className="size-4">
                <path
                  d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div className="w-[190px]">
              <DateField value={date} onChange={(v) => setDate(v || today)} />
            </div>
          </div>
        </div>

        <BlockEditor
          // Remounting per day, so an edit to one morning cannot land in
          // another when the date changes mid-keystroke.
          key={date}
          blocks={reflection}
          onChange={(blocks) => store.setDay(date, { reflection: blocks })}
          placeholder="How did it go? Press / for a heading, list, image or link."
        />
      </Panel>

      {written.length > 0 && (
        <section className="mt-8">
          <SectionTitle>Earlier</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {written
              .filter((d) => d.date !== date)
              .slice(0, 12)
              .map((day) => (
                <button key={day.date} onClick={() => setDate(day.date)} className="text-left">
                  <Panel interactive className="h-full px-3.5 py-3">
                    <p className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{formatDate(day.date)}</span>
                      <span className="shrink-0 text-xs text-ink-3">{pastLabel(day.date)}</span>
                    </p>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-2">
                      {summarise(day.reflection)}
                    </p>
                  </Panel>
                </button>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Step({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-4">
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/** The opening words, so a card shows the entry rather than its shape. */
/**
 * Consecutive days written, counting back from today.
 *
 * Today not being written yet does not break the streak — it has not happened
 * yet. A journal that resets your count at midnight for not having lived the
 * day out is a journal you stop opening.
 */
function streak(days: { date: string; reflection: Block[] }[], today: string): number {
  const written = new Set(
    days.filter((d) => d.reflection.some((b) => b.text.trim() !== "")).map((d) => d.date),
  );

  let cursor = written.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (written.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function summarise(blocks: Block[]): string {
  return (
    blocks
      .filter((b) => b.text.trim() !== "")
      .map((b) => b.text.trim())
      .join(" · ") || "—"
  );
}

/**
 * The journal, alone on the screen.
 *
 * Fixed over everything rather than a wider column: the point of asking for
 * this is to stop seeing the deadline counters and the nav while writing about
 * your day, and a page that merely got wider still has all of that on it.
 *
 * Sparse, but not bare. The first version was text on the raw background with
 * nothing else on screen, and an empty day read as a fault rather than an
 * invitation — there was no surface, no edge, nothing to write *on*. The page
 * is a lit sheet now, the day it belongs to is stated once at the top, and
 * what you have written is counted at the foot. That is the whole addition:
 * everything else is still the page.
 */
function FocusMode({
  date,
  today,
  blocks,
  streak,
  onChange,
  onDate,
  onClose,
}: {
  date: string;
  today: string;
  blocks: Block[];
  /** Consecutive days written, ending today. Shown at the foot. */
  streak: number;
  onChange: (blocks: Block[]) => void;
  onDate: (date: string) => void;
  onClose: () => void;
}) {
  // Remembered per device: whether someone writes in a column or across the
  // whole screen is a standing preference, not a per-session decision.
  const [wide, setWide] = useState(() => {
    try {
      return localStorage.getItem(WIDE_KEY) === "1";
    } catch {
      return false;
    }
  });

  // The write stays outside the updater. React invokes updaters twice in
  // development to surface exactly this kind of side effect, which toggled the
  // value twice and left it unchanged — the button appeared dead.
  const toggleWide = () => {
    const next = !wide;
    setWide(next);
    try {
      localStorage.setItem(WIDE_KEY, next ? "1" : "0");
    } catch {
      // Private browsing. The choice still holds for this session.
    }
  };

  const written = blocks.filter((b) => b.text.trim() !== "").length;
  const words = blocks
    .map((b) => b.text)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      {/* One wash of colour, thrown from above the page.

          Not decoration for its own sake: a full-bleed flat background gives
          the eye no depth cue at all, so the sheet below had nothing to sit
          against. At this strength it is barely nameable as a colour — it just
          stops the screen reading as switched off. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[42vh] opacity-[0.55]"
        style={{
          background:
            "radial-gradient(90% 100% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)",
        }}
      />

      {/* The width is a computed value rather than a utility class: Tailwind
          does not generate an arbitrary `min()` with a comma in it, so the
          class was applied and silently did nothing. */}
      <div
        className="relative mx-auto w-full px-5 py-10 transition-[max-width] duration-300 sm:px-8 sm:py-16"
        style={{ maxWidth: wide ? "min(1400px, 92vw)" : "42rem" }}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Step
              label="Previous day"
              onClick={() => onDate(addDays(date, -1))}
              d="M10 3.5 L5.5 8 L10 12.5"
            />
            <div className="min-w-[140px] text-center">
              <p className="text-[15px] font-semibold tracking-tight">{formatDate(date)}</p>
              <p className="text-xs text-ink-3">{pastLabel(date)}</p>
            </div>
            <Step
              label="Next day"
              onClick={() => onDate(addDays(date, 1))}
              d="M6 3.5 L10.5 8 L6 12.5"
            />
            {date !== today && (
              <Button size="sm" onClick={() => onDate(today)}>
                Today
              </Button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={toggleWide}
              aria-pressed={wide}
              aria-label={wide ? "Narrow column" : "Wide column"}
              title={wide ? "Narrow column" : "Wide column"}
              className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
            >
              <svg viewBox="0 0 16 16" aria-hidden className="size-4">
                {wide ? (
                  <path
                    d="M5.5 4 3 8l2.5 4M10.5 4 13 8l-2.5 4M8 2.5v11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <path
                    d="M2.5 4 5 8l-2.5 4M13.5 4 11 8l2.5 4M8 2.5v11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            </button>

            <button
              onClick={onClose}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
            >
              <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
                <path
                  d="M2 6h4V2M14 6h-4V2M2 10h4v4M14 10h-4v4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Exit
              <kbd className="ml-0.5 rounded border border-line px-1 text-[10px]">Esc</kbd>
            </button>
          </div>
        </div>

        {/*
          The sheet. A page you are writing on should have an edge and catch
          some light; without one the words were floating in the dark and the
          left margin was wherever the longest line happened to end.
        */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          // A minimum height, so a day with one line on it still looks like a
          // page you have started rather than a box that failed to fill.
          className="min-h-[46vh] rounded-2xl border border-line bg-panel px-4 py-6 shadow-[var(--shadow-lg),var(--edge)] sm:px-8 sm:py-9"
        >
          <BlockEditor
            key={date}
            blocks={blocks}
            onChange={onChange}
            placeholder="How did it go? Press / for a heading, list, image or link."
          />
        </motion.div>

        {/*
          What you have written, at the foot where a manuscript keeps it.

          The streak is the only number here that is about more than today, and
          it is the reason to open this tomorrow as well — a journal's whole
          difficulty is the second week, not the first.
        */}
        <div className="mt-4 flex items-center gap-3 px-1 text-[11px] text-ink-3">
          <span className="nums">
            {words} {words === 1 ? "word" : "words"}
          </span>
          {words > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="nums">
                {written} {written === 1 ? "block" : "blocks"}
              </span>
            </>
          )}
          {streak > 1 && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-text">
              <span aria-hidden className="size-1.5 rounded-full bg-accent" />
              {streak} days in a row
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
