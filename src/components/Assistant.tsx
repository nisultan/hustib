"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useAssistant, Message } from "@/lib/ai/useAssistant";
import { useStore } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";
import { greeting, todayISO } from "@/lib/dates";
import { ToolResult } from "@/lib/ai/tools";
import { listContainer, listItem, spring, springSnappy } from "@/lib/motion";
import { play } from "@/lib/sound";
import { primeReading } from "@/lib/prime";

/**
 * Lifee, as a dock on the right rather than a page of its own.
 *
 * It is meant to be opened over whatever the student is already looking at,
 * asked one thing, and closed — so it never takes the whole screen on desktop
 * and never costs a navigation. On phones there is no room for that, and it
 * becomes a full sheet.
 */

/** The name in the header, the placeholder, and the tour. One place. */
export const ASSISTANT_NAME = "Lifee";

/**
 * The standing instructions, always one tap away.
 *
 * Unlike the opening prompts these do not change with the week: they are the
 * four things a student comes back to the panel to have done, and a fixed
 * position is worth more than a clever one for something used daily. They are
 * asks, not chat — each one ends in the assistant writing to the hub.
 */
const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Plan my day", prompt: "Plan the rest of my day and put it on today's plan." },
  { label: "What's next", prompt: "What single thing should I work on right now?" },
  { label: "Catch me up", prompt: "What changed this week, and what am I behind on?" },
  {
    label: "Journal this",
    prompt: "Ask me how today went, then write what I tell you into today's reflection.",
  },
];

/**
 * Where a turn can go next, worked out from what it just did.
 *
 * The model is not asked for follow-ups — that costs a round trip and invites
 * it to pad the answer with three questions it hopes you will ask. What it
 * *did* is already known here, and the next move after "added a task" is
 * nearly always the same one.
 */
function followUps(message: Message): string[] {
  const did = (fragment: string) =>
    (message.actions ?? []).some((a) => a.ok && a.summary.startsWith(fragment));

  if (did('Added "') || did('Updated "')) {
    return ["Find me time for it this week", "What else is due around then?"];
  }
  if (did("Planned")) return ["Is that realistic?", "Move it later"];
  if (did("Recorded")) return ["How does that change my average?", "What should I fix first?"];
  if (did("Completed")) return ["What should I work on next?"];
  if ((message.actions ?? []).length > 0) return ["What should I work on next?"];
  return [];
}

