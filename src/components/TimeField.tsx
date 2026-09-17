"use client";

import { useEffect, useRef, useState } from "react";
import { Popover } from "./Popover";

/**
 * Time entry.
 *
 * The native `<input type="time">` opens two scrolling columns of numbers on
 * Windows, which is a lot of work to say "half past four". This is a text box
 * that accepts what people actually type — 9, 9pm, 21:30, 9.30, 930 — with a
 * list of quarter hours to click when they would rather not type at all.
 *
 * The stored value stays "HH:MM" in 24-hour form, because that is what the
 * schema and every comparison in the app expect; only the display is friendly.
 */
export function TimeField({
  value,
  onChange,
  disabled,
  id,
  compact = false,
}: {
  /** "HH:MM", or "" for unset. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  /**
   * For a time sitting inside a row rather than on a form.
   *
   * Drops the two trailing buttons and shows 24-hour time. In a dense row the
   * clear and clock buttons reserve 64px of a field barely wider than that,
   * which left about twelve pixels of text and rendered "5:00 PM" as "5:".
   * The picker still opens on focus, so nothing is actually lost.
   */
  compact?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => format(value, compact));

  // Follow the value when it changes from outside — opening the dialog on a
  // different task, or the quick-add parser filling it in.
  useEffect(() => {
    setText(format(value, compact));
  }, [value, compact]);

  const commitText = () => {
    const parsed = parse(text);
    if (parsed == null) {
      // Unparseable input reverts rather than silently clearing a real time.
      setText(format(value, compact));
      return;
    }
    onChange(parsed);
    setText(format(parsed, compact));
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={text}
        placeholder={compact ? "--:--" : "e.g. 16:30 or 4pm"}
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
        className={`w-full rounded-lg border border-line bg-panel-2 text-ink placeholder:text-ink-3 transition-[background-color,border-color,box-shadow] duration-150 hover:border-line-strong focus:border-accent focus:bg-panel focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none disabled:opacity-40 ${
          compact ? "nums px-2 py-1 text-center text-xs" : "py-2 pl-3 pr-16 text-sm"
        }`}
      />

      <div
        className={`pointer-events-none absolute inset-y-0 right-2 flex items-center gap-0.5 ${
          compact ? "hidden" : ""
        }`}
      >
        {value && !disabled && (
          <button
            type="button"
            aria-label="Clear time"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setText("");
            }}
            className="pointer-events-auto grid size-6 place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
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
          aria-label="Choose a time"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
          className="pointer-events-auto grid size-6 place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink disabled:opacity-40"
        >
          <svg viewBox="0 0 16 16" aria-hidden className="size-4">
            <circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M8 5 L8 8 L10 9.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <Popover anchorRef={wrapRef} open={open && !disabled} onClose={() => setOpen(false)}>
        <ul role="listbox" aria-label="Times">
          {QUARTERS.map((t) => {
            const selected = t === value;
            return (
              <li key={t}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(t);
                    setText(format(t));
                    setOpen(false);
                  }}
                  ref={(el) => {
                    // Open on the current time rather than at midnight, so the
                    // useful part of a 96-row list is the part you land on.
                    if (el && (selected || (!value && t === nearestQuarter()))) {
                      el.scrollIntoView({ block: "center" });
                    }
                  }}
                  className={`nums flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                    selected ? "bg-accent-soft text-accent-text" : "text-ink hover:bg-panel-2"
                  }`}
                >
                  <span>{format(t)}</span>
                  <span className="text-xs text-ink-3">{t}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    </div>
  );
}

/** Every quarter hour. 96 rows is long, but it is scrolled to, not read. */
const QUARTERS: string[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

function nearestQuarter(): string {
  const now = new Date();
  const i = Math.round((now.getHours() * 60 + now.getMinutes()) / 15) % 96;
  return QUARTERS[i];
}

/** "16:30" → "4:30 PM". Empty stays empty. */
function format(value: string, compact = false): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return "";
  // 24-hour when compact: it is four characters instead of eight, and it
  // matches the hour labels down the side of the grid.
  if (compact) return `${m[1].padStart(2, "0")}:${m[2]}`;

  const h = Number(m[1]);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

/**
 * Accepts the shapes people type, and returns "HH:MM" or null.
 *
 * Bare numbers are read as an hour when they are small and as HHMM when they
 * are four digits, which covers "9" and "0930" without needing a separator.
 */
export function parse(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (raw === "") return "";

  const pm = /\bp\.?m?\b|pm$/.test(raw);
  const am = /\ba\.?m?\b|am$/.test(raw);
  const digits = raw.replace(/[^\d:.]/g, "").replace(".", ":");
  // Without this, text with no digits in it falls through to Number("") — which
  // is 0, and would quietly set midnight instead of rejecting the input.
  if (!/\d/.test(digits)) return null;

  let h: number;
  let min = 0;

  if (digits.includes(":")) {
    const [hs, ms = "0"] = digits.split(":");
    h = Number(hs);
    min = Number(ms.slice(0, 2).padEnd(2, "0"));
  } else if (digits.length >= 3) {
    h = Number(digits.slice(0, digits.length - 2));
    min = Number(digits.slice(-2));
  } else {
    h = Number(digits);
  }

  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  if (h > 23 || min > 59 || h < 0 || min < 0) return null;

  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
