"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useAssistant, Message } from "@/lib/ai/useAssistant";
import { useStore } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";
import { courseAverage } from "@/lib/grades";
import { daysUntil, greeting, relativeLabel, todayISO } from "@/lib/dates";
import { ToolResult } from "@/lib/ai/tools";
import { listContainer, listItem, spring, springSnappy } from "@/lib/motion";
import { play } from "@/lib/sound";

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
 * What to open with, drawn from the hub rather than written in advance.
 *
 * A panel that greets everyone identically is a search box with a personality
 * bolted on. This costs no request — it is all data already in memory — and it
 * means opening the assistant already tells you something, and the things it
 * offers to do are about your actual week.
 */
function brief(store: ReturnType<typeof useStore>): { line: string; prompts: string[] } {
  const open = store.tasks.filter((t) => t.status !== "completed");
  const overdue = open.filter((t) => t.dueDate != null && daysUntil(t.dueDate) < 0);
  const today = open.filter((t) => t.dueDate === todayISO());

  const soon = open
    .filter((t) => t.dueDate != null && daysUntil(t.dueDate) >= 0 && daysUntil(t.dueDate) <= 7)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0];

  const weakest = store.courses
    .map((c) => ({ course: c, avg: courseAverage(store.grades, c.id).value }))
    .filter((x): x is { course: (typeof store.courses)[number]; avg: number } => x.avg != null)
    .sort((a, b) => a.avg - b.avg)[0];

  const journalled = store.days.filter((d) =>
    d.reflection.some((b) => b.text.trim() !== ""),
  ).length;

  const line =
    overdue.length > 0
      ? `${overdue.length} ${overdue.length === 1 ? "thing is" : "things are"} overdue.`
      : today.length > 0
        ? `${today.length} ${today.length === 1 ? "task is" : "tasks are"} due today.`
        : soon
          ? `Next up is "${soon.title}", ${relativeLabel(soon.dueDate as string).toLowerCase()}.`
          : "Nothing is pressing right now.";

  const prompts: string[] = [];
  if (overdue.length > 0) prompts.push("Help me get out from under the overdue work");
  if (soon) prompts.push(`How should I approach "${soon.title}"?`);
  if (weakest) prompts.push(`Why is ${weakest.course.name} the one slipping?`);
  if (journalled >= 3) prompts.push("What patterns do you see in my journal?");
  prompts.push("What should I work on right now?");

  return { line, prompts: prompts.slice(0, 3) };
}

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
          <span className="text-[13px] font-semibold tracking-tight">{ASSISTANT_NAME}</span>
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
            items={suggestions.length > 0 ? suggestions : QUICK_ACTIONS.map((q) => q.label)}
            onPick={(label) =>
              ask(
                suggestions.length > 0
                  ? label
                  : (QUICK_ACTIONS.find((q) => q.label === label)?.prompt ?? label),
              )
            }
            disabled={pending}
          />

          <div className="flex items-end gap-2 rounded-xl border border-line bg-bg px-3 py-2 transition-colors focus-within:border-line-strong">
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
              className="max-h-[140px] flex-1 resize-none bg-transparent text-[13px] leading-relaxed outline-none placeholder:text-ink-3"
            />
            <motion.button
              onClick={() => draft.trim() !== "" && !pending && ask(draft)}
              disabled={draft.trim() === "" || pending}
              aria-label="Send"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.88 }}
              animate={{ opacity: draft.trim() === "" || pending ? 0.3 : 1 }}
              transition={springSnappy}
              className="mb-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-white"
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
          <p className="mt-2 px-1 text-[10px] leading-snug text-ink-3">
            Your hub is sent to Google Gemini to answer. {ASSISTANT_NAME} can add and edit
            things, but never delete.
          </p>
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

function Empty({
  store,
  onPick,
}: {
  store: ReturnType<typeof useStore>;
  onPick: (s: string) => void;
}) {
  const { line, prompts } = brief(store);
  const noticed = store.insights.filter((i) => i.dismissedAt == null)[0];
  // What it has learned, newest first. Two is the whole point — a wall of
  // notes turns the greeting into a settings page.
  const remembered = [...store.memory]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 2);

  return (
    <motion.div
      variants={listContainer}
      initial="hidden"
      animate="show"
      className="flex h-full flex-col justify-center gap-5 px-1 pb-8"
    >
      <motion.div variants={listItem}>
        <p className="text-[15px] font-semibold tracking-tight">
          {greeting()}, {store.profile.name}.
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{line}</p>
      </motion.div>

      {noticed && (
        <motion.div
          variants={listItem}
          className="rounded-lg border border-line bg-panel-2 px-3 py-2.5"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">
            I noticed
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{noticed.body}</p>
        </motion.div>
      )}

      {/*
        What it has picked up about them, shown rather than filed away. An
        assistant that quietly adapts is indistinguishable from one that is
        inconsistent; showing the notes is what makes the adaptation legible —
        and the link is how a wrong one gets removed.
      */}
      {remembered.length > 0 && (
        <motion.div variants={listItem}>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">
            What {ASSISTANT_NAME} remembers
          </p>
          <ul className="flex flex-col gap-1">
            {remembered.map((note) => (
              <li key={note.id} className="text-[12px] leading-relaxed text-ink-2">
                <span className="text-ink-3">{note.topic} · </span>
                {note.note}
              </li>
            ))}
          </ul>
          <Link
            href="/settings"
            className="mt-1.5 inline-block text-[11px] text-ink-3 underline-offset-2 hover:text-ink hover:underline"
          >
            Manage what it remembers
          </Link>
        </motion.div>
      )}

      <motion.div variants={listContainer} className="flex flex-col items-start gap-1.5">
        {prompts.map((s) => (
          <motion.button
            key={s}
            variants={listItem}
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.98 }}
            transition={springSnappy}
            onClick={() => onPick(s)}
            className="rounded-lg border border-line px-2.5 py-1.5 text-left text-[12px] text-ink-2 transition-colors hover:border-line-strong hover:bg-panel-2 hover:text-ink"
          >
            {s}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
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
function Thinking() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-1 py-1"
      aria-label="Thinking"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-ink-3"
          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.12,
          }}
        />
      ))}
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

/** Turns over while the model is working, so the header shows life. */
function Spark({ active }: { active: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 16 16"
      aria-hidden
      className="size-4 shrink-0 text-accent"
      animate={active ? { rotate: 360, scale: [1, 1.15, 1] } : { rotate: 0, scale: 1 }}
      transition={
        active
          ? {
              rotate: { duration: 1.6, repeat: Infinity, ease: "linear" },
              scale: { duration: 1.6, repeat: Infinity },
            }
          : springSnappy
      }
    >
      <path
        d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4z"
        fill="currentColor"
      />
    </motion.svg>
  );
}
