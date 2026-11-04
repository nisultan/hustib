"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Pillar, PillarKey, primeReading, RANKS } from "@/lib/prime";

/**
 * Prime → Locked In → Cooking → Mid → Cooked → Anti-Prime.
 *
 * The verdict sits on a ladder so you can see how far you are from the next
 * step, with six small bars underneath, one per pillar, so you can see why.
 * Tapping a bar says what it is based on and what would lift it. The model
 * itself lives in `lib/prime.ts`. It runs locally, so it costs no AI tokens
 * and refreshes the moment you tick something.
 */
const ICON: Record<PillarKey, string> = {
  execution: "M4 10.5 8 14.5 16 5.5",
  consistency: "M3.5 5h13v11h-13zM3.5 8.5h13M7 3v3M13 3v3",
  momentum: "M3 14 8 9l3 3 6-6M12.5 6H17v4.5",
  mind: "M5 3.5h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5zM8.5 8h3.5M8.5 11h3.5",
  body: "M10 16.5s-6-3.6-6-8a3.4 3.4 0 0 1 6-2.2 3.4 3.4 0 0 1 6 2.2c0 4.4-6 8-6 8z",
  goals: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
};

function barColor(score: number): string {
  if (score >= 75) return "var(--up)";
  if (score >= 55) return "var(--accent)";
  if (score >= 40) return "var(--high)";
  return "var(--urgent)";
}

export function PrimeMeter() {
  const store = useStore();
  const reading = useMemo(() => primeReading(store), [store]);
  const [open, setOpen] = useState<PillarKey | null>(null);

  if (!reading.enoughData || reading.score == null || !reading.rank) {
    return (
      <section className="rounded-xl border border-line bg-panel px-5 py-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3">Your form</p>
        <p className="mt-1 text-[14px] text-ink-2">
          A few more days of ticking habits, blocks and writing, and this will tell you whether you&apos;re in your prime.
        </p>
      </section>
    );
  }

  const { rank, score, previous } = reading;
  const ladder = [...RANKS].reverse(); // Anti-Prime on the left, Prime on the right
  const rankIndex = ladder.findIndex((r) => r.key === rank.key);
  const prevIndex = previous ? ladder.findIndex((r) => r.key === previous.rank.key) : null;
  const moved = prevIndex == null ? 0 : rankIndex - prevIndex;
  const pillars = reading.pillars.filter((p): p is Pillar & { score: number } => p.score != null);
  const selected = pillars.find((p) => p.key === open) ?? null;

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 pb-4 pt-4">
        {/* Verdict */}
        <div className="flex min-w-[220px] flex-1 items-center gap-4">
          <div
            className="grid size-[64px] shrink-0 place-items-center rounded-2xl"
            style={{ background: `color-mix(in srgb, ${rank.color} 15%, transparent)`, color: rank.color }}
          >
            <span className="nums text-[24px] font-bold leading-none">{score}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-3">Your form right now</p>
            <p className="flex items-baseline gap-2">
              <span className="text-[24px] font-bold leading-tight tracking-tight" style={{ color: rank.color }}>
                {rank.name}
              </span>
              {previous && moved !== 0 && (
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: moved > 0 ? "var(--up)" : "var(--urgent)" }}
                >
                  {moved > 0 ? "▲" : "▼"} from {previous.rank.name}
                </span>
              )}
              {previous && moved === 0 && <span className="text-[12px] text-ink-3">same as last week</span>}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{rank.line}</p>
          </div>
        </div>
      </div>

      {/* The ladder */}
      <div className="px-5">
        <div className="grid grid-cols-6 gap-1">
          {ladder.map((r, i) => {
            const here = i === rankIndex;
            return (
              <div key={r.key} className="min-w-0">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    background: i <= rankIndex ? r.color : "var(--panel-2)",
                    opacity: here ? 1 : i < rankIndex ? 0.45 : 1,
                  }}
                />
                <p
                  className={`mt-1.5 truncate text-center text-[10.5px] sm:text-[11.5px] ${here ? "font-bold" : "text-ink-3"}`}
                  style={here ? { color: r.color } : undefined}
                >
                  {r.name}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pillars */}
      <div className="mt-4 grid grid-cols-3 gap-px border-t border-line bg-[var(--border)] sm:grid-cols-6">
        {pillars.map((p) => {
          const active = open === p.key;
          const weak = reading.weakest?.key === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setOpen(active ? null : p.key)}
              aria-expanded={active}
              className={`flex flex-col items-start gap-1.5 px-3 py-2.5 text-left transition-colors ${active ? "bg-panel-2" : "bg-panel hover:bg-panel-2"}`}
            >
              <span className="flex w-full items-center gap-1.5 text-[11.5px] font-semibold text-ink-2">
                <svg viewBox="0 0 20 20" aria-hidden className="size-3.5 shrink-0" style={{ color: barColor(p.score) }}>
                  <path d={ICON[p.key]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="truncate">{p.label}</span>
                {weak && <span className="ml-auto text-[10px] font-bold text-[var(--urgent)]">weak</span>}
              </span>
              <span className="flex w-full items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                  <span
                    className="grow-x block h-full rounded-full"
                    style={{ width: `${Math.max(p.score, 3)}%`, background: barColor(p.score) }}
                  />
                </span>
                <span className="nums w-6 text-right text-[11.5px] font-semibold">{p.score}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* One line: the detail of the tapped pillar, or how to move up. */}
      <div className="border-t border-line px-5 py-2.5 text-[13px]">
        {selected ? (
          <p>
            <span className="font-semibold">{selected.label}:</span> <span className="text-ink-2">{selected.why}.</span>{" "}
            {selected.fix && <span className="text-ink-3">{selected.fix}</span>}
          </p>
        ) : reading.weakest ? (
          <p>
            <span className="font-semibold text-accent-text">To move up:</span>{" "}
            <span className="text-ink-2">{reading.heldBack ?? reading.weakest.fix}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
