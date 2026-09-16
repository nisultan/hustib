"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { recommend } from "@/lib/recommendations";
import { daysUntil, todayISO } from "@/lib/dates";
import { EmptyState, PageHeader, Panel, SectionTitle } from "@/components/ui";
import { Insights } from "@/components/Insights";

export default function RecommendationsPage() {
  const store = useStore();
  const recs = useMemo(() => recommend(store, 8), [store]);
  const today = todayISO();

  const open = store.tasks.filter((t) => t.status !== "completed");
  const overdue = open.filter((t) => t.dueDate != null && daysUntil(t.dueDate) < 0).length;
  const dueToday = open.filter((t) => t.dueDate === today).length;
  const next7 = open.filter((t) => {
    if (t.dueDate == null) return false;
    const d = daysUntil(t.dueDate);
    return d >= 0 && d <= 7;
  }).length;

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  return (
    <div className="page-in">
      <PageHeader
        title="Recommendations"
        subtitle="What your deadlines, priorities and grades add up to."
      />

      <Insights />

      <div className="mb-8 grid grid-cols-3 gap-3">
        <Panel className="px-4 py-3">
          <p
            className="nums text-2xl font-semibold"
            style={overdue > 0 ? { color: "var(--urgent)" } : undefined}
          >
            {overdue}
          </p>
          <p className="text-xs text-ink-3">Overdue</p>
        </Panel>
        <Panel className="px-4 py-3">
          <p className="nums text-2xl font-semibold">{dueToday}</p>
          <p className="text-xs text-ink-3">Due today</p>
        </Panel>
        <Panel className="px-4 py-3">
          <p className="nums text-2xl font-semibold">{next7}</p>
          <p className="text-xs text-ink-3">Next 7 days</p>
        </Panel>
      </div>

      <SectionTitle>Suggestions</SectionTitle>
      {recs.length === 0 ? (
        <EmptyState
          title="Nothing to suggest yet"
          hint="Add tasks, deadlines and grades and suggestions will appear here."
        />
      ) : (
        <div className="grid gap-2">
          {recs.map((r) => (
            <Link
              key={r.id}
              href={r.href}
              className="flex items-start gap-3 rounded-xl border border-line bg-panel px-4 py-3.5 shadow-[var(--shadow)] transition-colors hover:border-line-strong"
            >
              <span aria-hidden className="mt-px">
                💡
              </span>
              <span className="flex-1 text-sm text-ink-2">{r.text}</span>
              <span aria-hidden className="mt-px text-ink-3">
                →
              </span>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-ink-3">
        Fourteen rules read your own data and each produces at most one line: overdue work,
        assessments bunching up, a course sliding while its average still looks fine, an average
        resting on a single mark, work aging with no deadline, how this week compares with your
        last, gaps in the journal, and a weight trend once there is enough of one to call. The
        strongest few are shown. Nothing is sent anywhere.
      </p>
    </div>
  );
}
