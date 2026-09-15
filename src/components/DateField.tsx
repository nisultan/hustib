"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, fromISO, toISO, todayISO } from "@/lib/dates";
import { Popover } from "./Popover";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Date entry.
 *
 * The native `<input type="date">` renders in the operating system's locale,
 * not the app's, which is why the calendar arrived in Russian inside an
 * English interface — and its text field expects the day, month and year in
 * whatever order that locale uses, with no hint of which. This owns both.
 *
 * Typing accepts the obvious written forms and the words people reach for
 * first ("today", "tomorrow", "next mon"), because a deadline is far more
 * often a few days out than a date anyone wants to pick off a grid.
 */
export function DateField({
  value,
  onChange,
  disabled,
  id,
  placeholder = "e.g. 24 Sep or tomorrow",
}: {
  /** "YYYY-MM-DD", or "" for unset. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => display(value));
  // The month on screen, which is not the selection: you can page to December
  // and change your mind without anything being chosen.
  const [cursor, setCursor] = useState(() => monthStart(value || todayISO()));

  useEffect(() => {
    setText(display(value));
    if (value) setCursor(monthStart(value));
  }, [value]);

  const commitText = () => {
    const parsed = parseDate(text);
    if (parsed == null) {
      setText(display(value));
      return;
    }
    onChange(parsed);
    setText(display(parsed));
  };

  const days = useMemo(() => grid(cursor), [cursor]);
  const today = todayISO();

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        type="text"
        autoComplete="off"
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitText();
            setOpen(false);
          } else if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
          } else if (e.key === "ArrowDown") {
            setOpen(true);
          }
        }}
        className="w-full rounded-lg border border-line bg-panel-2 py-2 pl-3 pr-16 text-sm text-ink placeholder:text-ink-3 transition-[background-color,border-color,box-shadow] duration-150 hover:border-line-strong focus:border-accent focus:bg-panel focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none disabled:opacity-40"
      />

      <div className="absolute inset-y-0 right-2 flex items-center gap-0.5">
        {value && !disabled && (
          <button
            type="button"
            aria-label="Clear date"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setText("");
            }}
            className="grid size-6 place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
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
        )}
        <button
          type="button"
          aria-label="Open calendar"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((o) => !o)}
          className="grid size-6 place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink disabled:opacity-40"
        >
          <svg viewBox="0 0 16 16" aria-hidden className="size-4">
            <rect
              x="2.2"
              y="3.4"
              width="11.6"
              height="10.4"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M2.2 6.6 H13.8 M5.4 2.2 V4.4 M10.6 2.2 V4.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <Popover
        anchorRef={wrapRef}
        open={open && !disabled}
        onClose={() => setOpen(false)}
        maxHeight={360}
      >
        <div className="w-[268px] p-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <span className="flex gap-0.5">
              <CalIconButton
                label="Previous month"
                onClick={() => setCursor(shiftMonth(cursor, -1))}
                d="M10 3.5 L5.5 8 L10 12.5"
              />
              <CalIconButton
                label="Next month"
                onClick={() => setCursor(shiftMonth(cursor, 1))}
                d="M6 3.5 L10.5 8 L6 12.5"
              />
            </span>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((w) => (
              <span
                key={w}
                className="grid h-6 place-items-center text-[10px] font-semibold uppercase tracking-wide text-ink-3"
              >
                {w.slice(0, 2)}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((iso) => {
              const d = fromISO(iso);
              const outside = d.getMonth() !== cursor.getMonth();
              const selected = iso === value;
              const isToday = iso === today;
              return (
                <button
                  key={iso}
                  type="button"
                  aria-label={iso}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(iso);
                    setText(display(iso));
                    setOpen(false);
                  }}
                  className={`nums grid h-8 place-items-center rounded-lg text-[13px] transition-colors ${
                    selected
                      ? "bg-accent font-semibold text-white"
                      : outside
                        ? "text-ink-3 hover:bg-panel-2"
                        : "text-ink hover:bg-panel-2"
                  } ${isToday && !selected ? "font-semibold text-accent-text ring-1 ring-inset ring-accent/45" : ""}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex gap-1 border-t border-line pt-2">
            <QuickDate label="Today" iso={today} onPick={pick} />
            <QuickDate label="Tomorrow" iso={addDays(today, 1)} onPick={pick} />
            <QuickDate label="Next week" iso={addDays(today, 7)} onPick={pick} />
          </div>
        </div>
      </Popover>
    </div>
  );

  function pick(iso: string) {
    onChange(iso);
    setText(display(iso));
    setOpen(false);
  }
}

function CalIconButton({
  label,
  onClick,
  d,
}: {
  label: string;
  onClick: () => void;
  d: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink"
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
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

function QuickDate({
  label,
  iso,
  onPick,
}: {
  label: string;
  iso: string;
  onPick: (iso: string) => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(iso)}
      className="flex-1 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink"
    >
      {label}
    </button>
  );
}

/** "2026-09-24" → "Thu, 24 Sep 2026". Empty stays empty. */
function display(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = fromISO(iso);
  return `${WEEKDAYS[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

function monthStart(iso: string): Date {
  const d = fromISO(iso);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function shiftMonth(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/**
 * Six weeks starting on the Monday on or before the first of the month.
 *
 * Always six, never five: a grid that changes height as you page through
 * months makes the buttons move under the cursor.
 */
function grid(cursor: Date): string[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const back = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - back);
  return Array.from({ length: 42 }, (_, i) =>
    toISO(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)),
  );
}

const MONTH_MATCH = MONTHS.map((m) => m.toLowerCase());

/**
 * Reads what people type, and returns "YYYY-MM-DD" or null.
 *
 * Ambiguous all-numeric input is read day-first, matching how the rest of the
 * app writes dates and what the previous native field showed. A year is
 * optional: "24 sep" means the next 24 September that has not passed.
 */
export function parseDate(input: string, now: string = todayISO()): string | null {
  const raw = input.trim().toLowerCase();
  if (raw === "") return "";

  if (raw === "today" || raw === "tod") return now;
  if (raw === "tomorrow" || raw === "tmr" || raw === "tom") return addDays(now, 1);
  if (raw === "yesterday") return addDays(now, -1);

  // "next mon", "friday" — the next occurrence, never today itself.
  const weekday = WEEKDAYS.findIndex((w) =>
    new RegExp(`^(next\\s+)?${w.toLowerCase()}`).test(raw.replace(/day$/, "")),
  );
  if (weekday >= 0 && /^(next\s+)?[a-z]+$/.test(raw)) {
    const current = (fromISO(now).getDay() + 6) % 7;
    return addDays(now, (weekday - current + 7) % 7 || 7);
  }

  // Already ISO.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // "24 sep", "24 sep 2026", "sep 24", "sep 24 2026".
  const named = /^(?:(\d{1,2})\s*)?([a-z]{3,})\.?(?:\s+(\d{1,2}))?(?:\s*,?\s*(\d{4}))?$/.exec(
    raw.replace(/(\d)(st|nd|rd|th)\b/g, "$1"),
  );
  if (named) {
    const month = MONTH_MATCH.findIndex((m) => m.startsWith(named[2]));
    if (month >= 0) {
      const day = Number(named[1] ?? named[3]);
      if (Number.isFinite(day) && day >= 1) {
        const year = named[4] ? Number(named[4]) : rollForward(month, day, now);
        return build(year, month + 1, day);
      }
    }
  }

  // "24.09.2026", "24/9", "24-09-26" — day first.
  const numeric = /^(\d{1,2})[./\-](\d{1,2})(?:[./\-](\d{2}|\d{4}))?$/.exec(raw);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const yearRaw = numeric[3];
    const year = yearRaw
      ? yearRaw.length === 2
        ? 2000 + Number(yearRaw)
        : Number(yearRaw)
      : rollForward(month - 1, day, now);
    return build(year, month, day);
  }

  return null;
}

/** The year that puts this day/month next, rather than in the past. */
function rollForward(monthIndex: number, day: number, now: string): number {
  const thisYear = fromISO(now).getFullYear();
  const candidate = build(thisYear, monthIndex + 1, day);
  return candidate != null && candidate >= now ? thisYear : thisYear + 1;
}

/** Rejects a date the calendar would silently roll over, like 31 February. */
function build(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000 || year > 9999) return null;
  const d = new Date(year, month - 1, day);
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return toISO(d);
}
