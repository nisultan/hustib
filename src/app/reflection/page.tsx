"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { addDays, formatDate, pastLabel, todayISO } from "@/lib/dates";
import { Block } from "@/lib/types";
import { BlockEditor } from "@/components/BlockEditor";
import { DateField } from "@/components/DateField";
import { Button, Panel } from "@/components/ui";
import { Flame } from "@/components/Flame";
import { motion } from "motion/react";
import { spring } from "@/lib/motion";

/** Where the wide-column preference is kept. */
const WIDE_KEY = "iblearner.reflectionWide";

export default function ReflectionPage() {
  const store = useStore();
  const [date, setDate] = useState(() => todayISO());
  const [focus, setFocus] = useState(false);

  // Escape leaves focus mode. It is the only way out that does not require
  // finding a button on a page deliberately stripped of them.
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocus(false);
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll under the overlay.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [focus]);

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

  if (focus) {
    return (
      <FocusMode
        date={date}
        today={today}
        blocks={reflection}
        streak={streak(store.days, today)}
        onChange={(blocks) => store.setDay(date, { reflection: blocks })}
        onDate={setDate}
        onClose={() => setFocus(false)}
      />
    );
  }

  const words = wordCount(reflection);

  /*
    Inserting the day's question writes it into the entry as a heading with an
    empty line beneath, rather than filling a text box. The prompt is a place
    to start, not a form to complete, and once it is in the page it belongs to
    the page like anything else written there.
  */
  const usePrompt = (question: string) => {
    store.setDay(date, {
      reflection: [
        ...reflection.filter((b) => b.text.trim() !== "" || b.type !== "text"),
        { id: newId(), type: "h3", text: question, done: false },
        { id: newId(), type: "text", text: "", done: false },
      ],
    });
  };

  return (
    <div className="page-in">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reflection</h1>
          <p className="mt-1 text-sm text-ink-2">A page a day. What happened, what it felt like, what to do about it.</p>
        </div>
        <Month days={store.days} today={today} selected={date} onPick={setDate} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="grid min-w-0 gap-4">
          <Panel className="overflow-hidden">
            {/* The day, stated like the top of a page in a notebook rather than
                as a form header: the weekday is the thing you remember a day by. */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel-2/40 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2">
                <Step
                  label="Previous day"
                  onClick={() => setDate(addDays(date, -1))}
                  d="M10 3.5 L5.5 8 L10 12.5"
                />
                <div className="min-w-[150px]">
                  <p className="text-[17px] font-semibold tracking-tight">
                    {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" })}
                  </p>
                  <p className="text-xs text-ink-3">
                    {formatDate(date)} · {pastLabel(date)}
                  </p>
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
                <button
                  onClick={() => setFocus(true)}
                  aria-label="Focus mode"
                  title="Focus mode"
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
                >
                  <svg viewBox="0 0 16 16" aria-hidden className="size-4">
                    <path
                      d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <div className="w-[190px]">
                  <DateField value={date} onChange={(v) => setDate(v || today)} />
                </div>
              </div>
            </div>

            <div className="px-4 py-5 sm:px-6">
              {words === 0 && <Prompt date={date} onUse={usePrompt} />}

              <BlockEditor
                // Remounting per day, so an edit to one morning cannot land in
                // another when the date changes mid-keystroke.
                key={date}
                blocks={reflection}
                onChange={(blocks) => store.setDay(date, { reflection: blocks })}
                placeholder="How did it go? Press / for a heading, list, image or link."
              />
            </div>

            {words > 0 && (
              <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-ink-3 sm:px-6">
                <span>
                  {words} {words === 1 ? "word" : "words"} · about {Math.max(1, Math.round(words / 200))} min
                  to read
                </span>
                <span>Saved as you type</span>
              </div>
            )}
          </Panel>

          <Timeline written={written} current={date} onPick={setDate} />
        </div>

        <aside className="grid min-w-0 gap-4">
          <Stats days={store.days} today={today} />
          <Flashback written={written} today={today} onPick={setDate} />
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* The month strip                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The last thirty days as a row of dots: written, not written, today.
 *
 * At the top of the page because it answers the question someone opening a
 * journal is half asking — have I been keeping this — before they have read a
 * word. Each dot opens its day, which is also the fastest way back to last
 * Tuesday.
 */
function Month({
  days,
  today,
  selected,
  onPick,
}: {
  days: { date: string; reflection: Block[] }[];
  today: string;
  selected: string;
  onPick: (date: string) => void;
}) {
  const written = new Set(
    days.filter((d) => d.reflection.some((b) => b.text.trim() !== "")).map((d) => d.date),
  );
  const run = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));

  return (
    <div className="flex items-center gap-[5px]" aria-label="Last 30 days">
      {run.map((d) => {
        const on = written.has(d);
        const isToday = d === today;
        const isSelected = d === selected;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onPick(d)}
            title={`${formatDate(d)}${on ? " · written" : ""}`}
            aria-label={`${formatDate(d)}${on ? ", written" : ""}`}
            className={`rounded-full transition-transform hover:scale-125 ${
              isSelected ? "ring-2 ring-accent ring-offset-2 ring-offset-[var(--bg)]" : ""
            }`}
            style={{
              width: isToday ? 10 : 8,
              height: isToday ? 10 : 8,
              background: on ? "var(--accent)" : "var(--panel-2)",
              boxShadow: on ? "none" : "inset 0 0 0 1px var(--border)",
              outline: isToday && !on ? "1.5px dashed var(--accent)" : undefined,
              outlineOffset: 1,
            }}
          />
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Today's question                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Something to start from, on a blank page.
 *
 * A blank page is the hardest one to write on, and "how did it go?" is a
 * question nobody has ever answered interestingly. These are narrower on
 * purpose — a single angle on the day is easier to begin from than the whole
 * of it. One a day, chosen by date, and another on request.
 */
const PROMPTS = [
  "What took more energy today than it should have?",
  "What's one thing you'd do differently if you got today again?",
  "What are you avoiding right now, honestly?",
  "When did you feel most like yourself today?",
  "What's been on your mind that you haven't said out loud?",
  "What did you get done that nobody will notice?",
  "Where did your time actually go today?",
  "What's worrying you about this week?",
  "What made you laugh today?",
  "What would make tomorrow a good day?",
  "Who did you think about today, and why?",
  "What did you learn today — at school or not?",
  "What are you grateful for that you usually forget?",
  "What's one promise to yourself you kept, or broke?",
  "How did your body feel today — sleep, food, training?",
  "What's the thing you keep putting off, and what's the first step?",
  "What did today teach you about yourself?",
  "If this week had a title, what would it be?",
];

function Prompt({ date, onUse }: { date: string; onUse: (q: string) => void }) {
  const base = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const [shift, setShift] = useState(0);
  const question = PROMPTS[(((base + shift) % PROMPTS.length) + PROMPTS.length) % PROMPTS.length];

  return (
    <div className="mb-4 rounded-xl border border-dashed border-line p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">If you need somewhere to start</p>
      <p className="mt-1.5 text-[15px] font-medium leading-snug">{question}</p>
      <div className="mt-2.5 flex items-center gap-3 text-[12px]">
        <button
          type="button"
          onClick={() => onUse(question)}
          className="rounded-lg bg-accent px-2.5 py-1 font-medium text-white transition-opacity hover:opacity-90"
        >
          Write about this
        </button>
        <button
          type="button"
          onClick={() => setShift((n) => n + 1)}
          className="text-ink-3 transition-colors hover:text-ink"
        >
          Another one
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Side panel                                                                 */
/* -------------------------------------------------------------------------- */

function Stats({ days, today }: { days: { date: string; reflection: Block[] }[]; today: string }) {
  const run = streak(days, today);
  const weekFrom = addDays(today, -6);
  const monthFrom = addDays(today, -29);
  const written = days.filter((d) => d.reflection.some((b) => b.text.trim() !== ""));
  const weekWords = written
    .filter((d) => d.date >= weekFrom)
    .reduce((n, d) => n + wordCount(d.reflection), 0);
  const monthDays = written.filter((d) => d.date >= monthFrom).length;

  return (
    <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
      <Tile
        value={
          <span className="inline-flex items-center gap-1">
            {run}
            {run > 0 && <Flame streak={run} />}
          </span>
        }
        label={run === 1 ? "day running" : "days running"}
      />
      <Tile value={weekWords.toLocaleString()} label="words this week" />
      <Tile value={`${monthDays}/30`} label="days written this month" />
    </div>
  );
}

function Tile({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-3.5 py-3 shadow-[var(--shadow),var(--edge)]">
      <p className="nums text-[22px] font-semibold leading-none tracking-tight">{value}</p>
      <p className="mt-1.5 text-[11.5px] text-ink-3">{label}</p>
    </div>
  );
}

/**
 * What you were writing a while ago.
 *
 * The one feature here with no productivity argument behind it at all, and
 * possibly the most useful: reading what you were worried about a month ago is
 * the fastest way to see that most of it passed. Picks the entry nearest to a
 * week, a month or three months back, whichever exists.
 */
function Flashback({
  written,
  today,
  onPick,
}: {
  written: { date: string; reflection: Block[] }[];
  today: string;
  onPick: (date: string) => void;
}) {
  const near = (back: number) => {
    const target = addDays(today, -back);
    return written.find((d) => Math.abs(daysApart(d.date, target)) <= 2);
  };
  const pick =
    [
      { back: 90, label: "Three months ago" },
      { back: 30, label: "A month ago" },
      { back: 7, label: "A week ago" },
    ]
      .map((o) => ({ ...o, day: near(o.back) }))
      .find((o) => o.day != null) ?? null;

  if (!pick || !pick.day) return null;
  const { title, excerpt } = headline(pick.day.reflection);

  return (
    <button
      type="button"
      onClick={() => onPick(pick.day!.date)}
      className="group rounded-xl border border-line bg-panel p-4 text-left shadow-[var(--shadow),var(--edge)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-line-strong"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-accent-text">{pick.label}</p>
      <p className="mt-1 text-[11px] text-ink-3">{formatDate(pick.day.date)}</p>
      <p className="mt-2 text-[14px] font-medium leading-snug">{title}</p>
      {excerpt && <p className="mt-1 line-clamp-4 text-[12.5px] leading-relaxed text-ink-2">{excerpt}</p>}
      <p className="mt-2 text-[11.5px] text-ink-3 transition-colors group-hover:text-ink">Read it →</p>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Earlier entries                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Every entry, as a timeline grouped by month, with a search.
 *
 * Was a grid of identical cards showing each entry's first two lines run
 * together with dots — "dsdsds · rggdfd · swds" is what that layout makes of a
 * test entry, and what it made of real ones was not much better. Now each
 * entry leads with its first line as a title, keeps the rest as an excerpt,
 * and sits under its month, so a term reads as a term.
 */
function Timeline({
  written,
  current,
  onPick,
}: {
  written: { date: string; reflection: Block[] }[];
  current: string;
  onPick: (date: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(20);

  const q = query.trim().toLowerCase();
  const entries = written
    .filter((d) => d.date !== current)
    .filter((d) => q === "" || d.reflection.some((b) => b.text.toLowerCase().includes(q)));

  if (written.filter((d) => d.date !== current).length === 0) return null;

  const months = new Map<string, typeof entries>();
  for (const e of entries.slice(0, shown)) {
    const key = e.date.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), e]);
  }

  return (
    <section className="mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">Earlier</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your journal…"
          className="w-full max-w-[240px] rounded-lg border border-line bg-panel px-3 py-1.5 text-[13px] placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-ink-3">
          Nothing in the journal mentions “{query}”.
        </p>
      ) : (
        <div className="grid gap-6">
          {[...months.entries()].map(([month, list]) => (
            <div key={month}>
              <p className="mb-2 text-[13px] font-semibold tracking-tight">
                {new Date(`${month}-15T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                <span className="ml-2 text-[11px] font-normal text-ink-3">
                  {list.length} {list.length === 1 ? "entry" : "entries"}
                </span>
              </p>

              <ol className="relative grid gap-1.5 border-l border-line pl-4">
                {list.map((day) => {
                  const { title, excerpt } = headline(day.reflection);
                  const d = new Date(`${day.date}T12:00:00`);
                  return (
                    <li key={day.date} className="relative">
                      {/* The dot on the line, where this day sits in the month. */}
                      <span
                        aria-hidden
                        className="absolute -left-[21px] top-4 size-2.5 rounded-full border-2 border-[var(--bg)] bg-accent"
                      />
                      <button
                        type="button"
                        onClick={() => onPick(day.date)}
                        className="group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-panel"
                      >
                        <span className="w-9 shrink-0 text-center">
                          <span className="nums block text-[18px] font-semibold leading-none">{d.getDate()}</span>
                          <span className="mt-1 block text-[10px] uppercase tracking-wide text-ink-3">
                            {d.toLocaleDateString("en-US", { weekday: "short" })}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium">{title}</span>
                          {excerpt && (
                            <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-relaxed text-ink-2">
                              {excerpt}
                            </span>
                          )}
                        </span>
                        <span className="nums shrink-0 pt-0.5 text-[11px] text-ink-3">
                          {wordCount(day.reflection)}w
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}

          {entries.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + 20)}
              className="justify-self-start rounded-lg border border-line px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              Show older entries
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * A title and an excerpt from an entry's blocks.
 *
 * A heading wins if there is one — someone who wrote one meant it as the
 * title. Otherwise the first sentence of the first paragraph, which is
 * usually the line that sets up the rest.
 */
function headline(blocks: Block[]): { title: string; excerpt: string } {
  const filled = blocks.filter((b) => b.text.trim() !== "" && b.type !== "image");
  if (filled.length === 0) return { title: "—", excerpt: "" };

  const heading = filled.find((b) => b.type === "h2" || b.type === "h3");
  if (heading) {
    return {
      title: heading.text.trim(),
      excerpt: filled.filter((b) => b !== heading).map((b) => b.text.trim()).join(" "),
    };
  }

  const all = filled.map((b) => b.text.trim()).join(" ");
  const cut = all.search(/[.!?](\s|$)/);
  if (cut > 8 && cut < 90) return { title: all.slice(0, cut + 1), excerpt: all.slice(cut + 1).trim() };
  if (all.length <= 70) return { title: all, excerpt: "" };
  const space = all.lastIndexOf(" ", 64);
  const at = space > 30 ? space : 64;
  return { title: `${all.slice(0, at)}…`, excerpt: all.slice(at).trim() };
}

function wordCount(blocks: Block[]): number {
  return blocks.reduce(
    (n, b) => (b.type === "image" ? n : n + (b.text.trim() === "" ? 0 : b.text.trim().split(/\s+/).length)),
    0,
  );
}

function daysApart(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

function newId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

/**
 * Consecutive days written, counting back from today.
 *
 * Today not being written yet does not break the streak — it has not happened
 * yet. A journal that resets your count at midnight for not having lived the
 * day out is a journal you stop opening.
 */
function streak(days: { date: string; reflection: Block[] }[], today: string): number {
  const written = new Set(
    days.filter((d) => d.reflection.some((b) => b.text.trim() !== "")).map((d) => d.date),
  );

  let cursor = written.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (written.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}


/**
 * The journal, alone on the screen.
 *
 * Fixed over everything rather than a wider column: the point of asking for
 * this is to stop seeing the deadline counters and the nav while writing about
 * your day, and a page that merely got wider still has all of that on it.
 *
 * Sparse, but not bare. The first version was text on the raw background with
 * nothing else on screen, and an empty day read as a fault rather than an
 * invitation — there was no surface, no edge, nothing to write *on*. The page
 * is a lit sheet now, the day it belongs to is stated once at the top, and
 * what you have written is counted at the foot. That is the whole addition:
 * everything else is still the page.
 */
function FocusMode({
  date,
  today,
  blocks,
  streak,
  onChange,
  onDate,
  onClose,
}: {
  date: string;
  today: string;
  blocks: Block[];
  /** Consecutive days written, ending today. Shown at the foot. */
  streak: number;
  onChange: (blocks: Block[]) => void;
  onDate: (date: string) => void;
  onClose: () => void;
}) {
  // Remembered per device: whether someone writes in a column or across the
  // whole screen is a standing preference, not a per-session decision.
  const [wide, setWide] = useState(() => {
    try {
      return localStorage.getItem(WIDE_KEY) === "1";
    } catch {
      return false;
    }
  });

  // The write stays outside the updater. React invokes updaters twice in
  // development to surface exactly this kind of side effect, which toggled the
  // value twice and left it unchanged — the button appeared dead.
  const toggleWide = () => {
    const next = !wide;
    setWide(next);
    try {
      localStorage.setItem(WIDE_KEY, next ? "1" : "0");
    } catch {
      // Private browsing. The choice still holds for this session.
    }
  };

  const written = blocks.filter((b) => b.text.trim() !== "").length;
  const words = blocks
    .map((b) => b.text)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      {/* One wash of colour, thrown from above the page.

          Not decoration for its own sake: a full-bleed flat background gives
          the eye no depth cue at all, so the sheet below had nothing to sit
          against. At this strength it is barely nameable as a colour — it just
          stops the screen reading as switched off. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[42vh] opacity-[0.55]"
        style={{
          background:
            "radial-gradient(90% 100% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)",
        }}
      />

      {/* The width is a computed value rather than a utility class: Tailwind
          does not generate an arbitrary `min()` with a comma in it, so the
          class was applied and silently did nothing. */}
      <div
        className="relative mx-auto w-full px-5 py-10 transition-[max-width] duration-300 sm:px-8 sm:py-16"
        style={{ maxWidth: wide ? "min(1400px, 92vw)" : "42rem" }}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Step
              label="Previous day"
              onClick={() => onDate(addDays(date, -1))}
              d="M10 3.5 L5.5 8 L10 12.5"
            />
            <div className="min-w-[140px] text-center">
              <p className="text-[15px] font-semibold tracking-tight">{formatDate(date)}</p>
              <p className="text-xs text-ink-3">{pastLabel(date)}</p>
            </div>
            <Step
              label="Next day"
              onClick={() => onDate(addDays(date, 1))}
              d="M6 3.5 L10.5 8 L6 12.5"
            />
            {date !== today && (
              <Button size="sm" onClick={() => onDate(today)}>
                Today
              </Button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={toggleWide}
              aria-pressed={wide}
              aria-label={wide ? "Narrow column" : "Wide column"}
              title={wide ? "Narrow column" : "Wide column"}
              className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
            >
              <svg viewBox="0 0 16 16" aria-hidden className="size-4">
                {wide ? (
                  <path
                    d="M5.5 4 3 8l2.5 4M10.5 4 13 8l-2.5 4M8 2.5v11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <path
                    d="M2.5 4 5 8l-2.5 4M13.5 4 11 8l2.5 4M8 2.5v11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            </button>

            <button
              onClick={onClose}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
            >
              <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
                <path
                  d="M2 6h4V2M14 6h-4V2M2 10h4v4M14 10h-4v4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Exit
              <kbd className="ml-0.5 rounded border border-line px-1 text-[10px]">Esc</kbd>
            </button>
          </div>
        </div>

        {/*
          The sheet. A page you are writing on should have an edge and catch
          some light; without one the words were floating in the dark and the
          left margin was wherever the longest line happened to end.
        */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          // A minimum height, so a day with one line on it still looks like a
          // page you have started rather than a box that failed to fill.
          className="min-h-[46vh] rounded-2xl border border-line bg-panel px-4 py-6 shadow-[var(--shadow-lg),var(--edge)] sm:px-8 sm:py-9"
        >
          <BlockEditor
            key={date}
            blocks={blocks}
            onChange={onChange}
            placeholder="How did it go? Press / for a heading, list, image or link."
          />
        </motion.div>

        {/*
          What you have written, at the foot where a manuscript keeps it.

          The streak is the only number here that is about more than today, and
          it is the reason to open this tomorrow as well — a journal's whole
          difficulty is the second week, not the first.
        */}
        <div className="mt-4 flex items-center gap-3 px-1 text-[11px] text-ink-3">
          <span className="nums">
            {words} {words === 1 ? "word" : "words"}
          </span>
          {words > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="nums">
                {written} {written === 1 ? "block" : "blocks"}
              </span>
            </>
          )}
          {streak > 1 && (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-text">
              <span aria-hidden className="size-1.5 rounded-full bg-accent" />
              {streak} days in a row
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
