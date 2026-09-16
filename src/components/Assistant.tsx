"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAssistant, Message } from "@/lib/ai/useAssistant";
import { useStore } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";
import { ToolResult } from "@/lib/ai/tools";

/**
 * The assistant, as a dock on the right rather than a page of its own.
 *
 * It is meant to be opened over whatever the student is already looking at,
 * asked one thing, and closed — so it never takes the whole screen on desktop
 * and never costs a navigation. On phones there is no room for that, and it
 * becomes a full sheet.
 */

const SUGGESTIONS = [
  "What should I work on right now?",
  "How is my week looking?",
  "Which course needs the most attention?",
];

export function Assistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { messages, pending, error, send, reset } = useAssistant();
  const { profile } = useStore();
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

  const submit = () => {
    const text = draft;
    setDraft("");
    void send(text);
    inputRef.current?.focus();
  };

  return createPortal(
    <>
      {/* Desktop keeps the page visible and usable behind the dock; only the
          phone sheet needs to dim what it covers. */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="false"
        aria-label="Assistant"
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-panel shadow-[-8px_0_32px_-12px_rgba(0,0,0,0.25)] transition-transform duration-[var(--nav-dur)] ease-[var(--nav-ease)] sm:w-[420px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Spark active={pending} />
          <span className="text-[13px] font-semibold tracking-tight">Assistant</span>

          <div className="ml-auto flex items-center gap-0.5">
            {messages.length > 0 && (
              <button
                onClick={() => {
                  reset();
                  setDraft("");
                  inputRef.current?.focus();
                }}
                className="rounded-lg px-2 py-1 text-[12px] font-medium text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
              >
                New
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close assistant"
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
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <Empty name={profile.name} onPick={(s) => void send(s)} />
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((m) => (
                <Bubble key={m.id} message={m} />
              ))}
              {pending && <Thinking />}
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-[var(--urgent)]/30 bg-[var(--urgent)]/10 px-3 py-2 text-[12px] text-[var(--urgent)]">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-line p-3">
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
                  submit();
                }
              }}
              placeholder="Ask anything, or tell it what to do"
              className="max-h-[140px] flex-1 resize-none bg-transparent text-[13px] leading-relaxed outline-none placeholder:text-ink-3"
            />
            <button
              onClick={submit}
              disabled={draft.trim() === "" || pending}
              aria-label="Send"
              className="mb-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-white transition-opacity disabled:opacity-30"
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
            </button>
          </div>
          <p className="mt-2 px-1 text-[10px] leading-snug text-ink-3">
            Your hub is sent to Google Gemini to answer. It can add and edit things, but never
            delete.
          </p>
        </div>
      </aside>
    </>,
    document.body,
  );
}

function Empty({ name, onPick }: { name: string; onPick: (s: string) => void }) {
  return (
    <div className="flex h-full flex-col justify-center gap-5 px-1 pb-8">
      <div>
        <p className="text-[15px] font-semibold tracking-tight">Hey {name}.</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
          I can see your tasks, courses, grades, universities and journal. Ask me about any of it —
          or just tell me what you need done.
        </p>
      </div>
      <div className="flex flex-col items-start gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-lg border border-line px-2.5 py-1.5 text-left text-[12px] text-ink-2 transition-colors hover:border-line-strong hover:bg-panel-2 hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="self-end rounded-xl rounded-br-sm bg-accent-soft px-3 py-2 text-[13px] leading-relaxed text-accent-text">
        {message.text}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[13px] leading-relaxed text-ink">
        <Markdown text={message.text} />
      </div>
      {message.actions && message.actions.length > 0 && (
        <div className="flex flex-col items-start gap-1">
          {message.actions.map((a, i) => (
            <Action key={i} result={a} />
          ))}
        </div>
      )}
    </div>
  );
}

/** What the assistant changed, so a write is never silent. */
function Action({ result }: { result: ToolResult }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium ${
        result.ok
          ? "border-[var(--up)]/30 bg-[var(--up)]/10 text-[var(--up)]"
          : "border-[var(--urgent)]/30 bg-[var(--urgent)]/10 text-[var(--urgent)]"
      }`}
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-3">
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
    </span>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-ink-3"
          style={{ animationDelay: `${i * 160}ms`, animationDuration: "1s" }}
        />
      ))}
    </div>
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
    <svg viewBox="0 0 16 16" aria-hidden className={`size-4 text-accent ${active ? "animate-spin" : ""}`}>
      <path
        d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4z"
        fill="currentColor"
      />
    </svg>
  );
}
