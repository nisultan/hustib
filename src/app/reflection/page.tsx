"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { addDays, formatDate, pastLabel, todayISO } from "@/lib/dates";
import { Block } from "@/lib/types";
import { BlockEditor } from "@/components/BlockEditor";
import { DateField } from "@/components/DateField";
import { Button, PageHeader, Panel, SectionTitle } from "@/components/ui";

export default function ReflectionPage() {
  const store = useStore();
  const [date, setDate] = useState(() => todayISO());

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

  return (
    <div className="fade-up">
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
          placeholder="How did it go? Press / for a heading, list or checkbox."
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
