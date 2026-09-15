"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { todayISO } from "@/lib/dates";
import { PRIORITIES, PRIORITY_LABEL, Priority, Task } from "@/lib/types";
import { EmptyState, Input, PageHeader, SectionTitle } from "@/components/ui";
import { TaskList } from "@/components/TaskItem";
import { AddTaskButton } from "@/components/TaskDialog";

type View = "all" | "today" | "upcoming" | "completed" | "course" | "priority";

const VIEWS: { id: View; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
  { id: "course", label: "By course" },
  { id: "priority", label: "By priority" },
];

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <TasksInner />
    </Suspense>
  );
}

function TasksInner() {
  const store = useStore();
  const router = useRouter();
  const params = useSearchParams();

  const view = (params.get("view") as View) ?? "all";
  const [query, setQuery] = useState(params.get("q") ?? "");
  const today = todayISO();

  const setView = (v: View) => router.replace(v === "all" ? "/tasks" : `/tasks?view=${v}`);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return store.tasks.filter(
      (t) =>
        q.length === 0 ||
        t.title.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q) ||
        (t.lesson ?? "").toLowerCase().includes(q),
    );
  }, [store.tasks, query]);

  const open = filtered.filter((t) => t.status !== "completed");

  const scoped = useMemo<Task[]>(() => {
    switch (view) {
      case "today":
        return open.filter((t) => t.dueDate != null && t.dueDate <= today);
      case "upcoming":
        return open.filter((t) => t.dueDate != null && t.dueDate > today);
      case "completed":
        return filtered.filter((t) => t.status === "completed");
      default:
        return filtered.filter((t) => t.status !== "completed");
    }
  }, [view, open, filtered, today]);

  const emptyFor = (v: View) => {
    const map: Record<View, string> = {
      all: "No open tasks",
      today: "Nothing due today",
      upcoming: "No future deadlines",
      completed: "Nothing completed yet",
      course: "No tasks yet",
      priority: "No tasks yet",
    };
    return (
      <EmptyState
        title={query.trim().length > 0 ? `Nothing matches “${query}”` : map[v]}
        hint={
          query.trim().length > 0
            ? "Try a shorter search term."
            : "Tasks and notes live together here — capture anything you would otherwise put in a separate app."
        }
        action={query.trim().length === 0 ? <AddTaskButton variant="secondary" /> : undefined}
      />
    );
  };

  // Without this the first paint (store still loading) renders a misleading
  // "No tasks yet" empty state before the saved data arrives.
  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  return (
    <div className="fade-up">
      <PageHeader
        title="Tasks & Notes"
        subtitle="Everything you need to do, with the notes attached to it."
        action={<AddTaskButton />}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Task views"
          className="flex flex-wrap gap-1 rounded-lg border border-line bg-panel p-1"
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={`rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                view === v.id
                  ? "bg-accent-soft text-accent-text"
                  : "text-ink-2 hover:bg-panel-2 hover:text-ink"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter tasks…"
          className="h-9 w-full sm:w-52"
        />
      </div>

      {view === "course" ? (
        <GroupedByCourse
          tasks={filtered.filter((t) => t.status !== "completed")}
          empty={emptyFor("course")}
        />
      ) : view === "priority" ? (
        <GroupedByPriority
          tasks={filtered.filter((t) => t.status !== "completed")}
          empty={emptyFor("priority")}
        />
      ) : (
        <TaskList tasks={scoped} empty={emptyFor(view)} />
      )}
    </div>
  );
}

function GroupedByCourse({ tasks, empty }: { tasks: Task[]; empty: React.ReactNode }) {
  const store = useStore();
  const groups = store.courses
    .map((c) => ({ key: c.id, label: c.name, items: tasks.filter((t) => t.courseId === c.id) }))
    .concat([
      { key: "none", label: "No course", items: tasks.filter((t) => t.courseId == null) },
    ])
    .filter((g) => g.items.length > 0);

  if (groups.length === 0) return <>{empty}</>;

  return (
    <div className="grid gap-6">
      {groups.map((g) => (
        <section key={g.key}>
          <SectionTitle right={<span className="text-xs text-ink-3">{g.items.length}</span>}>
            {g.label}
          </SectionTitle>
          <TaskList tasks={g.items} showCourse={false} />
        </section>
      ))}
    </div>
  );
}

function GroupedByPriority({ tasks, empty }: { tasks: Task[]; empty: React.ReactNode }) {
  const groups = PRIORITIES.map((p: Priority) => ({
    key: p,
    label: PRIORITY_LABEL[p],
    items: tasks.filter((t) => t.priority === p),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) return <>{empty}</>;

  return (
    <div className="grid gap-6">
      {groups.map((g) => (
        <section key={g.key}>
          <SectionTitle right={<span className="text-xs text-ink-3">{g.items.length}</span>}>
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block size-1.5 rounded-full"
                style={{ background: `var(--${g.key})` }}
              />
              {g.label}
            </span>
          </SectionTitle>
          <TaskList tasks={g.items} />
        </section>
      ))}
    </div>
  );
}
