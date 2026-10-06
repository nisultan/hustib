"use client";

import { useEffect, useState } from "react";
import { quoteOfTheDay } from "@/lib/quotes";
import { todayISO } from "@/lib/dates";

/**
 * The line of the day.
 *
 * Was a sentence written each morning by the model from that day's numbers.
 * Accurate, and the wrong thing: the dashboard already says what your week
 * looks like, two lines above this one, and a second machine-made observation
 * about your own data is not encouragement, it is the same report twice.
 *
 * So it comes from outside instead — the Qur'an, a hadith, al-Shafi'i, Seneca,
 * a proverb — chosen from a written list rather than fetched, which means no
 * key, no network, no daily call to pay for, and nothing to go wrong on a
 * morning when Google is having one.
 *
 * Rendered only after mount. The quote depends on today's date, and a server
 * rendering yesterday's into the HTML while the browser computes today's is a
 * hydration mismatch — one of the few places in this app where the date is
 * genuinely ambiguous between the two.
 */
export function Spark() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!ready) return null;

  const quote = quoteOfTheDay(todayISO());

  return (
    <figure className="mt-3.5 flex gap-2.5" style={{ animation: "fade-up 400ms ease-out both" }}>
      {/* A rule rather than a quotation mark. A big curly quote at this size
          is a glyph competing with the words beside it. */}
      <span
        aria-hidden
        className="mt-1.5 w-[3px] shrink-0 self-stretch rounded-full"
        style={{ background: "color-mix(in srgb, var(--accent) 55%, transparent)" }}
      />

      <div className="min-w-0">
        <blockquote className="text-[13.5px] italic leading-relaxed text-ink-2">
          {quote.text}
        </blockquote>
        <figcaption className="mt-1 text-[11px] text-ink-3">
          {quote.author}
          {quote.source && <span className="opacity-70"> · {quote.source}</span>}
        </figcaption>
      </div>
    </figure>
  );
}
