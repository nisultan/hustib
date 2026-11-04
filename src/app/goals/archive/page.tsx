"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { Goal } from "@/lib/types";
import { formatDate } from "@/lib/dates";
import { progressOf } from "@/lib/goals/tracker";
import { PageHeader, Panel } from "@/components/ui";
import { GoalDialog } from "@/components/GoalDialog";

/**
 * Goals whose deadline came and went without them.
 *
 * Kept rather than deleted: an honest record of what slipped is worth more
 * than a page that only remembers wins. Read-only: they can be opened, not
 * changed.
 */
export default function GoalArchivePage() {
  const store = useStore();
  const [open, setOpen] = useState<Goal | null>(null);

  const missed = useMemo(
    () =>
      store.goals
        .filter((g) => g.status === "missed")
        .sort((a, b) => (b.deadline ?? "").localeCompare(a.deadline ?? "")),
    [store.goals],
  );
  const achieved = store.goals.filter((g) => g.status === "achieved").length;

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  return (
    <div className="page-in">
      <PageHeader
        title="Archive"
        subtitle="Goals that hit their deadline undone. Locked, kept, learned from."
        action={
          <Link
            href="/goals"
            className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            ← Goals
          </Link>
        }
      />

      {missed.length > 0 && (
        <div className="mb-5 flex gap-6">
          <Figure value={missed.length} label="missed" tone="var(--urgent)" />
          <Figure value={achieved} label="achieved" tone="var(--up)" />
          {achieved + missed.length > 0 && (
            <Figure value={`${Math.round((achieved / (achieved + missed.length)) * 100)}%`} label="hit rate" />
          )}
        </div>
      )}

      {missed.length === 0 ? (
        <Panel className="px-6 py-14 text-center">
          <p className="text-[15px] font-semibold">Nothing here.</p>
          <p className="mt-1 text-[13px] text-ink-3">No goal has missed its deadline. Keep it that way.</p>
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {missed.map((g) => {
            const { value } = progressOf(g, store);
            return (
              <button
                key={g.id}
                onClick={() => setOpen(g)}
                className="flex flex-col gap-2.5 rounded-xl border border-line bg-panel p-4 text-left opacity-80 transition-opacity hover:opacity-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[15px] font-semibold leading-snug text-ink-2 line-through decoration-[var(--urgent)]/60">
                    {g.title}
                  </h3>
                  <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--urgent)_14%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--urgent)]">
                    Missed
                  </span>
                </div>
                {value != null && (
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                      <span className="block h-full rounded-full bg-[var(--text-3)]" style={{ width: `${value}%` }} />
                    </span>
                    <span className="nums text-[11px] text-ink-3">{value}%</span>
                  </div>
                )}
                <p className="text-[12px] text-ink-3">Deadline {g.deadline ? formatDate(g.deadline) : "—"}</p>
              </button>
            );
          })}
        </div>
      )}

      <GoalDialog open={open != null} goal={open ?? undefined} onClose={() => setOpen(null)} />
    </div>
  );
}

function Figure({ value, label, tone }: { value: number | string; label: string; tone?: string }) {
  return (
    <div>
      <p className="nums text-[24px] font-bold leading-none" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
      <p className="mt-1 text-[12px] text-ink-3">{label}</p>
    </div>
  );
}
