"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { productivity } from "@/lib/productivity";
import { Panel, SectionTitle } from "./ui";

/**
 * How consistently the student is running their own system.
 *
 * Shown with its working out, always. A single number nobody can interrogate
 * either gets believed when it is wrong or ignored when it is right, and this
 * one is assembled from five things the student can check line by line.
 *
 * Signals they do not use are not shown as zeros — someone who never logs
 * weight is not failing at weight, it simply is not part of how they work.
 */
export function Productivity({ compact = false }: { compact?: boolean }) {
  const store = useStore();
  const result = useMemo(() => productivity(store), [store]);

  if (!store.ready) return null;

  // Nothing to measure yet. A score assembled from three days would be a
  // number pretending to be a judgement.
  if (result.score == null) {
    if (compact) return null;
    return (
      <section className="mb-8">
        <SectionTitle>Consistency</SectionTitle>
        <Panel className="px-4 py-6 text-center">
          <p className="text-sm text-ink-2">Not enough history yet.</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-3">
            Keep logging for a few more days and this starts tracking how consistently you show
            up — not how much you get done.
          </p>
        </Panel>
      </section>
    );
  }

  const used = result.signals.filter((s) => s.rate != null);

  return (
    <section className="mb-8">
      <SectionTitle
        right={
          result.streak > 0 ? (
            <span className="text-xs text-ink-3">
              {result.streak}-day streak
              {result.bestStreak > result.streak && ` · best ${result.bestStreak}`}
            </span>
          ) : undefined
        }
      >
        Consistency
      </SectionTitle>

      <Panel className="px-4 py-4">
        <div className="flex items-end gap-3">
          <p className="nums text-3xl font-semibold leading-none tracking-tight">
            {result.score}
          </p>
          <div className="flex-1 pb-0.5">
            <p className="text-xs text-ink-2">
              {verdict(result.score)}
              {result.delta != null && result.delta !== 0 && (
                <span
                  className="ml-1.5"
                  style={{ color: result.delta > 0 ? "var(--up)" : "var(--down)" }}
                >
                  {result.delta > 0 ? "+" : ""}
                  {result.delta} vs before
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-3">
              Over the last {result.windowDays} days, not counting today.
            </p>
          </div>
        </div>

        {!compact && (
          <div className="mt-4 grid gap-2.5">
            {used.map((signal) => (
              <div key={signal.key} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs text-ink-2">{signal.label}</span>
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2"
                  role="img"
                  aria-label={`${signal.label}: ${Math.round((signal.rate ?? 0) * 100)}%`}
                >
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${Math.round((signal.rate ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="w-[116px] shrink-0 text-right text-[11px] text-ink-3">
                  {signal.detail}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </section>
  );
}

/**
 * Plain language for the number, and deliberately not praise.
 *
 * A score that says "amazing!" at 80 is worthless at 80, and the student knows
 * it. These describe what the figure means and stop.
 */
function verdict(score: number): string {
  if (score >= 85) return "You are showing up almost every day.";
  if (score >= 70) return "Steady, with the odd gap.";
  if (score >= 50) return "On and off. The system works when you use it.";
  if (score >= 30) return "Slipping. Pick one thing to keep daily.";
  return "Mostly not logging. Start with one thing.";
}