export function Assistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { messages, pending, error, send, reset } = useAssistant();
  const store = useStore();
  const mounted = useMounted();
  const [draft, setDraft] = useState("");

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    inputRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Follow the conversation down as it grows, including while a reply streams
  // in as a pending row.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  if (!mounted) return null;

  const ask = (text: string) => {
    setDraft("");
    void play("send");
    void send(text);
    inputRef.current?.focus();
  };

  const last = messages[messages.length - 1];
  const suggestions =
    !pending && last?.role === "assistant" ? followUps(last) : ([] as string[]);

  return createPortal(
    <>
      {/* Desktop keeps the page visible and usable behind the dock; only the
          phone sheet needs to dim what it covers. */}
      <AnimatePresence>
        {open && (
          <motion.div
            onClick={onClose}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
          />
        )}
      </AnimatePresence>

      {/*
        The dock is a spring rather than a timed slide. A panel that arrives on
        a curve and settles reads as something being pulled out from the edge;
        the same movement on a fixed duration reads as a screen being replaced.
      */}
      <motion.aside
        role="dialog"
        aria-modal="false"
        aria-label={ASSISTANT_NAME}
        initial={false}
        animate={{ x: open ? 0 : "100%" }}
        transition={open ? spring : { duration: 0.2, ease: [0.4, 0, 1, 1] }}
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-panel shadow-[-8px_0_32px_-12px_rgba(0,0,0,0.25)] sm:w-[420px]"
      >
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Spark active={pending} />
          <span className="text-[14px] font-semibold tracking-tight">{ASSISTANT_NAME}</span>
          <AnimatePresence>
            {pending && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-[11px] text-ink-3"
              >
                thinking…
              </motion.span>
            )}
          </AnimatePresence>

          <div className="ml-auto flex items-center gap-0.5">
            <AnimatePresence>
              {messages.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    reset();
                    setDraft("");
                    inputRef.current?.focus();
                  }}
                  className="rounded-lg px-2 py-1 text-[12px] font-medium text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
                >
                  New
                </motion.button>
              )}
            </AnimatePresence>
            <Link
              href="/settings"
              onClick={onClose}
              title={`What ${ASSISTANT_NAME} remembers`}
              aria-label={`What ${ASSISTANT_NAME} remembers`}
              className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
            >
              <svg viewBox="0 0 20 20" aria-hidden className="size-[17px]">
                <path
                  d="M10 4.5a3 3 0 0 0-5.6 1.5A3 3 0 0 0 4 11.5a3 3 0 0 0 3 4 2.5 2.5 0 0 0 3 1M10 4.5a3 3 0 0 1 5.6 1.5 3 3 0 0 1 .4 5.5 3 3 0 0 1-3 4 2.5 2.5 0 0 1-3 1M10 4.5v12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <motion.button
              onClick={onClose}
              whileHover={{ rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              transition={springSnappy}
              aria-label={`Close ${ASSISTANT_NAME}`}
              className="grid size-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
            >
              <svg viewBox="0 0 16 16" aria-hidden className="size-4">
                <path
                  d="m4 4 8 8M12 4l-8 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </motion.button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <Empty store={store} onPick={ask} />
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((m) => (
                <Bubble key={m.id} message={m} />
              ))}
              <AnimatePresence>{pending && <Thinking />}</AnimatePresence>
            </div>
          )}

          {error && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-lg border border-[var(--urgent)]/30 bg-[var(--urgent)]/10 px-3 py-2 text-[12px] text-[var(--urgent)]"
            >
              {error}
            </motion.p>
          )}
        </div>

        <div className="border-t border-line p-3">
          {/*
            Two rails of one-tap asks. The follow-ups replace the standing ones
            when a turn has just landed, because at that moment the useful next
            move is about what just happened — and stacking both would be six
            buttons over a text box.
          */}
          <Chips
            items={
              suggestions.length > 0
                ? suggestions
                : messages.length > 0
                  ? QUICK_ACTIONS.map((q) => q.label)
                  : []
            }
            onPick={(label) =>
              ask(
                suggestions.length > 0
                  ? label
                  : (QUICK_ACTIONS.find((q) => q.label === label)?.prompt ?? label),
              )
            }
            disabled={pending}
          />

          <div className="flex items-end gap-2 rounded-2xl border border-line bg-bg py-1.5 pl-3.5 pr-1.5 transition-colors focus-within:border-[var(--accent)]">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                // Grow with the text, to a point — past that it scrolls, so
                // a pasted essay cannot swallow the transcript.
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim() !== "" && !pending) ask(draft);
                }
              }}
              placeholder="Ask anything, or tell it what to do"
              className="bare max-h-[140px] min-h-[24px] flex-1 resize-none self-center bg-transparent py-1 text-[13.5px] leading-6 placeholder:text-ink-3"
            />
            <motion.button
              onClick={() => draft.trim() !== "" && !pending && ask(draft)}
              disabled={draft.trim() === "" || pending}
              aria-label="Send"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.88 }}
              animate={{ opacity: draft.trim() === "" || pending ? 0.3 : 1 }}
              transition={springSnappy}
              className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent text-white"
            >
              <svg viewBox="0 0 16 16" aria-hidden className="size-4">
                <path
                  d="M8 13V3.5M4 7l4-3.5L12 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.button>
          </div>
        </div>
      </motion.aside>
    </>,
    document.body,
  );
}

