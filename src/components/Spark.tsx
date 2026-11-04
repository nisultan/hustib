"use client";

import { useEffect, useState } from "react";
import { QUOTES, quoteOfTheDay } from "@/lib/quotes";
import { todayISO } from "@/lib/dates";

/**
 * The line of the day, as a card worth stopping on.
 *
 * It was a grey italic line under the greeting, easy to skim past — which is
 * the opposite of what a quote of the day is for. Now it is set large and
 * upright, in its own soft tinted card with a big opening mark, and it can be
 * copied or swapped for another one when today's does not land.
 *
 * Quotes come from a written list (Qur'an, hadith, scholars, Stoics, proverbs)
 * rather than a network call: no key, no cost, nothing to break.
 *
 * Rendered only after mount: the quote depends on today's date, and the server
 * and browser can disagree about what today is.
 */
export function Spark() {
  const [ready, setReady] = useState(false);
  const [shift, setShift] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready) return null;

  const base = QUOTES.indexOf(quoteOfTheDay(todayISO()));
  const quote = QUOTES[(base + shift * 37) % QUOTES.length];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`“${quote.text}” — ${quote.author}${quote.source ? `, ${quote.source}` : ""}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; nothing to do.
    }
  };

  return (
    <figure
      key={shift}
      className="relative overflow-hidden rounded-xl border border-line px-5 pb-3.5 pt-4 sm:pl-14"
      style={{
        background: "color-mix(in srgb, var(--accent) 7%, var(--panel))",
        animation: "fade-up 400ms ease-out both",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1 hidden select-none font-serif text-[64px] leading-none sm:block"
        style={{ color: "color-mix(in srgb, var(--accent) 55%, transparent)" }}
      >
        “
      </span>

      <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-accent-text">
        {shift === 0 ? "Today’s line" : "Another one"}
      </p>
      <blockquote className="mt-1.5 text-[17px] font-medium leading-snug tracking-[-0.005em] text-ink sm:text-[18px]">
        {quote.text}
      </blockquote>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <figcaption className="text-[12.5px] text-ink-2">
          — <span className="font-semibold">{quote.author}</span>
          {quote.source && <span className="text-ink-3"> · {quote.source}</span>}
        </figcaption>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={copy}
            className="rounded-md px-2 py-1 text-[12px] font-medium text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => setShift((s) => s + 1)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
          >
            <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
              <path
                d="M13 8a5 5 0 1 1-1.5-3.55M13 2.5V5h-2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Another
          </button>
        </div>
      </div>
    </figure>
  );
}
