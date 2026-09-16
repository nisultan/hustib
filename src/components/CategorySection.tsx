"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Category } from "@/lib/types";
import { COURSE_COLORS, courseColor } from "@/lib/appearance";
import { Button, Input, Panel } from "./ui";

/**
 * The parts of the student's life, as they name them.
 *
 * Courses already say which subject a task belongs to; this says which part of
 * life it belongs to, which is the split coursework cannot express — a dentist
 * appointment and a swimming session are not schoolwork with a missing course.
 *
 * Deleting one keeps its tasks. Losing a label should never lose the work.
 */
export function CategorySection() {
  const store = useStore();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(COURSE_COLORS[0].id);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const taken = (value: string, exceptId?: string) =>
    store.categories.some(
      (c) => c.id !== exceptId && c.name.toLowerCase() === value.trim().toLowerCase(),
    );

  const add = () => {
    const clean = name.trim();
    if (clean === "" || taken(clean)) return;
    store.addCategory({ name: clean, color });
    setName("");
  };

  const rename = (category: Category) => {
    const clean = draft.trim();
    if (clean !== "" && clean !== category.name && !taken(clean, category.id)) {
      store.updateCategory(category.id, { name: clean });
    }
    setEditing(null);
  };

  const count = (id: string) => store.tasks.filter((t) => t.categoryId === id).length;

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold tracking-tight">Categories</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-2">
          The parts of your life you want tasks split by — school, training, applications,
          whatever fits. A task can have both a category and a course.
        </p>
      </div>

      <Panel className="divide-y divide-[var(--border)]">
        {store.categories.map((category) => (
          <div key={category.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
            <ColorPicker
              value={category.color}
              onChange={(c) => store.updateCategory(category.id, { color: c })}
            />

            {editing === category.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => rename(category)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") rename(category);
                  if (e.key === "Escape") setEditing(null);
                }}
                className="flex-1 rounded-md border border-line-strong bg-bg px-2 py-1 text-[13px] outline-none"
              />
            ) : (
              <button
                onClick={() => {
                  setEditing(category.id);
                  setDraft(category.name);
                }}
                className="flex-1 text-left text-[13px] font-medium hover:text-accent-text"
              >
                {category.name}
              </button>
            )}

            <span className="nums shrink-0 text-[11px] text-ink-3">
              {count(category.id)} {count(category.id) === 1 ? "task" : "tasks"}
            </span>

            <button
              onClick={() => store.deleteCategory(category.id)}
              aria-label={`Delete ${category.name}`}
              title="Delete — the tasks are kept"
              className="grid size-6 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel-2 hover:text-[var(--urgent)]"
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

        <div className="flex items-center gap-2.5 px-3.5 py-2.5">
          <ColorPicker value={color} onChange={setColor} />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="Add a category…"
            className="flex-1"
          />
          <Button onClick={add} disabled={name.trim() === "" || taken(name)}>
            Add
          </Button>
        </div>
      </Panel>

      {name.trim() !== "" && taken(name) && (
        <p className="mt-2 text-xs text-[var(--urgent)]">You already have a “{name.trim()}”.</p>
      )}
    </section>
  );
}

/** The same palette courses use, so the two read as one system. */
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change colour"
        aria-expanded={open}
        className="grid size-6 place-items-center rounded-md transition-colors hover:bg-panel-2"
      >
        <span
          className="size-3 rounded-full"
          style={{ background: courseColor(value) }}
          aria-hidden
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 top-7 z-20 flex gap-1 rounded-lg border border-line bg-panel p-1.5 shadow-[var(--shadow-md)]">
            {COURSE_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
                aria-label={c.label}
                title={c.label}
                className={`size-4 rounded-full transition-transform hover:scale-110 ${
                  c.id === value
                    ? "ring-2 ring-accent ring-offset-1 ring-offset-[var(--panel)]"
                    : ""
                }`}
                style={{ background: c.value }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
