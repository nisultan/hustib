"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "@/lib/store";
import { formatDate, formatTime, relativeLabel, todayISO } from "@/lib/dates";
import { appliesOn } from "@/lib/habits";
import { parseQuickAdd } from "@/lib/quickparse";
import { PRIORITY_LABEL } from "@/lib/types";
import { useMounted } from "@/lib/useMounted";
import { useModifierKey } from "@/lib/shortcut";
import { backdrop, dialogPanel, springSnappy } from "@/lib/motion";

/**
 * Search, and the fastest way to do anything.
 *
 * The old palette searched three kinds of record and, empty, offered a list of
 * pages — useful for getting somewhere, useless for getting something done.
 * This is built like a command bar (Raycast, Linear, Todoist's quick add):
 *
 *  - Empty, it shows what you are most likely to want right now: what is late
 *    or due today, the next block, the habits still open — each tickable
 *    without leaving the box — then the common actions, then the pages.
 *  - Typing searches everything you have written down: tasks and their notes,
 *    the plan, habits, goals, the journal, important days, courses and
 *    categories. Matches at the start of a word rank first, and the matched
 *    letters are marked.
 *  - Whatever you type can also become a task, parsed the way you would say
 *    it ("physics worksheet tomorrow 5pm important"), and a bare number logs a
 *    weigh-in. Adding keeps the box open, so a brain-dump is five Enters.
 */

type Kind =
  | "action"
  | "page"
  | "task"
  | "note"
  | "block"
  | "habit"
  | "goal"
  | "journal"
  | "day"
  | "course"
  | "category";

interface Item {
  key: string;
  kind: Kind;
  section: string;
  title: string;
  detail?: string;
  /** Which part of the title matched, for marking it. */
  query?: string;
  icon: string;
  tone?: string;
  /** Enter. Either somewhere to go or something to do. */
  href?: string;
  run?: () => void;
  /** Ctrl/⌘+Enter, or the circle: tick it without opening it. */
  toggle?: { done: boolean; flip: () => void };
  /** Actions that keep the palette open afterwards (adding several things). */
  stay?: boolean;
  rank: number;
}

const ICON = {
  home: "M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1z",
  plan: "M3.5 5h13v11h-13zM3.5 8.5h13M7 3v3M13 3v3",
  tasks: "M7 5h10M7 10h10M7 15h10M3 5h.01M3 10h.01M3 15h.01",
  courses: "M4 4h5a2 2 0 0 1 2 2v10a1.5 1.5 0 0 0-1.5-1.5H4zM16 4h-5a2 2 0 0 0-2 2v10",
  goals: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  progress: "M3 16V9M8 16V4M13 16v-5M17 16H2",
  journal: "M5 3.5h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5zM8.5 8h3.5M8.5 11h3.5",
  weight: "M4.5 6.5h11l1.2 9a1 1 0 0 1-1 1.1H4.3a1 1 0 0 1-1-1.1zM10 9.5v2.2",
  recs: "M10 2.5a5 5 0 0 0-3 9v1.5h6V11.5a5 5 0 0 0-3-9zM8.5 16.5h3",
  settings: "M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7",
  plus: "M10 4v12M4 10h12",
  flame: "M10 2.5c2.3 2.5 4.2 4.2 4.2 7.1a4.2 4.2 0 0 1-8.4 0c0-1.6.7-2.8 1.7-3.9.3 1 .8 1.7 1.3 2.1C8.6 6 9 4.3 10 2.5z",
  star: "M10 3l2.1 4.3 4.7.7-3.4 3.3.8 4.7L10 13.8 5.8 16l.8-4.7L3.2 8l4.7-.7z",
  hash: "M7.5 3.5 6 16.5M14 3.5l-1.5 13M3.5 7.5h13M3 12.5h13",
};

