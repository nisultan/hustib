"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { AppData, Course, Grade, Task, University, Profile, ID } from "./types";
import { seedData } from "./seed";

const STORAGE_KEY = "iblearner.v1";

/**
 * Local-first data layer.
 *
 * Everything the UI touches goes through this one interface so the storage
 * behind it can change without the pages changing. Swapping to Supabase means
 * reimplementing the mutators as awaited queries (the schema in
 * `supabase/schema.sql` mirrors these shapes) and making the actions async —
 * the components already treat every mutation as fire-and-forget.
 */
export interface Store extends AppData {
  ready: boolean;

  addTask(t: Omit<Task, "id" | "createdAt" | "completedAt">): void;
  updateTask(id: ID, patch: Partial<Task>): void;
  deleteTask(id: ID): void;
  toggleTask(id: ID): void;

  addCourse(c: Omit<Course, "id">): void;
  updateCourse(id: ID, patch: Partial<Course>): void;
  deleteCourse(id: ID): void;

  addGrade(g: Omit<Grade, "id">): void;
  updateGrade(id: ID, patch: Partial<Grade>): void;
  deleteGrade(id: ID): void;

  addUniversity(u: Omit<University, "id">): void;
  updateUniversity(id: ID, patch: Partial<University>): void;
  deleteUniversity(id: ID): void;

  updateProfile(patch: Partial<Profile>): void;

  resetToSample(): void;
  clearAll(): void;
  exportJSON(): string;
}

const StoreContext = createContext<Store | null>(null);

function emptyData(): AppData {
  return { profile: { name: "there" }, courses: [], tasks: [], grades: [], universities: [] };
}

/**
 * A new student starts with an empty hub — this is their platform, not a demo.
 * Sample data is available on request from Settings and from the tour.
 */
function load(): AppData {
  if (typeof window === "undefined") return emptyData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return emptyData();
    const parsed = JSON.parse(raw) as Partial<AppData>;
    // Merge against an empty shape so data saved by an older version that
    // lacked a collection still loads instead of crashing on undefined.
    return {
      ...emptyData(),
      ...parsed,
      profile: { ...emptyData().profile, ...parsed.profile },
    };
  } catch {
    // Corrupt or unreadable storage. Starting empty loses nothing that could
    // have been read anyway, and beats crashing on load.
    return emptyData();
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);

  // Loading in an effect rather than in useState keeps the server render and
  // the first client render identical, avoiding a hydration mismatch.
  useEffect(() => {
    setData(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage full or blocked (private mode). The session still works in
      // memory; there is nothing useful to show the student here.
    }
  }, [data, ready]);

  const mutate = useCallback((fn: (d: AppData) => AppData) => setData(fn), []);

  const store = useMemo<Store>(() => {
    const upsert = <T extends { id: ID }>(list: T[], id: ID, patch: Partial<T>) =>
      list.map((x) => (x.id === id ? { ...x, ...patch } : x));

    return {
      ...data,
      ready,

      addTask: (t) =>
        mutate((d) => ({
          ...d,
          tasks: [
            ...d.tasks,
            { ...t, id: uid(), createdAt: new Date().toISOString(), completedAt: null },
          ],
        })),
      updateTask: (id, patch) => mutate((d) => ({ ...d, tasks: upsert(d.tasks, id, patch) })),
      deleteTask: (id) => mutate((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) })),
      toggleTask: (id) =>
        mutate((d) => ({
          ...d,
          tasks: d.tasks.map((t) => {
            if (t.id !== id) return t;
            const done = t.status === "completed";
            return {
              ...t,
              status: done ? "not_started" : "completed",
              completedAt: done ? null : new Date().toISOString().slice(0, 10),
            };
          }),
        })),

      addCourse: (c) => mutate((d) => ({ ...d, courses: [...d.courses, { ...c, id: uid() }] })),
      updateCourse: (id, patch) =>
        mutate((d) => ({ ...d, courses: upsert(d.courses, id, patch) })),
      // Deleting a course would orphan its tasks and grades, so those go too —
      // matching the ON DELETE CASCADE in the SQL schema.
      deleteCourse: (id) =>
        mutate((d) => ({
          ...d,
          courses: d.courses.filter((c) => c.id !== id),
          tasks: d.tasks.filter((t) => t.courseId !== id),
          grades: d.grades.filter((g) => g.courseId !== id),
        })),

      addGrade: (g) => mutate((d) => ({ ...d, grades: [...d.grades, { ...g, id: uid() }] })),
      updateGrade: (id, patch) =>
        mutate((d) => ({ ...d, grades: upsert(d.grades, id, patch) })),
      deleteGrade: (id) =>
        mutate((d) => ({ ...d, grades: d.grades.filter((g) => g.id !== id) })),

      addUniversity: (u) =>
        mutate((d) => ({ ...d, universities: [...d.universities, { ...u, id: uid() }] })),
      updateUniversity: (id, patch) =>
        mutate((d) => ({ ...d, universities: upsert(d.universities, id, patch) })),
      deleteUniversity: (id) =>
        mutate((d) => ({ ...d, universities: d.universities.filter((u) => u.id !== id) })),

      updateProfile: (patch) => mutate((d) => ({ ...d, profile: { ...d.profile, ...patch } })),

      resetToSample: () => setData(seedData()),
      clearAll: () => setData(emptyData()),
      exportJSON: () => JSON.stringify(data, null, 2),
    };
  }, [data, ready, mutate]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** Course lookup by id, for the many places that render a course name. */
export function useCourseMap(): Map<ID, Course> {
  const { courses } = useStore();
  return useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
