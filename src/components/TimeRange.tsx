"use client";

import { TimeField } from "./TimeField";

/**
 * When something starts, and optionally when it ends.
 *
 * Duration is stored as minutes, but minutes is not how anyone describes their
 * day — "physics until half seven" is the thought, and making someone convert
 * that to "45m" is arithmetic the app should be doing. The end is derived from
 * start plus length, and typing a new one sets the length.
 *
 * The end stays optional: plenty of blocks are "start at nine and see how it
 * goes", and forcing a finish time on those invents a certainty the student
 * does not have.
 */
export function TimeRange({
  start,
  minutes,
  onChange,
}: {
  start: string | null;
  minutes: number;
  onChange: (patch: { start?: string | null; minutes?: number }) => void;
}) {
  const end = start ? addMinutes(start, minutes) : "";

  return (
    <div className="flex shrink-0 items-center gap-1">
      <div className="w-[62px]">
        <TimeField
          compact
          value={start ?? ""}
          onChange={(v) => onChange({ start: v || null })}
        />
      </div>

      <span aria-hidden className="text-[11px] text-ink-3">
        –
      </span>

      <div className="w-[62px]">
        <TimeField
          compact
          value={end}
          onChange={(v) => {
            if (!v || !start) return;
            // An end before the start is someone planning past midnight, which
            // the day grid cannot draw; treating it as next-day would put the
            // block somewhere they cannot see it.
            const length = minutesBetween(start, v);
            onChange({ minutes: length > 0 ? length : 15 });
          }}
        />
      </div>
    </div>
  );
}

function toMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + (m || 0);
}

function addMinutes(clock: string, minutes: number): string {
  const total = toMinutes(clock) + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function minutesBetween(from: string, to: string): number {
  return toMinutes(to) - toMinutes(from);
}