const PAGES: { title: string; detail: string; href: string; icon: string }[] = [
  { title: "Home", detail: "Today, and what is next", href: "/", icon: ICON.home },
  { title: "Plan", detail: "The day, hour by hour", href: "/plan", icon: ICON.plan },
  { title: "Tasks", detail: "Everything you have to do", href: "/tasks", icon: ICON.tasks },
  { title: "Courses", detail: "Subjects and topics", href: "/courses", icon: ICON.courses },
  { title: "Goals", detail: "What it is all for", href: "/goals", icon: ICON.goals },
  { title: "Progress", detail: "The year, day by day", href: "/progress", icon: ICON.progress },
  { title: "Weight", detail: "The daily log", href: "/weight", icon: ICON.weight },
  { title: "Reflection", detail: "The journal", href: "/reflection", icon: ICON.journal },
  { title: "Recommendations", detail: "What your week says", href: "/recommendations", icon: ICON.recs },
  { title: "Settings", detail: "Appearance, data, account", href: "/settings", icon: ICON.settings },
];

/** 0 for a match at the very start, 1 at the start of a word, 2 anywhere, -1 for none. */
function score(text: string, q: string): number {
  const t = text.toLowerCase();
  const i = t.indexOf(q);
  if (i === -1) return -1;
  if (i === 0) return 0;
  return /[\s\-_/(]/.test(t[i - 1]) ? 1 : 2;
}

function excerpt(text: string, q: string): string {
  const flat = text.replace(/\s+/g, " ");
  const i = flat.toLowerCase().indexOf(q);
  if (i === -1) return flat.slice(0, 80);
  const start = Math.max(0, i - 30);
  return `${start > 0 ? "…" : ""}${flat.slice(start, start + 90)}${start + 90 < flat.length ? "…" : ""}`;
}

export const OPEN_EVENT = "lockedin:search";

/**
 * Opens the search palette from anywhere — the sidebar's Search item.
 *
 * An event rather than a second <GlobalSearch>: each instance listens for
 * Ctrl+K, so two of them would open two palettes on top of each other.
 */
export function openSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function GlobalSearch({ triggerClassName = "" }: { triggerClassName?: string }) {
  const store = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const modifier = useModifierKey();
  const today = todayISO();

  const close = () => {
    setOpen(false);
    setQuery("");
    setFlash(null);
  };

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Item[] = [];
    const courseName = (id: string | null) => store.courses.find((c) => c.id === id)?.name;

    // ---- empty: what you probably want right now ------------------------------
    if (q.length < 2) {
      const open = store.tasks.filter((t) => t.status !== "completed" && t.dueDate != null && t.dueDate <= today);
      for (const t of open.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")).slice(0, 4)) {
        out.push({
          key: `t-${t.id}`,
          kind: "task",
          section: "Today",
          title: t.title,
          detail: [relativeLabel(t.dueDate as string), courseName(t.courseId)].filter(Boolean).join(" · "),
          icon: ICON.tasks,
          tone: t.dueDate! < today ? "var(--urgent)" : undefined,
          href: `/tasks?q=${encodeURIComponent(t.title)}`,
          toggle: { done: false, flip: () => store.toggleTask(t.id) },
          rank: 0,
        });
      }
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const next = store.plan
        .filter((p) => p.date === today && !p.done && p.start != null)
        .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
        .find((p) => toMin(p.start as string) + p.minutes > nowMin);
      if (next) {
        out.push({
          key: `b-${next.id}`,
          kind: "block",
          section: "Today",
          title: next.title || "Untitled",
          detail: `Next up · ${formatTime(next.start as string)}`,
          icon: ICON.plan,
          href: "/plan",
          toggle: { done: next.done, flip: () => store.togglePlanItem(next.id) },
          rank: 0,
        });
      }
      const done = store.days.find((d) => d.date === today)?.habitsDone ?? [];
      for (const h of store.habits.filter((h) => h.archivedAt == null && appliesOn(h, today) && !done.includes(h.id)).slice(0, 3)) {
        out.push({
          key: `h-${h.id}`,
          kind: "habit",
          section: "Today",
          title: h.name,
          detail: "Habit · not ticked yet",
          icon: ICON.flame,
          href: "/plan",
          toggle: { done: false, flip: () => store.toggleHabit(today, h.id) },
          rank: 0,
        });
      }

      out.push(
        { key: "a-task", kind: "action", section: "Actions", title: "New task", detail: "Or just type it here — “essay draft friday important”", icon: ICON.plus, run: () => inputRef.current?.focus(), stay: true, rank: 0 },
        { key: "a-journal", kind: "action", section: "Actions", title: "Write in today’s journal", icon: ICON.journal, href: "/reflection", rank: 0 },
        { key: "a-weight", kind: "action", section: "Actions", title: "Log weight", detail: "Or type the number, e.g. 72.4", icon: ICON.weight, href: "/weight", rank: 0 },
        { key: "a-goal", kind: "action", section: "Actions", title: "New goal", icon: ICON.goals, href: "/goals", rank: 0 },
      );
      for (const p of PAGES.slice(0, 6)) {
        out.push({ key: `p-${p.href}`, kind: "page", section: "Jump to", title: p.title, detail: p.detail, icon: p.icon, href: p.href, rank: 0 });
      }
      return out;
    }

    // ---- typed: things to do with the text --------------------------------------
    const raw = query.trim();
    const kg = raw.match(/^(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg)?$/i);
    if (kg) {
      const w = Number(kg[1].replace(",", "."));
      if (w > 20 && w < 400) {
        out.push({
          key: "a-kg",
          kind: "action",
          section: "Actions",
          title: `Log ${w} kg for today`,
          icon: ICON.weight,
          run: () => {
            store.setDay(today, { weight: w });
            setFlash(`Logged ${w} kg for today`);
            setQuery("");
          },
          stay: true,
          rank: -2,
        });
      }
    }

    if (!kg) {
      const parsed = parseQuickAdd(raw, store.courses);
      const bits = [
        parsed.dueDate ? relativeLabel(parsed.dueDate) : null,
        parsed.dueTime ? formatTime(parsed.dueTime) : null,
        parsed.matched.priority ? PRIORITY_LABEL[parsed.priority] : null,
        parsed.courseId ? courseName(parsed.courseId) : null,
      ].filter(Boolean);
      if (parsed.title.length > 0) {
        out.push({
          key: "a-add",
          kind: "action",
          section: "Actions",
          title: `Add task “${parsed.title}”`,
          detail: bits.length > 0 ? bits.join(" · ") : "No date — add “tomorrow”, “fri 5pm”, “urgent”…",
          icon: ICON.plus,
          tone: "var(--accent)",
          run: () => {
            store.addTask({
              title: parsed.title,
              courseId: parsed.courseId,
              categoryId: null,
              lesson: null,
              dueDate: parsed.dueDate,
              dueTime: parsed.dueDate ? parsed.dueTime : null,
              priority: parsed.priority,
              status: "not_started",
              notes: "",
            });
            setFlash(`Added “${parsed.title}”${bits.length ? ` — ${bits.join(" · ")}` : ""}`);
            setQuery("");
          },
          stay: true,
          rank: -1,
        });
      }
    }

    // ---- typed: everything written down -----------------------------------------
    const push = (item: Omit<Item, "rank" | "query">, s: number) => {
      if (s >= 0) out.push({ ...item, rank: s, query: q });
    };

    for (const p of PAGES) push({ key: `p-${p.href}`, kind: "page", section: "Pages", title: p.title, detail: p.detail, icon: p.icon, href: p.href }, score(p.title, q));

    for (const t of store.tasks) {
      const s = Math.max(score(t.title, q), -1);
      const done = t.status === "completed";
      const detail = [done ? "Done" : t.dueDate ? relativeLabel(t.dueDate) : "No date", courseName(t.courseId), t.lesson].filter(Boolean).join(" · ");
      const base = {
        kind: "task" as const,
        section: "Tasks",
        title: t.title,
        icon: ICON.tasks,
        tone: !done && t.dueDate && t.dueDate < today ? "var(--urgent)" : undefined,
        href: `/tasks?q=${encodeURIComponent(t.title)}`,
        toggle: { done, flip: () => store.toggleTask(t.id) },
      };
      if (s >= 0) push({ ...base, key: `t-${t.id}`, detail }, s + (done ? 3 : 0));
      else if (t.notes && t.notes.toLowerCase().includes(q))
        push({ ...base, key: `n-${t.id}`, kind: "note", section: "Notes", detail: excerpt(t.notes, q) }, 2 + (done ? 3 : 0));
    }

    for (const g of store.goals) push({ key: `g-${g.id}`, kind: "goal", section: "Goals", title: g.title, detail: g.status === "achieved" ? "Achieved" : g.status === "missed" ? "Missed · archived" : g.deadline ? `Due ${formatDate(g.deadline)}` : "Goal", icon: ICON.goals, href: g.status === "missed" ? "/goals/archive" : "/goals" }, Math.max(score(g.title, q), g.note.toLowerCase().includes(q) ? 2 : -1));

    const ticked = store.days.find((d) => d.date === today)?.habitsDone ?? [];
    for (const h of store.habits.filter((h) => h.archivedAt == null)) {
      push({ key: `h-${h.id}`, kind: "habit", section: "Habits", title: h.name, detail: appliesOn(h, today) ? (ticked.includes(h.id) ? "Done today" : "Not ticked today") : "Not due today", icon: ICON.flame, href: "/plan", toggle: appliesOn(h, today) ? { done: ticked.includes(h.id), flip: () => store.toggleHabit(today, h.id) } : undefined }, score(h.name, q));
    }

    for (const p of store.plan.filter((p) => p.date >= today).slice(0, 200)) {
      push({ key: `b-${p.id}`, kind: "block", section: "Plan", title: p.title || "Untitled", detail: `${p.date === today ? "Today" : formatDate(p.date)}${p.start ? ` · ${formatTime(p.start)}` : ""}`, icon: ICON.plan, href: "/plan", toggle: { done: p.done, flip: () => store.togglePlanItem(p.id) } }, score(p.title, q));
    }

    for (const d of store.days) {
      const text = d.reflection.filter((b) => b.type !== "image").map((b) => b.text).join(" ");
      if (text.toLowerCase().includes(q)) {
        push({ key: `j-${d.date}`, kind: "journal", section: "Journal", title: formatDate(d.date), detail: excerpt(text, q), icon: ICON.journal, href: `/reflection?date=${d.date}` }, 2);
      }
    }

    for (const d of store.importantDays) push({ key: `d-${d.id}`, kind: "day", section: "Important days", title: d.title, detail: formatDate(d.date), icon: ICON.star, href: "/plan?view=month" }, score(d.title, q));

    for (const c of store.courses) push({ key: `c-${c.id}`, kind: "course", section: "Courses", title: c.name, detail: c.lessons.join(" · ") || "No topics yet", icon: ICON.courses, href: `/courses/${c.id}` }, Math.max(score(c.name, q), score(c.code, q), c.lessons.some((l) => l.toLowerCase().includes(q)) ? 2 : -1));

    for (const c of store.categories) push({ key: `k-${c.id}`, kind: "category", section: "Categories", title: c.name, detail: "Open its tasks", icon: ICON.hash, href: `/tasks?category=${c.id}` }, score(c.name, q));

    // Actions first, then each section in the order its best match ranks, each
    // section capped so one kind of record cannot bury the rest.
    const actions = out.filter((i) => i.kind === "action");
    const rest = out.filter((i) => i.kind !== "action").sort((a, b) => a.rank - b.rank);
    const sections = [...new Set(rest.map((i) => i.section))];
    return [...actions, ...sections.flatMap((s) => rest.filter((i) => i.section === s).slice(0, 5))];
  }, [query, store, today]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => {
      setOpen(true);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    cursorRef.current?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  const choose = (item: Item) => {
    if (item.run) {
      item.run();
      if (!item.stay) close();
      inputRef.current?.focus();
      return;
    }
    if (item.href) {
      close();
      router.push(item.href);
    }
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[cursor];
      if ((e.metaKey || e.ctrlKey) && item.toggle) item.toggle.flip();
      else choose(item);
    }
  };

  let lastSection = "";

  return (
    <>
      <button
        onClick={() => openSearch()}
        className={`flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm text-ink-3 transition-colors hover:border-line-strong md:w-72 ${triggerClassName}`}
      >
        <SearchGlyph className="size-[15px]" />
        <span className="flex-1 truncate text-left">Search or add…</span>
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
                  if (e.target === e.currentTarget) close();
                }}
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Search"
                  variants={dialogPanel}
                  className="flex max-h-[78vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-[var(--shadow-lg)]"
                >
                  <div className="flex items-center gap-3 border-b border-line px-4">
                    <SearchGlyph className="size-[18px] shrink-0 text-ink-3" />
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={onInputKey}
                      placeholder="Search anything, or type a task to add it…"
                      // `bare`: the global focus ring drew a box around the
                      // input inside a box that is already the search field.
                      className="bare h-[56px] flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
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
                          <path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {flash && (
                    <div className="flex items-center gap-2 border-b border-line bg-[color-mix(in_srgb,var(--up)_10%,transparent)] px-4 py-2 text-[13px] text-[var(--up)]">
                      <svg viewBox="0 0 12 12" aria-hidden className="size-3">
                        <path d="m2.5 6.2 2.3 2.3L9.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate">{flash}</span>
                    </div>
                  )}

                  <div className="min-h-[240px] flex-1 overflow-y-auto p-1.5">
                    {items.length === 0 ? (
                      <div className="px-6 py-14 text-center">
                        <p className="text-[14px] text-ink-2">Nothing matches “{query}”.</p>
                        <p className="mt-1 text-[12.5px] text-ink-3">
                          Searched tasks, notes, plan, habits, goals, journal, important days and courses.
                        </p>
                      </div>
                    ) : (
                      items.map((item, i) => {
                        const header = item.section !== lastSection ? item.section : null;
                        lastSection = item.section;
                        const active = i === cursor;
                        return (
                          <Fragment key={item.key}>
                            {header && (
                              <p className="px-2.5 pb-1 pt-3 text-[12px] font-semibold text-ink-3">{header}</p>
                            )}
                            <div
                              ref={active ? cursorRef : undefined}
                              onMouseEnter={() => setCursor(i)}
                              className={`flex scroll-mt-9 items-center gap-3 rounded-lg px-2.5 py-2 ${active ? "bg-panel-2" : ""}`}
                            >
                              {item.toggle ? (
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={item.toggle.done}
                                  aria-label={`Mark ${item.title} ${item.toggle.done ? "not done" : "done"}`}
                                  onClick={() => item.toggle!.flip()}
                                  className={`grid size-[20px] shrink-0 place-items-center rounded-full border-[1.75px] transition-colors ${
                                    item.toggle.done ? "border-accent bg-accent text-white" : "border-line-strong hover:border-accent"
                                  }`}
                                >
                                  {item.toggle.done && (
                                    <svg viewBox="0 0 12 12" aria-hidden className="size-2.5">
                                      <path d="m2.5 6.2 2.3 2.3L9.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </button>
                              ) : (
                                <span
                                  className="grid size-7 shrink-0 place-items-center rounded-md"
                                  style={{
                                    background: item.tone ? `color-mix(in srgb, ${item.tone} 14%, transparent)` : "var(--panel-2)",
                                    color: item.tone ?? "var(--text-3)",
                                  }}
                                >
                                  <svg viewBox="0 0 20 20" aria-hidden className="size-4">
                                    <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </span>
                              )}
                              <button type="button" onClick={() => choose(item)} className="flex min-w-0 flex-1 flex-col text-left">
                                <span
                                  className={`truncate text-[14px] ${item.kind === "action" ? "font-semibold" : "font-medium"} ${
                                    item.toggle?.done ? "text-ink-3 line-through" : ""
                                  }`}
                                >
                                  <Marked text={item.title} q={item.query} />
                                </span>
                                {item.detail && (
                                  <span className="truncate text-[12px]" style={{ color: item.tone && item.kind === "task" ? item.tone : "var(--text-3)" }}>
                                    {item.detail}
                                  </span>
                                )}
                              </button>
                              {active && (
                                <motion.span
                                  layoutId="search-enter"
                                  transition={springSnappy}
                                  className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-3"
                                >
                                  {item.kind === "action" ? "run" : "open"} ↵
                                </motion.span>
                              )}
                            </div>
                          </Fragment>
                        );
                      })
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line bg-panel-2/60 px-3 py-2 text-[11px] text-ink-3">
                    <span className="flex items-center gap-1"><Key>↑</Key><Key>↓</Key> move</span>
                    <span className="flex items-center gap-1"><Key>↵</Key> open / run</span>
                    <span className="flex items-center gap-1"><Key>{modifier || "Ctrl"}</Key><Key>↵</Key> tick off</span>
                    <span className="ml-auto flex items-center gap-1"><Key>esc</Key> close</span>
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

/** The title with the matched part marked, so you see why it came up. */
function Marked({ text, q }: { text: string; q?: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-accent-soft px-px text-accent-text">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

function SearchGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-panel px-1 py-px font-sans text-[10px] text-ink-2">{children}</kbd>
  );
}

function toMin(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + (m || 0);
}
