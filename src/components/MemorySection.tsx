"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useReflection } from "@/lib/ai/useReflection";
import { MemoryNote } from "@/lib/types";
import { formatDate } from "@/lib/dates";
import { Button, Panel } from "./ui";

/**
 * Everything the hub believes about the student, in plain sight.
 *
 * The whole point of memory is that it changes what gets recommended, which
 * makes a wrong note actively harmful — it quietly skews advice for weeks. So
 * it is all readable, all editable, all deletable, and a note can be pinned to
 * put it beyond the reach of a reflection pass that might otherwise revise it
 * away.
 */
export function MemorySection() {
  const store = useStore();
  const { reflect, running, error, ready } = useReflection();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const byTopic = new Map<string, MemoryNote[]>();
  for (const note of store.memory) {
    const list = byTopic.get(note.topic) ?? [];
    list.push(note);
    byTopic.set(note.topic, list);
  }

  const save = (note: MemoryNote) => {
    const text = draft.trim();
    if (text !== "" && text !== note.note) {
      store.updateMemoryNote(note.id, { note: text, updatedAt: new Date().toISOString() });
    }
    setEditing(null);
  };

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">What LifeOS knows about you</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
            Built up from your tasks, grades and reflections over time, and used to tailor what it
            suggests. Correct anything that is wrong — it shapes real advice.
          </p>
        </div>
        <Button
          onClick={() => void reflect()}
          disabled={running || !ready}
          className="shrink-0"
        >
          {running ? "Thinking…" : "Update now"}
        </Button>
      </div>

      {error && <p className="mb-3 text-xs text-[var(--urgent)]">{error}</p>}

      {store.memory.length === 0 ? (
        <Panel className="px-4 py-8 text-center">
          <p className="text-sm text-ink-2">Nothing learned yet.</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-ink-3">
            {ready
              ? "Use “Update now”, or keep logging — it reads through your hub once a day."
              : "Add a few tasks, grades or reflections first. There is nothing to notice yet."}
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4">
          {[...byTopic.entries()].map(([topic, notes]) => (
            <div key={topic}>
              <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">
                {topic}
              </h3>
              <Panel className="divide-y divide-[var(--border)]">
                {notes.map((note) => (
                  <div key={note.id} className="flex items-start gap-2 px-3.5 py-2.5">
                    {editing === note.id ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => save(note)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") save(note);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="flex-1 rounded-md border border-line-strong bg-bg px-2 py-1 text-[13px] outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditing(note.id);
                          setDraft(note.note);
                        }}
                        className="flex-1 text-left text-[13px] leading-relaxed text-ink-2 hover:text-ink"
                      >
                        {note.note}
                      </button>
                    )}

                    <button
                      onClick={() => store.updateMemoryNote(note.id, { pinned: !note.pinned })}
                      aria-pressed={note.pinned}
                      title={note.pinned ? "Unpin — allow this to be revised" : "Pin — never revise this"}
                      aria-label={note.pinned ? "Unpin note" : "Pin note"}
                      className={`mt-px grid size-6 shrink-0 place-items-center rounded-md transition-colors hover:bg-panel-2 ${
                        note.pinned ? "text-accent" : "text-ink-3"
                      }`}
                    >
                      <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
                        <path
                          d="M6 1.5h4l-.5 4 2 2.5H4.5l2-2.5z M8 8v6"
                          fill={note.pinned ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>

                    <button
                      onClick={() => store.deleteMemoryNote(note.id)}
                      aria-label="Forget this"
                      title="Forget this"
                      className="mt-px grid size-6 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel-2 hover:text-[var(--urgent)]"
                    >
                      <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
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
                ))}
              </Panel>
            </div>
          ))}
        </div>
      )}

      {store.reflectedAt && (
        <p className="mt-3 text-[11px] text-ink-3">
          Last updated {formatDate(store.reflectedAt.slice(0, 10))}.
        </p>
      )}
    </section>
  );
}
