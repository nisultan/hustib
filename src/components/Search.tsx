"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "@/lib/store";
import { formatDate } from "@/lib/dates";
import { useMounted } from "@/lib/useMounted";
import { useModifierKey } from "@/lib/shortcut";
import { backdrop, dialogPanel, springSnappy } from "@/lib/motion";

type Group = "Pages" | "Tasks" | "Notes" | "Courses" | "Grades" | "Universities";

interface Result {
  group: Group;
  title: string;
  detail: string;
  href: string;
  /** Only pages carry their own; everything else is marked by its kind. */
  icon?: string;
}

/**
 * The pages themselves are searchable, and are what an empty box offers.
 *
 * Most of what anyone types into a search box in an app this size is the name
 * of a page they want to be on. Leaving that out made the first two keystrokes
 * of every search produce "Type at least two characters." — a panel that says
 * nothing, on top of the page you were already reading.
 */
const PAGES: { title: string; detail: string; href: string; icon: string }[] = [
  {
    title: "Home",
    detail: "Today, and what is next",
    href: "/",
    icon: "M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1z",
  },
  {
    title: "Plan",
    detail: "The day, hour by hour",
    href: "/plan",
    icon: "M3.5 5h13v11h-13zM3.5 8.5h13M7 3v3M13 3v3",
  },
  {
    title: "School",
    detail: "Grades and averages",
    href: "/school",
    icon: "M3 16V9M8 16V4M13 16v-5M17 16H2",
  },
  {
    title: "Tasks",
    detail: "Everything you have to do",
    href: "/tasks",
    icon: "M7 5h10M7 10h10M7 15h10M3 5h.01M3 10h.01M3 15h.01",
  },
  {
    title: "Courses",
    detail: "Subjects and topics",
    href: "/courses",
    icon: "M4 4h5a2 2 0 0 1 2 2v10a1.5 1.5 0 0 0-1.5-1.5H4zM16 4h-5a2 2 0 0 0-2 2v10",
  },
  {
    title: "Universities",
    detail: "Applications and deadlines",
    href: "/universities",
    icon: "M10 3.5 18 7l-8 3.5L2 7zM5.5 8.8V13c0 1.4 2 2.5 4.5 2.5s4.5-1.1 4.5-2.5V8.8",
  },
  {
    title: "Reflection",
    detail: "The journal",
    href: "/reflection",
    icon: "M5 3.5h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5zM8.5 8h3.5M8.5 11h3.5",
  },
  {
    title: "Weight",
    detail: "The daily log",
    href: "/weight",
    icon: "M4.5 6.5h11l1.2 9a1 1 0 0 1-1 1.1H4.3a1 1 0 0 1-1-1.1zM10 9.5v2.2",
  },
  {
    title: "Recommendations",
    detail: "What to do about it",
    href: "/recommendations",
    icon: "M10 2.5a5 5 0 0 0-3 9v1.5h6V11.5a5 5 0 0 0-3-9zM8.5 16.5h3",
  },
  {
    title: "Settings",
    detail: "Appearance, data, account",
    href: "/settings",
    icon: "M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7",
  },
];

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

  for (const page of PAGES) {
    if (hit(q, page.title)) out.push({ group: "Pages", ...page });
  }

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
        href: `/school?q=${encodeURIComponent(g.assessment)}`,
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

  const order = ["Pages", "Universities", "Tasks", "Notes", "Courses", "Grades"];
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
  const cursorRef = useRef<HTMLButtonElement>(null);
  const mounted = useMounted();
  const modifier = useModifierKey();

  const results = useMemo(() => search(query, data), [query, data]);

  /**
   * What the list shows, which is not always what matched.
   *
   * Under two characters there is nothing to match on, and the old panel said
   * so in a sentence and showed nothing else. The pages are always a valid
   * answer to "where do I want to be", so they are what an empty box offers —
   * the box is useful from the moment it opens.
   */
  const shown = query.trim().length < 2 ? PAGES.map(asPage).slice(0, 6) : results;

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

  // Keep the keyboard cursor on screen. Arrowing past the fold used to move a
  // highlight nobody could see.
  useEffect(() => {
    cursorRef.current?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const go = (r: Result) => {
    setOpen(false);
    setQuery("");
    router.push(r.href);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (shown.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % shown.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(shown[cursor]);
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
        {/* Rendered a frame late rather than guessed — see useModifierKey. */}
        {modifier && (
          <kbd className="hidden rounded border border-line bg-panel-2 px-1.5 py-0.5 text-[10px] font-medium md:block">
            {modifier} K
          </kbd>
        )}
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                variants={backdrop}
                initial="hidden"
                animate="show"
                exit="exit"
                className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh] backdrop-blur-[3px]"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setOpen(false);
                }}
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Search"
                  variants={dialogPanel}
                  className="flex max-h-[76vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-[var(--shadow-lg),var(--edge)]"
                >
                  <div className="flex items-center gap-2.5 border-b border-line px-4">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 20 20"
                      fill="none"
                      aria-hidden
                      className="shrink-0 text-ink-3"
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
                      className="h-[52px] flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
                    />
                    {query !== "" && (
                      <button
                        onClick={() => {
                          setQuery("");
                          inputRef.current?.focus();
                        }}
                        aria-label="Clear search"
                        className="grid size-6 shrink-0 place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
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
                    )}
                  </div>

                  <div className="min-h-[232px] flex-1 overflow-y-auto p-1.5">
                    {shown.length === 0 ? (
                      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                        <p className="text-sm text-ink-2">Nothing matches “{query}”.</p>
                        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-ink-3">
                          Search covers task titles and their notes, course names and topics,
                          grades, and universities.
                        </p>
                      </div>
                    ) : (
                      shown.map((r, i) => {
                        const header = r.group !== lastGroup ? r.group : null;
                        lastGroup = r.group;
                        return (
                          <div key={`${r.href}-${i}`}>
                            {header && (
                              <p className="px-2.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                                {header === "Pages" && query.trim().length < 2
                                  ? "Jump to"
                                  : header}
                              </p>
                            )}
                            <button
                              ref={i === cursor ? cursorRef : undefined}
                              onClick={() => go(r)}
                              onMouseEnter={() => setCursor(i)}
                              className={`flex w-full scroll-mt-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                                i === cursor ? "bg-panel-2" : ""
                              }`}
                            >
                              <GroupIcon group={r.group} path={r.icon} />
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-medium">{r.title}</span>
                                <span className="truncate text-xs text-ink-3">{r.detail}</span>
                              </span>
                              {/* One ↵ badge for the whole list, travelling to
                                  whichever row Enter would open. */}
                              {i === cursor && (
                                <motion.span
                                  layoutId="search-enter"
                                  transition={springSnappy}
                                  className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-3"
                                >
                                  ↵
                                </motion.span>
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* The keys, stated once at the foot. Without this, arrow
                      navigation is a feature only its author knows about. */}
                  <div className="flex items-center gap-3 border-t border-line bg-panel-2/60 px-3 py-2 text-[10px] text-ink-3">
                    <span className="flex items-center gap-1">
                      <Key>↑</Key>
                      <Key>↓</Key>
                      move
                    </span>
                    <span className="flex items-center gap-1">
                      <Key>↵</Key>
                      open
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      <Key>esc</Key>
                      close
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function asPage(page: (typeof PAGES)[number]): Result {
  return { group: "Pages", ...page };
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-panel px-1 py-px font-sans text-[10px] text-ink-2">
      {children}
    </kbd>
  );
}

/**
 * A mark per kind of result.
 *
 * Every row used to be two lines of text, so the only way to tell a task from
 * a university was to read the group header and remember it while scrolling.
 * These are the same glyphs the sidebar uses for the same things.
 */
function GroupIcon({ group, path }: { group: Group; path?: string }) {
  const paths: Record<Group, string> = {
    Pages: "M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1z",
    Tasks: "M7 5h10M7 10h10M7 15h10M3 5h.01M3 10h.01M3 15h.01",
    Notes: "M5 3.5h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5zM8.5 8h3.5M8.5 11h3.5",
    Courses: "M4 4h5a2 2 0 0 1 2 2v10a1.5 1.5 0 0 0-1.5-1.5H4zM16 4h-5a2 2 0 0 0-2 2v10",
    Grades: "M3 16V9M8 16V4M13 16v-5M17 16H2",
    Universities: "M10 3.5 18 7l-8 3.5L2 7zM5.5 8.8V13c0 1.4 2 2.5 4.5 2.5s4.5-1.1 4.5-2.5V8.8",
  };

  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-panel-2 text-ink-3">
      <svg viewBox="0 0 20 20" aria-hidden className="size-4">
        <path
          d={path ?? paths[group]}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
