"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { formatDate, pastLabel, todayISO } from "@/lib/dates";
import { Day } from "@/lib/types";
import { DateField } from "@/components/DateField";
import { QuickWeights, WeightInput, WeightSummary, trendColor } from "@/components/WeightPanel";
import { EmptyState, PageHeader, Panel, SectionTitle } from "@/components/ui";

export default function WeightPage() {
  const store = useStore();
  const [date, setDate] = useState(() => todayISO());

  const byDate = useMemo(() => new Map(store.days.map((d) => [d.date, d])), [store.days]);

  const latest = useMemo(
    () =>
      [...store.days]
        .filter((d) => d.weight != null)
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null,
    [store.days],
  );

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  const current = byDate.get(date)?.weight ?? null;

  return (
    <div className="page-in">
      <PageHeader
        title="Weight"
        subtitle="A number a morning. The trend is what matters, not any one of them."
      />

      <WeightSummary days={store.days} />

      <section className="mt-8">
        <SectionTitle>Log a weigh-in</SectionTitle>
        <Panel className="flex flex-wrap items-end gap-4 px-4 py-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-2">Day</span>
            <div className="w-[190px]">
              <DateField value={date} onChange={(v) => setDate(v || todayISO())} />
            </div>
          </label>

          <WeightInput value={current} onChange={(weight) => store.setDay(date, { weight })} />

          <div className="pb-1">
            <QuickWeights
              // Offer neighbours of the most recent weigh-in, not of this
              // day's blank: the point is one tap from where you were.
              anchor={current ?? latest?.weight ?? null}
              current={current}
              onPick={(weight) => store.setDay(date, { weight })}
            />
          </div>
        </Panel>
        {date !== todayISO() && (
          <p className="mt-2 text-xs text-ink-3">
            Logging against {formatDate(date)} — {pastLabel(date).toLowerCase()}.
          </p>
        )}
      </section>

      <section className="mt-8">
        <SectionTitle>History</SectionTitle>
        <WeightTable
          days={store.days}
          onOpen={setDate}
          onClear={(d) => store.setDay(d, { weight: null })}
        />
      </section>
    </div>
  );
}

function WeightTable({
  days,
  onOpen,
  onClear,
}: {
  days: Day[];
  onOpen: (date: string) => void;
  onClear: (date: string) => void;
}) {
  const rows = useMemo(
    () => days.filter((d) => d.weight != null).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [days],
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No weigh-ins yet"
        hint="Log one above and it lands here, newest first, with the change from the weigh-in before it."
      />
    );
  }

  return (
    <Panel className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <Th>Date</Th>
              <Th className="text-right">Weight</Th>
              <Th className="text-right">Change</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((day, i) => {
              // Against the previous weigh-in, not the previous row — though
              // here they are the same thing, since unweighed days are gone.
              const previous = rows[i + 1];
              const delta =
                previous?.weight != null && day.weight != null
                  ? day.weight - previous.weight
                  : null;

              return (
                <tr
                  key={day.date}
                  className="group border-b border-line transition-colors last:border-0 hover:bg-panel-2"
                >
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => onOpen(day.date)}
                      className="text-left font-medium transition-colors hover:text-accent-text"
                    >
                      {formatDate(day.date)}
                      <span className="ml-2 text-xs font-normal text-ink-3">
                        {pastLabel(day.date)}
                      </span>
                    </button>
                  </td>
                  <td className="nums px-3 py-2.5 text-right font-medium">
                    {day.weight?.toFixed(1)}
                  </td>
                  <td className="nums px-3 py-2.5 text-right">
                    {delta == null ? (
                      <span className="text-ink-3">—</span>
                    ) : (
                      <span style={{ color: trendColor(delta) }}>
                        {delta > 0 ? "+" : ""}
                        {delta.toFixed(1)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      // Clears the weight, not the day: the reflection written
                      // that evening has nothing to do with the scale.
                      onClick={() => onClear(day.date)}
                      aria-label={`Remove the weigh-in for ${formatDate(day.date)}`}
                      title="Remove this weigh-in"
                      className="grid size-7 place-items-center rounded-md text-ink-3 opacity-0 transition-[opacity,background-color,color] hover:bg-panel hover:text-[var(--urgent)] focus:opacity-100 group-hover:opacity-100"
                    >
                      <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
                        <path
                          d="M4.5 4.5 L11.5 11.5 M11.5 4.5 L4.5 11.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-3 ${className}`}
    >
      {children}
    </th>
  );
}
