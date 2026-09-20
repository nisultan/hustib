"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { useReflection } from "@/lib/ai/useReflection";
import { Insight, INSIGHT_LABEL } from "@/lib/types";
import { SectionTitle } from "./ui";

/**
 * What the hub noticed, when asked to look.
 *
 * Distinct from the rule-based recommendations beside it, and marked as such:
 * a rule is a guarantee ("this is overdue"), while these are a reading of a
 * particular week and can be wrong. Each one shows what it was drawn from, so
 * the student can check the reasoning rather than take it on faith, and each
 * can be dismissed for good.
 *
 * Nothing here runs on its own. Reading a term of journal entries costs real
 * money, and a paragraph the student did not ask for is not worth paying for
 * on a timer — especially when the honest answer is often that nothing has
 * changed. So the button is the feature: it is asked, it looks, it answers.
 */

export function Insights({ limit }: { limit?: number }) {
  const store = useStore();
  const { reflect, running, error, outcome, ready } = useReflection();

  const live = store.insights.filter((i) => i.dismissedAt == null);
  const shown = limit ? live.slice(0, limit) : live;
  const untouched = shown.length === 0 && !running && outcome == null && error == null;

  return (
    <section className="mb-8">
      <SectionTitle
        right={
          shown.length > 0 || outcome != null ? (
            <button
              onClick={() => void reflect()}
              disabled={running}
              className="text-xs text-ink-3 transition-colors hover:text-ink disabled:opacity-50"
            >
              {running ? "Thinking…" : "Look again"}
            </button>
          ) : undefined
        }
      >
        Noticed about you
      </SectionTitle>

      {untouched ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-7 text-center">
          <p className="text-[13px] leading-relaxed text-ink-2">
            {ready
              ? "I can read back through your reflections, grades and habits and tell you what I see."
              : "Not enough recorded yet. Add your courses and a few tasks, and this starts noticing things."}
          </p>
          <button
            onClick={() => void reflect()}
            disabled={!ready || running}
            className="mt-3 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Tell me about me
          </button>
          <p className="mt-2 text-[11px] text-ink-3">
            Only when you ask — it does not run on its own.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3.5 py-6 text-center text-sm text-ink-3">
          {running
            ? "Reading back through your week…"
            : "Nothing new worth flagging since last time."}
        </p>
      ) : (
        <div className="grid gap-2">
          {shown.map((insight) => (
            <Card
              key={insight.id}
              insight={insight}
              onDismiss={() => store.dismissInsight(insight.id)}
            />
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-[var(--urgent)]">{error}</p>}

      {/* A pass that finds nothing is a real result, and saying so is the
          difference between restraint and a button that appears to do
          nothing. */}
      {!error && outcome && outcome.insightsAdded === 0 && (
        <p className="mt-2 text-xs text-ink-3">
          {outcome.memoryChanged
            ? "Read through your week — nothing new worth flagging, but I updated what I know about you."
            : "Read through your week. Nothing new worth flagging since last time."}
        </p>
      )}
    </section>
  );
}

function Card({ insight, onDismiss }: { insight: Insight; onDismiss: () => void }) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        <Kind kind={insight.kind} />
        <h3 className="text-[13px] font-semibold tracking-tight">{insight.title}</h3>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{insight.body}</p>
      {insight.basis && (
        <p className="mt-2 text-[11px] leading-snug text-ink-3">Based on {insight.basis}</p>
      )}
    </>
  );

  return (
    <div className="group relative rounded-xl border border-line bg-panel px-3.5 py-3 shadow-[var(--shadow)] transition-colors hover:border-line-strong">
      {insight.href ? (
        <Link href={insight.href} className="block pr-6">
          {body}
        </Link>
      ) : (
        <div className="pr-6">{body}</div>
      )}

      <button
        onClick={onDismiss}
        aria-label={`Dismiss "${insight.title}"`}
        title="Dismiss"
        // Always reachable by keyboard and on touch, where there is no hover.
        className="absolute right-2 top-2.5 grid size-6 place-items-center rounded-md text-ink-3 opacity-0 transition-opacity hover:bg-panel-2 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-60"
      >
        <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
          <path
            d="m4 4 8 8M12 4l-8 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

function Kind({ kind }: { kind: Insight["kind"] }) {
  const tone =
    kind === "recommendation"
      ? "border-accent/30 bg-accent-soft text-accent-text"
      : kind === "pattern"
        ? "border-[var(--medium)]/30 bg-[var(--medium)]/10 text-[var(--medium)]"
        : "border-line bg-panel-2 text-ink-3";

  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}
    >
      {INSIGHT_LABEL[kind]}
    </span>
  );
}
