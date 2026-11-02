"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { useReflection } from "@/lib/ai/useReflection";
import { Insight } from "@/lib/types";
import { SectionTitle } from "./ui";
import { InsightIcon } from "./InsightIcon";

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
  const [all, setAll] = useState(false);
  // Three at first. Five cards of three sentences each was the wall this page
  // was criticised for; the titles are the message, and the rest is one tap.
  const cap = limit ?? 3;
  const shown = all ? live : live.slice(0, cap);
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
              {running ? "Reading…" : "Look again"}
            </button>
          ) : undefined
        }
      >
        What I noticed
      </SectionTitle>

      {untouched ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-7 text-center">
          <p className="text-[13px] leading-relaxed text-ink-2">
            {ready
              ? "Want me to read back through your journal, your habits and how the term is actually going, and tell you what I see?"
              : "Not much here yet. Write a few days and tick some habits, and there will be something to read."}
          </p>
          <button
            onClick={() => void reflect()}
            disabled={!ready || running}
            className="mt-3 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Tell me about me
          </button>
          <p className="mt-2 text-[11px] text-ink-3">
            Only when you ask. It never runs on its own.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3.5 py-6 text-center text-sm text-ink-3">
          {running ? "Reading back through your week…" : "Nothing new since last time."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-panel">
          {shown.map((insight) => (
            <Row
              key={insight.id}
              insight={insight}
              onDismiss={() => store.dismissInsight(insight.id)}
            />
          ))}
          {live.length > cap && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              className="w-full border-t border-line px-4 py-2.5 text-left text-[13px] font-medium text-accent-text transition-colors hover:bg-panel-2"
            >
              {all ? "Show fewer" : `Show all ${live.length}`}
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-[var(--urgent)]">{error}</p>}

      {/* A pass that finds nothing is a real result, and saying so is the
          difference between restraint and a button that appears to do
          nothing. */}
      {!error && outcome && outcome.insightsAdded === 0 && (
        <p className="mt-2 text-xs text-ink-3">
          {outcome.memoryChanged
            ? "Read your week. Nothing new worth saying, but I know you a bit better now."
            : "Read your week. Nothing new since last time."}
        </p>
      )}
    </section>
  );
}

/**
 * One thing it noticed, as a line that opens.
 *
 * Closed, a row shows the picture and the title and nothing else — the title
 * is written to be the point, so most of the time it is enough. Open, it shows
 * the full note, what it was drawn from, and where to act on it. A page of
 * these reads like an inbox you can scan in five seconds, instead of five
 * paragraphs you have to get through.
 */
function Row({ insight, onDismiss }: { insight: Insight; onDismiss: () => void }) {
  const [open, setOpen] = useState(false);
  const k = KIND[insight.kind];

  return (
    <article className="group border-b border-line last:border-b-0">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <InsightIcon insight={insight} tone={k.tone} label={k.label} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14.5px] font-semibold tracking-tight">
              {insight.title}
            </span>
            <span className="block text-[12px]" style={{ color: k.tone }}>
              {k.label}
            </span>
          </span>
          <svg
            viewBox="0 0 16 16"
            aria-hidden
            className={`size-4 shrink-0 text-ink-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={onDismiss}
          aria-label={`Dismiss "${insight.title}"`}
          title="Dismiss"
          className="grid size-7 shrink-0 place-items-center rounded-md text-ink-3 opacity-0 transition-opacity hover:bg-panel-2 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-60"
        >
          <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
            <path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="grid gap-2.5 px-3 pb-3.5 pl-[64px]" style={{ animation: "fade-up 220ms ease-out both" }}>
          <p className="text-[13.5px] leading-relaxed text-ink-2">{insight.body}</p>
          {insight.basis && (
            <p className="text-[12px] text-ink-3">
              <span className="font-semibold text-ink-2">Why: </span>
              {insight.basis}
            </p>
          )}
          {insight.href && (
            <Link
              href={insight.href}
              className="justify-self-start rounded-[7px] px-2.5 py-1 text-[12.5px] font-medium transition-colors hover:brightness-95"
              style={{ color: k.tone, background: `color-mix(in srgb, ${k.tone} 12%, transparent)` }}
            >
              Go there →
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * A colour per kind. A pattern is a reading of weeks and can be wrong; a
 * suggestion is a thing to do today; a takeaway is a fact restated. The icon
 * says what the card is about; its colour says which of those it is.
 */
const KIND: Record<Insight["kind"], { label: string; tone: string }> = {
  pattern: { label: "Pattern", tone: "var(--accent)" },
  recommendation: { label: "Suggestion", tone: "var(--up)" },
  takeaway: { label: "Takeaway", tone: "var(--text-3)" },
};
