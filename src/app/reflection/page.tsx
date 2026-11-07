"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { addDays, formatDate, pastLabel, todayISO } from "@/lib/dates";
import { Block } from "@/lib/types";
import { BlockEditor } from "@/components/BlockEditor";
import { DateField } from "@/components/DateField";
import { Button, Panel } from "@/components/ui";
import { Flame } from "@/components/Flame";
import { Dictation, shape } from "@/components/Dictation";
import { motion } from "motion/react";
import { spring } from "@/lib/motion";

/** Where the wide-column preference is kept. */
const WIDE_KEY = "iblearner.reflectionWide";
const SIZE_KEY = "lockin.reflection.size";
const MIN_W = 480;
const MAX_W = 1600;
const NARROW_W = 880;

export default function ReflectionPage() {
  const store = useStore();
  // `?date=` opens a particular day — search results for journal entries land
  // on the entry they matched rather than on today.
  const [date, setDate] = useState(() => {
    if (typeof window === "undefined") return todayISO();
    const d = new URLSearchParams(window.location.search).get("date");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayISO();
  });
  const [focus, setFocus] = useState(false);
  const writing = useRef<HTMLDivElement>(null);

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

  // Answers to the day's questions live in the entry itself, as a heading and
  // a paragraph with ids starting "q-", so they count as writing everywhere
  // (word counts, streaks, search, the form model). The free editor below
  // shows everything else.
  const answers = reflection.filter((b) => b.id.startsWith("q-"));
  const free = reflection.filter((b) => !b.id.startsWith("q-"));
  const save = (qa: Block[], rest: Block[]) => store.setDay(date, { reflection: [...qa, ...rest] });

  const answer = (q: string, text: string) => {
    const k = qid(q);
    const has = answers.some((b) => b.id === `${k}-a`);
    if (text.trim() === "") {
      save(answers.filter((b) => !b.id.startsWith(`${k}-`)), free);
    } else if (has) {
      save(answers.map((b) => (b.id === `${k}-a` ? { ...b, text } : b)), free);
    } else {
      save(
        [
          ...answers,
          { id: `${k}-h`, type: "h3" as const, text: q, done: false },
          { id: `${k}-a`, type: "text" as const, text, done: false },
        ],
        free,
      );
    }
  };
  // Dictation with no field focused: carry on the last paragraph.
  const appendSpoken = (text: string) => {
    const last = free.at(-1);
    if (last && last.type === "text") {
      save(answers, free.map((b) => (b === last ? { ...b, text: b.text + shape(b.text, text) } : b)));
    } else {
      save(answers, [...free, { id: `v${Date.now().toString(36)}`, type: "text", text: shape("", text), done: false }]);
    }
  };
  const dropAnswer = (q: string) => save(answers.filter((b) => !b.id.startsWith(`${qid(q)}-`)), free);

  if (focus) {
    return (
      <FocusMode
        date={date}
        today={today}
        blocks={free}
        all={reflection}
        questions={<Questions key={date} date={date} answers={answers} onAnswer={answer} onDrop={dropAnswer} />}
        streak={streak(store.days, today)}
        onChange={(blocks) => save(answers, blocks)}
        onDate={setDate}
        onClose={() => setFocus(false)}
      />
    );
  }

  const words = wordCount(reflection);

  return (
    <div className="page-in">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reflection</h1>
          <p className="mt-1 text-sm text-ink-2">A page a day. What happened, what it felt like, what to do about it.</p>
        </div>
        <Month days={store.days} today={today} selected={date} onPick={setDate} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
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
                <Dictation scope={writing} onAppend={appendSpoken} />
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

            <div ref={writing} className="px-4 py-5 sm:px-6">
              <Questions key={date} date={date} answers={answers} onAnswer={answer} onDrop={dropAnswer} />

              <BlockEditor
                // Remounting per day, so an edit to one morning cannot land in
                // another when the date changes mid-keystroke.
                key={`free-${date}`}
                blocks={free}
                onChange={(blocks) => save(answers, blocks)}
                placeholder="Anything else on your mind? Press / for a heading, list, image or link."
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
    <div className="flex max-w-full flex-wrap items-center gap-[3px] sm:gap-[5px]" aria-label="Last 30 days">
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

/** Deeper ones, mixed in so a set of questions is not all small talk. */
const DEEP = [
  "What emotion showed up most today, and what triggered it?",
  "What would the version of you a year from now tell you about today?",
  "Where did you choose comfort over growth today — and was it the right call?",
  "What are you proud of this week that you haven't given yourself credit for?",
  "What's a belief you acted on today? Is it actually true?",
  "What drained you today, and what filled you back up?",
  "Which habit is quietly shaping you the most right now?",
  "What's one conversation you need to have but keep delaying?",
  "How close was today to the day you'd design for yourself?",
  "What did you do today purely for your future self?",
  "What's one small win you can build on tomorrow?",
  "Where did you feel close to Allah today, and where far?",
  "What are you pretending not to know right now?",
  "If you kept living exactly like today for a year, where would you end up?",
  "What did you want today that you didn't let yourself ask for?",
  "Which fear made a decision for you today?",
  "What would you do this week if you weren't worried about looking stupid?",
  "Who are you becoming — and is that who you want to be?",
  "What did you tolerate today that you shouldn't have?",
  "What's the story you keep telling yourself about why you can't?",
  "What gave you energy today without costing you anything?",
  "When did you last feel genuinely proud — what were you doing?",
  "What part of today would you want to remember in ten years?",
  "Where are you working hard on the wrong thing?",
];

const LIGHT_COUNT = 2;
const DEEP_COUNT = 3;
const DISMISSED_KEY = "lockedin.prompts.dismissed";

/** A stable short id for a question, so its answer can be found again. */
function qid(q: string): string {
  let h = 5381;
  for (let i = 0; i < q.length; i++) h = ((h << 5) + h + q.charCodeAt(i)) | 0;
  return `q-${(h >>> 0).toString(36)}`;
}

/** Walks a list from a per-day start with a stride: each day a different mix. */
function deal(list: string[], seed: number, count: number, skip: string[]): string[] {
  const out: string[] = [];
  const n = list.length;
  for (let i = 0; out.length < count && i < n * 2; i += 1) {
    const q = list[(((seed * 7 + i * 5) % n) + n) % n];
    if (!skip.includes(q) && !out.includes(q)) out.push(q);
  }
  return out;
}

/**
 * The day's questions, already on the page.
 *
 * Five of them, two light and three deep, waiting under the date like a page
 * someone prepared for you. Read them, answer the ones that land, ignore the
 * rest; × takes one away for good (remembered per day). An answer is written
 * straight into the entry.
 */
function Questions({
  date,
  answers,
  onAnswer,
  onDrop,
}: {
  date: string;
  answers: Block[];
  onAnswer: (q: string, text: string) => void;
  onDrop: (q: string) => void;
}) {
  const seed = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      const all = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "{}") as Record<string, string[]>;
      return all[date] ?? [];
    } catch {
      return [];
    }
  });

  const remember = (list: string[]) => {
    setDismissed(list);
    try {
      const all = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "{}") as Record<string, string[]>;
      all[date] = list;
      const keys = Object.keys(all).sort().slice(-30);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(Object.fromEntries(keys.map((k) => [k, all[k]]))));
    } catch {
      // Private browsing: holds for this visit only.
    }
  };

  // Answered questions always stay; the day's deal fills in the rest.
  const answered = answers.filter((b) => b.type === "h3").map((b) => b.text);
  const dealt = [...deal(DEEP, seed, DEEP_COUNT, dismissed), ...deal(PROMPTS, seed + 3, LIGHT_COUNT, dismissed)];
  const questions = [...answered, ...dealt.filter((q) => !answered.includes(q))];
  const textOf = (q: string) => answers.find((b) => b.id === `${qid(q)}-a`)?.text ?? "";

  const remove = (q: string) => {
    if (textOf(q).trim() !== "" && !window.confirm("Delete this question and your answer?")) return;
    onDrop(q);
    remember([...dismissed, q]);
  };

  if (questions.length === 0) {
    return (
      <div className="mb-5 flex items-center justify-between rounded-xl border border-dashed border-line px-4 py-3 text-[13px] text-ink-3">
        No questions today.
        <button type="button" onClick={() => remember([])} className="font-medium text-accent-text hover:underline">
          Bring them back
        </button>
      </div>
    );
  }

  return (
    <section className="mb-6">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3">Today&apos;s questions</p>
        <p className="nums text-[12px] text-ink-3">
          {answered.length}/{questions.length} answered
        </p>
      </div>
      <ol className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-line bg-panel">
        {questions.map((q, i) => (
          <QuestionCard
            key={q}
            n={i + 1}
            q={q}
            deep={DEEP.includes(q)}
            text={textOf(q)}
            onChange={(t) => onAnswer(q, t)}
            onRemove={() => remove(q)}
          />
        ))}
      </ol>
    </section>
  );
}

