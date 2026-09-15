"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { formatDate } from "@/lib/dates";
import { useMounted } from "@/lib/useMounted";

interface Result {
  group: "Tasks" | "Notes" | "Courses" | "Grades" | "Universities";
  title: string;
  detail: string;
  href: string;
}

/**
 * Global search across every record type. Matching is a case-insensitive
 * substring over the fields a student would actually recall — titles, course
 * names, and note bodies — with note matches reported separately so "NYU"
 * surfaces both the university and the essay note that mentions it.
 */
function search(query: string, data: ReturnType<typeof useStore>): Result[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const courseName = (id: string | null) =>
    data.courses.find((c) => c.id === id)?.name ?? "No course";
  const out: Result[] = [];

  for (const c of data.courses) {
    if (hit(q, c.name, c.code, ...c.lessons)) {
      out.push({
        group: "Courses",
        title: c.name,
        detail: c.lessons.length > 0 ? c.lessons.join(" · ") : "No topics yet",
        href: `/courses/${c.id}`,
      });
    }
  }

  for (const t of data.tasks) {
    if (hit(q, t.title, t.lesson ?? "")) {
      out.push({
        group: "Tasks",
        title: t.title,
        detail: [courseName(t.courseId), t.dueDate ? formatDate(t.dueDate) : null]
          .filter(Boolean)
          .join(" · "),
        href: `/tasks?q=${encodeURIComponent(t.title)}`,
      });
    } else if (hit(q, t.notes)) {
      out.push({
        group: "Notes",
        title: t.title,
        detail: excerpt(t.notes, q),
        href: `/tasks?q=${encodeURIComponent(t.title)}`,
      });
    }
  }

  for (const g of data.grades) {
    if (hit(q, g.assessment, g.type)) {
      out.push({
        group: "Grades",
        title: `${g.assessment} — ${g.score}%`,
        detail: `${courseName(g.courseId)} · ${formatDate(g.date)}`,
        href: `/grades?q=${encodeURIComponent(g.assessment)}`,
      });
    }
  }

  for (const u of data.universities) {
    if (hit(q, u.name, u.country, u.city, u.program)) {
      out.push({
        group: "Universities",
        title: u.name,
        detail: `${u.city}, ${u.country} · ${u.program}`,
        href: `/universities?q=${encodeURIComponent(u.name)}`,
      });
    } else if (hit(q, u.notes)) {
      out.push({
        group: "Notes",
        title: `${u.name} notes`,
        detail: excerpt(u.notes, q),
        href: `/universities?q=${encodeURIComponent(u.name)}`,
      });
    }
  }

  const order = ["Universities", "Tasks", "Notes", "Courses", "Grades"];
  return out.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group)).slice(0, 12);
}

function hit(q: string, ...fields: string[]): boolean {
  return fields.some((f) => f.toLowerCase().includes(q));
}

/** A window of the note around the match, so the hit is visible in the result. */
function excerpt(text: string, q: string): string {
  const i = text.toLowerCase().indexOf(q);
  if (i === -1) return text.slice(0, 70);
  const start = Math.max(0, i - 25);
  const slice = text.slice(start, start + 80).replace(/\s+/g, " ");
  return `${start > 0 ? "…" : ""}${slice}${start + 80 < text.length ? "…" : ""}`;
}

export function GlobalSearch() {
  const data = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useMounted();

  const results = useMemo(() => search(query, data), [query, data]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        // The input mounts with the dialog, so focus after paint.
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (r: Result) => {
    setOpen(false);
    setQuery("");
    router.push(r.href);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[cursor]);
    }
  };

  let lastGroup = "";

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm text-ink-3 transition-colors hover:border-line-strong md:w-72"
      >
        <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="m13.5 13.5 3 3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        <span className="flex-1 truncate text-left">Search everything</span>
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] font-medium md:block">
          ⌘K
        </kbd>
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 pt-[12vh] backdrop-blur-[2px]"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Search"
              className="fade-up w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-panel shadow-xl"
            >
              <div className="flex items-center gap-2.5 border-b border-line px-4">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden
                  className="text-ink-3"
                >
                  <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
                  <path
                    d="m13.5 13.5 3 3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKey}
                  placeholder="Search tasks, notes, courses, grades, universities…"
                  className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
                />
              </div>

              <div className="max-h-[52vh] overflow-y-auto p-1.5">
                {query.trim().length < 2 ? (
                  <p className="px-3 py-6 text-center text-sm text-ink-3">
                    Type at least two characters.
                  </p>
                ) : results.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-ink-3">
                    Nothing matches “{query}”.
                  </p>
                ) : (
                  results.map((r, i) => {
                    const header = r.group !== lastGroup ? r.group : null;
                    lastGroup = r.group;
                    return (
                      <div key={`${r.href}-${i}`}>
                        {header && (
                          <p className="px-2.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                            {header}
                          </p>
                        )}
                        <button
                          onClick={() => go(r)}
                          onMouseEnter={() => setCursor(i)}
                          className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                            i === cursor ? "bg-panel-2" : ""
                          }`}
                        >
                          <span className="text-sm font-medium">{r.title}</span>
                          <span className="text-xs text-ink-3">{r.detail}</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
