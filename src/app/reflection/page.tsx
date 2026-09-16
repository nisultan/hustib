"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { addDays, formatDate, pastLabel, todayISO } from "@/lib/dates";
import { Block } from "@/lib/types";
import { BlockEditor } from "@/components/BlockEditor";
import { DateField } from "@/components/DateField";
import { Button, PageHeader, Panel, SectionTitle } from "@/components/ui";

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
 * Deliberately sparse — the date, a way back, and the page. Every control that
 * is not writing is one more thing to look at instead of writing.
 */
function FocusMode({
  date,
  today,
  blocks,
  onChange,
  onDate,
  onClose,
}: {
  date: string;
  today: string;
  blocks: Block[];
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      {/* The width is a computed value rather than a utility class: Tailwind
          does not generate an arbitrary `min()` with a comma in it, so the
          class was applied and silently did nothing. */}
      <div
        className="mx-auto w-full px-5 py-10 transition-[max-width] duration-300 sm:px-8 sm:py-16"
        style={{ maxWidth: wide ? "min(1400px, 92vw)" : "42rem" }}
      >
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Step
              label="Previous day"
              onClick={() => onDate(addDays(date, -1))}
              d="M10 3.5 L5.5 8 L10 12.5"
            />
            <div className="min-w-[140px] text-center">
              <p className="text-sm font-semibold tracking-tight">{formatDate(date)}</p>
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

        <BlockEditor
          key={date}
          blocks={blocks}
          onChange={onChange}
          placeholder="How did it go? Press / for a heading, list, image or link."
        />
      </div>
    </div>
  );
}