function QuestionCard({
  n,
  q,
  deep,
  text,
  onChange,
  onRemove,
}: {
  n: number;
  q: string;
  deep: boolean;
  text: string;
  onChange: (t: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const answered = text.trim() !== "";

  // Grow with the answer.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  return (
    <li className="group relative px-3.5 py-2.5 transition-colors focus-within:bg-panel-2/40 hover:bg-panel-2/30">
      <div className="flex items-start gap-2.5">
        <span
          className={`nums mt-[3px] grid size-[18px] shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors ${
            answered ? "bg-[var(--up)] text-white" : "bg-panel-2 text-ink-3"
          }`}
        >
          {answered ? "✓" : n}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold leading-snug">
            {q}
            {deep && (
              <span className="ml-1.5 rounded bg-accent-soft px-1 py-px align-[1px] text-[9px] font-bold uppercase tracking-wider text-accent-text">
                deep
              </span>
            )}
          </p>
          <textarea
            ref={ref}
            rows={1}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              onChange(e.target.value);
            }}
            placeholder="Answer if it lands…"
            className="bare mt-0.5 w-full resize-none overflow-hidden bg-transparent text-[13px] leading-relaxed text-ink-2 placeholder:text-ink-3/70"
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Delete question: ${q}`}
          title="Delete this question"
          className="grid size-6 shrink-0 place-items-center rounded-md text-ink-3 opacity-0 transition-[opacity,color,background-color] hover:bg-panel-2 hover:text-[var(--urgent)] focus:opacity-100 group-hover:opacity-100"
        >
          <svg viewBox="0 0 16 16" aria-hidden className="size-3">
            <path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </li>
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
      <p className="text-[12.5px] font-semibold tracking-[0.08em] text-accent-text">{pick.label}</p>
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
        <h2 className="text-[12.5px] font-semibold tracking-[0.08em] text-ink-3">Earlier</h2>
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
  all,
  questions,
  streak,
  onChange,
  onDate,
  onClose,
}: {
  date: string;
  today: string;
  /** The free writing; the day's answered questions come in `questions`. */
  blocks: Block[];
  /** Everything written that day, answers included, for the counts. */
  all: Block[];
  questions: ReactNode;
  /** Consecutive days written, ending today. Shown at the foot. */
  streak: number;
  onChange: (blocks: Block[]) => void;
  onDate: (date: string) => void;
  onClose: () => void;
}) {
  // Remembered per device: how big someone likes the page is a standing
  // preference, not a per-session decision. Drag the edges to change it.
  const [size, setSize] = useState<{ w: number; h: number | null }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SIZE_KEY) ?? "null");
      if (saved && typeof saved.w === "number") return { w: saved.w, h: typeof saved.h === "number" ? saved.h : null };
      if (localStorage.getItem(WIDE_KEY) === "1") return { w: 1400, h: null };
    } catch {}
    return { w: NARROW_W, h: null };
  });
  const [resizing, setResizing] = useState(false);
  const save = (next: { w: number; h: number | null }) => {
    try {
      localStorage.setItem(SIZE_KEY, JSON.stringify(next));
    } catch {
      // Private browsing. The size still holds for this session.
    }
  };
  const wide = size.w > 1100;
  const toggleWide = () => {
    const next = { ...size, w: wide ? NARROW_W : 1400 };
    setSize(next);
    save(next);
  };

  /** Drag an edge. Sides move symmetrically because the page stays centred. */
  const startResize = (axis: "x" | "y", side: 1 | -1) => (e: React.PointerEvent) => {
    const el = sheet.current;
    if (!el) return;
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const w0 = el.offsetWidth;
    const h0 = el.offsetHeight;
    let latest = size;
    setResizing(true);
    const move = (ev: PointerEvent) => {
      if (axis === "x") {
        const w = Math.round(Math.min(MAX_W, window.innerWidth - 32, Math.max(MIN_W, w0 + side * 2 * (ev.clientX - x0))));
        latest = { ...latest, w };
      } else {
        const h = Math.round(Math.max(260, h0 + (ev.clientY - y0)));
        latest = { ...latest, h };
      }
      setSize(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setResizing(false);
      save(latest);
    };
    document.body.style.cursor = axis === "x" ? "ew-resize" : "ns-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const resetAxis = (axis: "x" | "y") => {
    const next = axis === "x" ? { ...size, w: NARROW_W } : { ...size, h: null };
    setSize(next);
    save(next);
  };

  const sheet = useRef<HTMLDivElement>(null);
  const appendSpoken = (text: string) => {
    const last = blocks.at(-1);
    if (last && last.type === "text") {
      onChange(blocks.map((b) => (b === last ? { ...b, text: b.text + shape(b.text, text) } : b)));
    } else {
      onChange([...blocks, { id: `v${Date.now().toString(36)}`, type: "text", text: shape("", text), done: false }]);
    }
  };

  const written = all.filter((b) => b.text.trim() !== "").length;
  const words = all
    .map((b) => b.text)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      {/* The width is a computed value rather than a utility class: Tailwind
          does not generate an arbitrary `min()` with a comma in it, so the
          class was applied and silently did nothing. */}
      <div
        className={`relative mx-auto w-full px-4 py-8 sm:px-8 sm:py-12 ${resizing ? "" : "transition-[max-width] duration-300"}`}
        style={{ maxWidth: size.w + 64 }}
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
            <Dictation scope={sheet} onAppend={appendSpoken} compact />
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
          ref={sheet}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          // A minimum height, so a day with one line on it still looks like a
          // page you have started rather than a box that failed to fill.
          className="group/sheet relative rounded-2xl border border-line bg-panel px-4 py-6 shadow-[var(--shadow-lg),var(--edge)] sm:px-10 sm:py-10"
          style={{ minHeight: size.h ?? "72vh" }}
        >
          {/* Grips on the edges: drag to resize, double-click to reset. */}
          {([-1, 1] as const).map((side) => (
            <div
              key={side}
              onPointerDown={startResize("x", side)}
              onDoubleClick={() => resetAxis("x")}
              title="Drag to resize · double-click to reset"
              className={`absolute inset-y-0 hidden w-4 cursor-ew-resize items-center justify-center sm:flex ${side < 0 ? "-left-2" : "-right-2"}`}
            >
              <span
                className={`h-12 w-1 rounded-full bg-[var(--border)] transition-opacity group-hover/sheet:opacity-100 ${resizing ? "opacity-100" : "opacity-0"}`}
              />
            </div>
          ))}
          <div
            onPointerDown={startResize("y", 1)}
            onDoubleClick={() => resetAxis("y")}
            title="Drag to resize · double-click to reset"
            className="absolute inset-x-0 -bottom-2 hidden h-4 cursor-ns-resize items-center justify-center sm:flex"
          >
            <span
              className={`h-1 w-12 rounded-full bg-[var(--border)] transition-opacity group-hover/sheet:opacity-100 ${resizing ? "opacity-100" : "opacity-0"}`}
            />
          </div>
          {questions}
          <BlockEditor
            key={`free-${date}`}
            blocks={blocks}
            onChange={onChange}
            placeholder="Anything else on your mind? Press / for a heading, list, image or link."
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