/** A row of one-tap asks, dealt in left to right. */
function Chips({
  items,
  onPick,
  disabled,
}: {
  items: string[];
  onPick: (label: string) => void;
  disabled?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <motion.div
      // Keyed on the set, so swapping standing actions for follow-ups replays
      // the deal rather than silently relabelling the same buttons.
      key={items.join("|")}
      variants={listContainer}
      initial="hidden"
      animate="show"
      className="mb-2 flex flex-wrap gap-1.5"
    >
      {items.map((label) => (
        <motion.button
          key={label}
          variants={listItem}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          transition={springSnappy}
          disabled={disabled}
          onClick={() => onPick(label)}
          className="rounded-full border border-line bg-panel-2 px-2.5 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
        >
          {label}
        </motion.button>
      ))}
    </motion.div>
  );
}

/**
 * The opening screen: glance, then tap.
 *
 * It used to be a paragraph of greeting, a paragraph of "I noticed", two
 * remembered notes and three long prompt buttons, with four more chips under
 * that — a page to read before asking anything. Now it is three numbers, your
 * form, one line of what it noticed (tap for the rest), and four big tiles to
 * start from. What it remembers lives behind the brain icon in the header.
 */
function Empty({
  store,
  onPick,
}: {
  store: ReturnType<typeof useStore>;
  onPick: (s: string) => void;
}) {
  const [more, setMore] = useState(false);
  const today = todayISO();
  const open = store.tasks.filter((t) => t.status !== "completed");
  const overdue = open.filter((t) => t.dueDate != null && t.dueDate < today).length;
  const dueToday = open.filter((t) => t.dueDate === today).length;
  const blocks = store.plan.filter((p) => p.date === today);
  const blocksDone = blocks.filter((p) => p.done).length;
  const reading = primeReading(store);
  const noticed = store.insights.filter((i) => i.dismissedAt == null)[0];
  const headline = noticed ? (noticed.body.match(/^.*?[.!?](\s|$)/)?.[0] ?? noticed.body).trim() : null;

  const tiles: { label: string; prompt: string; icon: string; tone: string }[] = [
    { label: "Plan my day", prompt: QUICK_ACTIONS[0].prompt, icon: "M3.5 5h13v11h-13zM3.5 8.5h13M7 3v3M13 3v3", tone: "var(--accent)" },
    overdue > 0
      ? { label: "Fix overdue", prompt: "Help me get out from under the overdue work", icon: "M10 6v4.5M10 13.5h.01M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", tone: "var(--urgent)" }
      : { label: "What's next", prompt: QUICK_ACTIONS[1].prompt, icon: "M5 10h10M11 6l4 4-4 4", tone: "var(--up)" },
    { label: "Catch me up", prompt: QUICK_ACTIONS[2].prompt, icon: "M3 14 8 9l3 3 6-6M12.5 6H17v4.5", tone: "var(--medium)" },
    { label: "Journal this", prompt: QUICK_ACTIONS[3].prompt, icon: "M5 3.5h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5zM8.5 8h3.5M8.5 11h3.5", tone: "var(--high)" },
  ];

  return (
    <motion.div variants={listContainer} initial="hidden" animate="show" className="flex flex-col gap-4 px-1 pb-4">
      <motion.p variants={listItem} className="text-[18px] font-bold tracking-tight">
        {greeting()}, {store.profile.name}.
      </motion.p>

      {/* Today in three numbers. */}
      <motion.div variants={listItem} className="grid grid-cols-3 gap-2">
        <Stat value={overdue} label="overdue" tone={overdue > 0 ? "var(--urgent)" : undefined} />
        <Stat value={dueToday} label="due today" tone={dueToday > 0 ? "var(--high)" : undefined} />
        <Stat
          value={blocks.length ? `${blocksDone}/${blocks.length}` : "—"}
          label="blocks done"
          tone="var(--accent)"
          ring={blocks.length ? blocksDone / blocks.length : undefined}
        />
      </motion.div>

      {reading.rank && (
        <motion.div variants={listItem} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
          <span
            className="nums grid size-9 shrink-0 place-items-center rounded-lg text-[13px] font-bold"
            style={{ background: `color-mix(in srgb, ${reading.rank.color} 15%, transparent)`, color: reading.rank.color }}
          >
            {reading.score}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-ink-3">Your form</span>
            <span className="block text-[14px] font-bold" style={{ color: reading.rank.color }}>
              {reading.rank.name}
            </span>
          </span>
          {reading.weakest && (
            <button
              type="button"
              onClick={() =>
                onPick(
                  `My weakest area is ${reading.weakest!.label.toLowerCase()} (${reading.weakest!.why}). Give me one concrete thing to fix it today.`,
                )
              }
              className="shrink-0 rounded-lg bg-panel-2 px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-2 transition-colors hover:text-ink"
            >
              Fix {reading.weakest.label.toLowerCase()} →
            </button>
          )}
        </motion.div>
      )}

      {noticed && headline && (
        <motion.button
          variants={listItem}
          type="button"
          onClick={() => setMore((m) => !m)}
          className="flex items-start gap-2.5 rounded-xl bg-panel-2 px-3 py-2.5 text-left"
        >
          <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
          <span className="min-w-0 text-[13px] leading-snug">
            <span className="font-medium">{more ? noticed.body : headline}</span>
            {!more && headline !== noticed.body.trim() && <span className="text-ink-3"> more</span>}
          </span>
        </motion.button>
      )}

      <motion.div variants={listContainer} className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <motion.button
            key={t.label}
            variants={listItem}
            whileTap={{ scale: 0.97 }}
            transition={springSnappy}
            onClick={() => onPick(t.prompt)}
            className="flex flex-col items-start gap-3 rounded-xl border border-line bg-panel px-3 py-3 text-left transition-colors hover:border-line-strong hover:bg-panel-2"
          >
            <span
              className="grid size-8 place-items-center rounded-lg"
              style={{ background: `color-mix(in srgb, ${t.tone} 15%, transparent)`, color: t.tone }}
            >
              <svg viewBox="0 0 20 20" aria-hidden className="size-[18px]">
                <path d={t.icon} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-[13.5px] font-semibold">{t.label}</span>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}

function Stat({ value, label, tone, ring }: { value: number | string; label: string; tone?: string; ring?: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <div className="rounded-xl border border-line px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="nums text-[20px] font-bold leading-none" style={tone && value !== 0 ? { color: tone } : undefined}>
          {value}
        </span>
        {ring != null && (
          <svg viewBox="0 0 24 24" aria-hidden className="size-5 -rotate-90" style={{ color: tone }}>
            <circle cx="12" cy="12" r={r} fill="none" stroke="currentColor" strokeWidth="3" opacity="0.18" />
            <circle
              cx="12"
              cy="12"
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - ring)}
            />
          </svg>
        )}
      </div>
      <span className="mt-1 block text-[11px] text-ink-3">{label}</span>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <motion.div
        layout="position"
        // Arriving from the side it was typed on, so a long transcript still
        // reads as a conversation with two sides to it.
        initial={{ opacity: 0, x: 12, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={spring}
        className="max-w-[85%] self-end rounded-xl rounded-br-sm bg-accent-soft px-3 py-2 text-[13px] leading-relaxed text-accent-text"
      >
        {message.text}
      </motion.div>
    );
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="flex flex-col gap-2"
    >
      <div className="text-[13px] leading-relaxed text-ink">
        <Markdown text={message.text} />
      </div>
      {message.actions && message.actions.length > 0 && (
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="show"
          className="flex flex-col items-start gap-1"
        >
          {message.actions.map((a, i) => (
            <Action key={i} result={a} />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * What the assistant changed, so a write is never silent.
 *
 * A successful one is a link to where the change landed: the receipt and the
 * way in are the same chip, which is the difference between being told what
 * happened and being able to go and look.
 */
function Action({ result }: { result: ToolResult }) {
  const tone = result.ok
    ? "border-[var(--up)]/30 bg-[var(--up)]/10 text-[var(--up)]"
    : "border-[var(--urgent)]/30 bg-[var(--urgent)]/10 text-[var(--urgent)]";

  const body = (
    <>
      <svg viewBox="0 0 16 16" aria-hidden className="size-3 shrink-0">
        {result.ok ? (
          <path
            d="m3.5 8.5 3 3 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M8 4.5v4M8 11h.01"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
      {result.summary}
      {result.href && (
        <svg viewBox="0 0 16 16" aria-hidden className="size-3 shrink-0 opacity-60">
          <path
            d="M6 3.5 10.5 8 6 12.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </>
  );

  const className = `inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] font-medium ${tone}`;

  return (
    <motion.span
      variants={listItem}
      // A write deserves to land rather than appear: this is the app telling
      // them something changed underneath the page they are looking at.
      whileHover={result.href ? { x: 2 } : undefined}
      transition={springSnappy}
    >
      {result.href ? (
        <Link href={result.href} className={className}>
          {body}
        </Link>
      ) : (
        <span className={className}>{body}</span>
      )}
    </motion.span>
  );
}

/** Three dots, breathing in sequence. */
const STEPS = ["Reading your day", "Checking tasks and plan", "Looking at your goals", "Thinking it through", "Writing it up"];

/**
 * What shows while the model works: a breathing mark and a status line that
 * shimmers and walks through what it is actually doing, so a slow answer
 * reads as work rather than a hang.
 */
function Thinking() {
  const [step, setStep] = useState(0);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    const u = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1800);
    return () => {
      clearInterval(t);
      clearInterval(u);
    };
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2.5 py-1"
      role="status"
      aria-label="Thinking"
    >
      <span className="relative grid size-6 shrink-0 place-items-center">
        <motion.span
          className="absolute inset-0 rounded-full bg-accent"
          animate={{ scale: [0.55, 1, 0.55], opacity: [0.35, 0.12, 0.35] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          className="size-2.5 rounded-full bg-accent"
          animate={{ scale: [1, 0.7, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={step}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.22 }}
          className="shimmer-text text-[13px] font-medium"
        >
          {STEPS[step]}…
        </motion.span>
      </AnimatePresence>
      {secs >= 3 && <span className="nums text-[11px] text-ink-3">{secs}s</span>}
    </motion.div>
  );
}

/**
 * Just enough Markdown for what the model is told to produce: paragraphs,
 * bullets and bold. A full parser would be several hundred kilobytes to
 * render text that is deliberately meant to be plain.
 */
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length === 0) return;
    out.push(
      <ul key={`ul-${out.length}`} className="ml-4 flex list-disc flex-col gap-1">
        {bullets.map((b, i) => (
          <li key={i}>{bold(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
    } else if (trimmed === "") {
      flush();
    } else {
      flush();
      out.push(<p key={`p-${out.length}`}>{bold(trimmed)}</p>);
    }
  }
  flush();

  return <div className="flex flex-col gap-2">{out}</div>;
}

function bold(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

/** A speech bubble whose dots pulse while the model is working. */
function Spark({ active }: { active: boolean }) {
  return (
    <span className="relative grid size-6 shrink-0 place-items-center rounded-md bg-accent text-white">
      <svg viewBox="0 0 20 20" aria-hidden className="size-[14px]">
        <path
          d="M4.5 4h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h-1A1.5 1.5 0 0 1 3 12.5v-7A1.5 1.5 0 0 1 4.5 4z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {[7, 10, 13].map((x, i) => (
          <motion.circle
            key={x}
            cx={x}
            cy="9"
            r="1"
            fill="currentColor"
            animate={active ? { opacity: [0.3, 1, 0.3] } : { opacity: 1 }}
            transition={active ? { duration: 0.9, repeat: Infinity, delay: i * 0.15 } : { duration: 0.2 }}
          />
        ))}
      </svg>
    </span>
  );
}
