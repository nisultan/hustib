"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  AppData,
  Category,
  Course,
  Goal,
  GoalStatus,
  ImportantDay,
  Habit,
  PlanItem,
  Day,
  Grade,
  Insight,
  MemoryNote,
  Task,
  University,
  Profile,
  ID,
} from "./types";
import { seedData } from "./seed";
import { todayISO } from "./dates";
import { isSupabaseConfigured } from "./supabase/client";
import * as repo from "./supabase/repository";
import {
  PASSWORD_CHOICE_KEY,
  PLAIN_KEY,
  VAULT_KEY,
  createKey,
  decrypt,
  encrypt,
  hasVault,
  keyForVault,
  readVault,
} from "./vault";

const STORAGE_KEY = PLAIN_KEY;

/**
 * Where the provider is in the load sequence.
 *
 * "locked" means encrypted data exists on this device and we are waiting for
 * the password; nothing is in memory yet. "ready" is the only state in which
 * pages render real data.
 */
export type LockState = "loading" | "locked" | "ready";

/**
 * Which storage the hub is talking to.
 *
 * Decided once, by whether the Supabase keys are present at build time. Local
 * mode is the original device-password build and still works with no backend
 * at all; cloud mode puts every row behind an account.
 */
export type Backend = "local" | "cloud";

/** Only meaningful in cloud mode; local mode reports "signed-out" forever. */
export type AuthState = "loading" | "signed-out" | "signed-in";

export interface AuthUser {
  id: string;
  email: string | null;
}

/**
 * Data layer for the hub.
 *
 * Everything the UI touches goes through this one interface so the storage
 * behind it can change without the pages changing. Both backends present the
 * same synchronous read model and the same fire-and-forget mutators — the
 * cloud one just also sends the change to Postgres and surfaces a failure
 * through `syncError` rather than throwing into a component.
 */
export interface Store extends AppData {
  ready: boolean;
  lockState: LockState;
  /** True when this device's data is encrypted behind a password. */
  hasPassword: boolean;
  /** Whether we have already asked the student to choose a password. */
  passwordAsked: boolean;

  backend: Backend;
  authState: AuthState;
  user: AuthUser | null;
  /** A write that did not reach the server, for the UI to surface. */
  syncError: string | null;
  clearSyncError(): void;

  /** Throws with a readable message so the form can show it. */
  signIn(email: string, password: string): Promise<void>;
  /** Resolves true when the account still needs an emailed confirmation. */
  signUp(email: string, password: string, name: string): Promise<boolean>;
  signOut(): Promise<void>;

  addTask(t: Omit<Task, "id" | "createdAt" | "completedAt">): void;
  updateTask(id: ID, patch: Partial<Task>): void;
  deleteTask(id: ID): void;
  toggleTask(id: ID): void;

  addPlanItem(p: Omit<PlanItem, "id">): void;
  updatePlanItem(id: ID, patch: Partial<PlanItem>): void;
  deletePlanItem(id: ID): void;
  /** Ticking a block that stands for a task finishes the task too. */
  togglePlanItem(id: ID): void;

  addGoal(g: Omit<Goal, "id" | "createdAt" | "achievedAt" | "position">): void;
  updateGoal(id: ID, patch: Partial<Goal>): void;
  deleteGoal(id: ID): void;
  /** Marking one achieved stamps the date, so "since when" survives. */
  setGoalStatus(id: ID, status: GoalStatus): void;

  addImportantDay(d: Omit<ImportantDay, "id" | "createdAt">): void;
  updateImportantDay(id: ID, patch: Partial<ImportantDay>): void;
  deleteImportantDay(id: ID): void;

  addHabit(h: Omit<Habit, "id" | "createdAt" | "archivedAt">): void;
  updateHabit(id: ID, patch: Partial<Habit>): void;
  /** Archives rather than deletes, so past completions stay honest. */
  archiveHabit(id: ID): void;
  toggleHabit(date: string, habitId: ID): void;

  addCategory(c: Omit<Category, "id">): void;
  updateCategory(id: ID, patch: Partial<Category>): void;
  /** Tasks in the category are kept and simply lose it. */
  deleteCategory(id: ID): void;

  addCourse(c: Omit<Course, "id">): void;
  updateCourse(id: ID, patch: Partial<Course>): void;
  deleteCourse(id: ID): void;

  addGrade(g: Omit<Grade, "id">): void;
  updateGrade(id: ID, patch: Partial<Grade>): void;
  deleteGrade(id: ID): void;

  addUniversity(u: Omit<University, "id">): void;
  updateUniversity(id: ID, patch: Partial<University>): void;
  deleteUniversity(id: ID): void;

  /**
   * Creates or edits the entry for a date.
   *
   * One upsert rather than add/update, because the journal never asks whether
   * a day exists — you type into 15 September and it either was there or it
   * is now.
   */
  setDay(date: string, patch: Partial<Omit<Day, "date">>): void;
  deleteDay(date: string): void;

  updateProfile(patch: Partial<Profile>): void;

  /**
   * Replaces what the hub believes about the student.
   *
   * A whole-list write rather than per-note edits: a reflection pass revises
   * several notes and drops others at once, and applying that as a stream of
   * individual mutations would leave the UI showing a half-updated portrait.
   * Pinned notes are the student's, and are preserved by the caller.
   */
  setMemory(notes: MemoryNote[]): void;
  updateMemoryNote(id: ID, patch: Partial<MemoryNote>): void;
  deleteMemoryNote(id: ID): void;

  addInsights(insights: Omit<Insight, "id">[]): void;
  dismissInsight(id: ID): void;
  restoreInsight(id: ID): void;
  clearInsights(): void;

  /** Records that a reflection pass just finished. */
  markReflected(at: string): void;

  resetToSample(): void;
  clearAll(): void;
  exportJSON(): string;

  /** Decrypts and opens the hub. False means the password was wrong. */
  unlock(password: string): Promise<boolean>;
  /** Encrypts everything on this device from here on. */
  setPassword(password: string): Promise<void>;
  /** Requires the current password. False means it was wrong. */
  changePassword(current: string, next: string): Promise<boolean>;
  /** Requires the current password. False means it was wrong. */
  removePassword(current: string): Promise<boolean>;
  /** Records that the student declined a password, so we stop asking. */
  declinePassword(): void;
  /** Re-locks without reloading, dropping the key from memory. */
  lock(): void;
  /** Last resort for a forgotten password: erase the vault and start over. */
  eraseVault(): void;
}

const StoreContext = createContext<Store | null>(null);

/**
 * What a new hub starts with.
 *
 * Two, not five: the point of custom categories is that the student names the
 * parts of their own life, and arriving at a pre-sorted list of someone else's
 * guesses is the thing that makes people leave the defaults alone forever.
 * These two are the split everyone has, and both are renameable.
 */
const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-school", name: "School", color: "violet" },
  { id: "cat-personal", name: "Personal", color: "green" },
];

/**
 * Brings a hub saved before categories existed up to date.
 *
 * Seeds the defaults, and files existing coursework under School — a task
 * attached to a school course is schoolwork, so inferring that is safe and
 * saves tagging a term's work by hand. Nothing is overwritten: only tasks with
 * no category at all are touched, and only when the categories are the seeded
 * ones, so a student who has already organised things is left alone.
 */
function adoptCategories(data: AppData): AppData {
  if (data.categories.length > 0) return data;

  const school = DEFAULT_CATEGORIES[0];
  return {
    ...data,
    categories: DEFAULT_CATEGORIES,
    tasks: data.tasks.map((t) =>
      t.categoryId == null && t.courseId != null ? { ...t, categoryId: school.id } : t,
    ),
  };
}

function emptyData(): AppData {
  return {
    profile: { name: "there" },
    categories: DEFAULT_CATEGORIES,
    courses: [],
    tasks: [],
    grades: [],
    universities: [],
    days: [],
    plan: [],
    habits: [],
    goals: [],
    importantDays: [],
    memory: [],
    insights: [],
    reflectedAt: null,
  };
}

function isEmpty(d: AppData): boolean {
  return (
    d.courses.length === 0 &&
    d.tasks.length === 0 &&
    d.grades.length === 0 &&
    d.universities.length === 0 &&
    d.days.length === 0
  );
}

/**
 * A new student starts with an empty hub — this is their platform, not a demo.
 * Sample data is available on request from Settings and from the tour.
 */
function parseData(raw: string | null): AppData {
  if (raw == null) return emptyData();
  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;
    // Merge against an empty shape so data saved by an older version that
    // lacked a collection still loads instead of crashing on undefined.
    return adoptCategories({
      ...emptyData(),
      ...parsed,
      profile: { ...emptyData().profile, ...parsed.profile },
      // Saved before categories existed: the field is absent rather than null.
      tasks: (parsed.tasks ?? []).map((t) => ({ ...t, categoryId: t.categoryId ?? null })),
      categories: parsed.categories ?? [],
      plan: parsed.plan ?? [],
      habits: parsed.habits ?? [],
      goals: parsed.goals ?? [],
      importantDays: parsed.importantDays ?? [],
      // Saved before habits existed: the field is absent rather than empty.
      days: (parsed.days ?? []).map((d) => ({ ...d, habitsDone: d.habitsDone ?? [] })),
    });
  } catch {
    // Corrupt or unreadable storage. Starting empty loses nothing that could
    // have been read anyway, and beats crashing on load.
    return emptyData();
  }
}

function loadPlain(): AppData {
  if (typeof window === "undefined") return emptyData();
  try {
    return parseData(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyData();
  }
}

/**
 * A readable reason for the sync banner.
 *
 * Supabase rejections are plain `PostgrestError` objects, not `Error`
 * instances, so the obvious `String(e)` renders them as "[object Object]" —
 * a banner that tells the student something broke and nothing else, and tells
 * whoever has to debug it even less. The message and code are both worth
 * showing: the code is what makes a missing migration identifiable.
 */
function message(e: unknown): string {
  if (e instanceof Error) return e.message;

  if (e !== null && typeof e === "object") {
    const { message: m, code, details, hint } = e as Record<string, unknown>;
    const text = [m, details, hint].find((v) => typeof v === "string" && v.trim() !== "");
    if (typeof text === "string") {
      return typeof code === "string" && code !== "" ? `${text} (${code})` : text;
    }
    try {
      return JSON.stringify(e);
    } catch {
      return "Unknown error";
    }
  }

  return String(e);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  // Fixed for the life of the page: the keys are compiled in, so this cannot
  // change between renders and never needs to be state.
  const cloud = isSupabaseConfigured();

  const [data, setData] = useState<AppData>(emptyData);
  const [lockState, setLockState] = useState<LockState>("loading");
  const [hasPassword, setHasPassword] = useState(false);
  const [passwordAsked, setPasswordAsked] = useState(true);

  const [authState, setAuthState] = useState<AuthState>(cloud ? "loading" : "signed-out");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // The derived key and its salt, held only in memory. Losing them on reload
  // is the point: the password has to be re-entered to get back in.
  const cryptoRef = useRef<{ key: CryptoKey; salt: string } | null>(null);

  const ready = lockState === "ready";

  /* ---------------------------------------------------------------------- */
  /* Load                                                                   */
  /* ---------------------------------------------------------------------- */

  // Loading in an effect rather than in useState keeps the server render and
  // the first client render identical, avoiding a hydration mismatch.
  useEffect(() => {
    if (cloud) return;

    let asked = true;
    try {
      asked = localStorage.getItem(PASSWORD_CHOICE_KEY) != null;
    } catch {
      // Storage blocked; treat it as already asked so we do not nag.
    }
    setPasswordAsked(asked);

    if (hasVault()) {
      setHasPassword(true);
      setLockState("locked");
      return;
    }

    setData(loadPlain());
    setLockState("ready");
  }, [cloud]);

  /**
   * Cloud mode: follow the session.
   *
   * supabase-js restores a saved session from storage before firing its first
   * event, so a returning student is signed in without touching the form —
   * and the same subscription catches the silent token refresh that keeps
   * that true for as long as the refresh token lives.
   */
  useEffect(() => {
    if (!cloud) return;

    let live = true;

    const apply = (u: { id: string; email?: string | null } | null) => {
      if (!live) return;
      if (u) {
        setUser({ id: u.id, email: u.email ?? null });
        setAuthState("signed-in");
      } else {
        setUser(null);
        setAuthState("signed-out");
        setData(emptyData());
        setLockState("loading");
      }
    };

    void repo
      .currentSession()
      .then((session) => apply(session?.user ?? null))
      .catch(() => apply(null));

    const unsubscribe = repo.onAuthChange(apply);

    return () => {
      live = false;
      unsubscribe();
    };
  }, [cloud]);

  /** Pull the account's rows once signed in, migrating a local hub on first run. */
  useEffect(() => {
    if (!cloud || authState !== "signed-in" || user == null) return;

    let live = true;

    void (async () => {
      try {
        let remote = await repo.fetchAll();

        // First sign-in on a device that was used offline: carry that work up
        // rather than stranding it. Only when the account is still untouched,
        // so a second device cannot duplicate rows it already synced.
        if (isEmpty(remote)) {
          const local = loadPlain();
          if (!isEmpty(local)) {
            await repo.migrateLocalData(local);
            remote = await repo.fetchAll();
          }
        }

        if (!live) return;
        setData(remote);
        setLockState("ready");
      } catch (e) {
        if (!live) return;
        setSyncError(message(e));
        setLockState("ready");
      }
    })();

    return () => {
      live = false;
    };
  }, [cloud, authState, user]);

  /* ---------------------------------------------------------------------- */
  /* Persist (local mode only)                                              */
  /* ---------------------------------------------------------------------- */

  // Persisting is async once a password is set, so writes are sequenced
  // through a ref: a fast edit must never let an older blob land last and
  // overwrite a newer one.
  const writeSeq = useRef(0);

  useEffect(() => {
    if (cloud || lockState !== "ready") return;

    const serialised = JSON.stringify(data);
    const vaultKey = cryptoRef.current;
    const seq = ++writeSeq.current;

    if (vaultKey == null) {
      try {
        localStorage.setItem(STORAGE_KEY, serialised);
      } catch {
        // Storage full or blocked (private mode). The session still works in
        // memory; there is nothing useful to show the student here.
      }
      return;
    }

    void encrypt(vaultKey.key, vaultKey.salt, serialised)
      .then((blob) => {
        if (seq !== writeSeq.current) return; // A newer write already landed.
        localStorage.setItem(VAULT_KEY, JSON.stringify(blob));
      })
      .catch(() => {
        // Encryption or storage failed. Better to keep the last good
        // ciphertext than to write something unreadable over it.
      });
  }, [cloud, data, lockState]);

  /**
   * The current data, readable synchronously — including between a mutation
   * and the render that follows it.
   *
   * Mutators that read before they write cannot use `data` from the render
   * closure: two clicks inside one frame both see the state as it was before
   * either, and the second silently overwrites the first. Ticking two habits
   * quickly lost one of them, which is exactly the kind of bug that makes
   * someone stop trusting a tracker.
   *
   * `mutate` therefore advances this ref itself, before React has re-rendered,
   * so a second call in the same frame reads the result of the first.
   */
  const latest = useRef(data);
  // Keeps the ref honest when data arrives from somewhere other than a
  // mutation — the initial load, a cloud fetch, a reset.
  latest.current = data;

  const mutate = useCallback((fn: (d: AppData) => AppData) => {
    latest.current = fn(latest.current);
    setData(latest.current);
  }, []);

  /**
   * Sends a write to the server behind a fire-and-forget mutator.
   *
   * Local state has already moved by the time this runs, so a failure leaves
   * the screen ahead of the database. Surfacing it beats silently diverging —
   * the banner tells the student to reload.
   */
  const push = useCallback((work: Promise<unknown>) => {
    void work.catch((e) => setSyncError(message(e)));
  }, []);

  const store = useMemo<Store>(() => {
    const upsert = <T extends { id: ID }>(list: T[], id: ID, patch: Partial<T>) =>
      list.map((x) => (x.id === id ? { ...x, ...patch } : x));

    return {
      ...data,
      ready,
      backend: cloud ? "cloud" : "local",
      authState,
      user,
      syncError,
      clearSyncError: () => setSyncError(null),

      signIn: async (email, password) => {
        await repo.signIn(email, password);
      },

      signUp: async (email, password, name) => {
        const result = await repo.signUp(email, password, name);
        // With email confirmation on, Supabase returns a user but no session.
        // The caller shows "check your inbox" rather than a blank hub.
        return result.session == null;
      },

      signOut: async () => {
        await repo.signOut();
      },

      addTask: (t) => {
        if (cloud) {
          // The id is assigned by Postgres, so the row is appended once it
          // comes back rather than invented here and reconciled later.
          push(
            repo
              .createTask(t)
              .then((task) => mutate((d) => ({ ...d, tasks: [...d.tasks, task] }))),
          );
          return;
        }
        mutate((d) => ({
          ...d,
          tasks: [
            ...d.tasks,
            { ...t, id: uid(), createdAt: new Date().toISOString(), completedAt: null },
          ],
        }));
      },
      updateTask: (id, patch) => {
        mutate((d) => ({ ...d, tasks: upsert(d.tasks, id, patch) }));
        if (cloud) push(repo.updateTask(id, patch));
      },
      deleteTask: (id) => {
        mutate((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
        if (cloud) push(repo.deleteTask(id));
      },
      toggleTask: (id) => {
        const current = data.tasks.find((t) => t.id === id);
        if (!current) return;
        const done = current.status === "completed";
        const patch: Partial<Task> = {
          status: done ? "not_started" : "completed",
          completedAt: done ? null : new Date().toISOString().slice(0, 10),
        };
        mutate((d) => ({ ...d, tasks: upsert(d.tasks, id, patch) }));
        if (cloud) push(repo.updateTask(id, patch));
      },

      addPlanItem: (item) => {
        // On cloud the id is Postgres's to assign. Inventing one here and
        // inserting anyway leaves the screen holding an id the database has
        // never seen, and the next edit to that row fails as a malformed uuid.
        if (cloud) {
          push(
            repo.createPlanItem(item).then((created) => {
              if (created) mutate((d) => ({ ...d, plan: [...d.plan, created] }));
            }),
          );
          return;
        }
        mutate((d) => ({ ...d, plan: [...d.plan, { ...item, id: uid() }] }));
      },
      updatePlanItem: (id, patch) => {
        mutate((d) => ({ ...d, plan: upsert(d.plan, id, patch) }));
        if (cloud) push(repo.updatePlanItem(id, patch));
      },
      deletePlanItem: (id) => {
        mutate((d) => ({ ...d, plan: d.plan.filter((p) => p.id !== id) }));
        if (cloud) push(repo.deletePlanItem(id));
      },
      togglePlanItem: (id) => {
        const item = latest.current.plan.find((p) => p.id === id);
        if (!item) return;
        const done = !item.done;

        mutate((d) => ({ ...d, plan: upsert(d.plan, id, { done }) }));
        if (cloud) push(repo.updatePlanItem(id, { done }));

        // Finishing the block finishes the work it stood for. Unticking does
        // not reopen the task: deciding a block was not really done says
        // nothing about whether the essay is still finished.
        const task = item.taskId
          ? latest.current.tasks.find((t) => t.id === item.taskId)
          : null;
        if (done && task && task.status !== "completed") {
          const completedAt = todayISO();
          mutate((d) => ({
            ...d,
            tasks: upsert(d.tasks, task.id, { status: "completed", completedAt }),
          }));
          if (cloud) push(repo.updateTask(task.id, { status: "completed", completedAt }));
        }
      },

      addGoal: (g) => {
        const base = {
          ...g,
          createdAt: todayISO(),
          achievedAt: null,
          // New goals go to the top: the thing just written down is the thing
          // on someone's mind.
          position: Math.min(0, ...latest.current.goals.map((x) => x.position)) - 1,
        };
        if (cloud) {
          push(
            repo.createGoal(base).then((created) => {
              if (created) mutate((d) => ({ ...d, goals: [created, ...d.goals] }));
            }),
          );
          return;
        }
        mutate((d) => ({ ...d, goals: [{ ...base, id: uid() }, ...d.goals] }));
      },
      updateGoal: (id, patch) => {
        mutate((d) => ({ ...d, goals: upsert(d.goals, id, patch) }));
        if (cloud) push(repo.updateGoal(id, patch));
      },
      deleteGoal: (id) => {
        mutate((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }));
        if (cloud) push(repo.deleteGoal(id));
      },
      setGoalStatus: (id, status) => {
        const achievedAt = status === "achieved" ? todayISO() : null;
        mutate((d) => ({ ...d, goals: upsert(d.goals, id, { status, achievedAt }) }));
        if (cloud) push(repo.updateGoal(id, { status, achievedAt }));
      },

      addImportantDay: (d) => {
        const base = { ...d, createdAt: todayISO() };
        if (cloud) {
          push(
            repo.createImportantDay(base).then((created) => {
              if (created)
                mutate((data) => ({
                  ...data,
                  importantDays: [...data.importantDays, created],
                }));
            }),
          );
          return;
        }
        mutate((data) => ({
          ...data,
          importantDays: [...data.importantDays, { ...base, id: uid() }],
        }));
      },
      updateImportantDay: (id, patch) => {
        mutate((d) => ({ ...d, importantDays: upsert(d.importantDays, id, patch) }));
        if (cloud) push(repo.updateImportantDay(id, patch));
      },
      deleteImportantDay: (id) => {
        mutate((d) => ({ ...d, importantDays: d.importantDays.filter((x) => x.id !== id) }));
        if (cloud) push(repo.deleteImportantDay(id));
      },

      addHabit: (h) => {
        const base = { ...h, createdAt: todayISO(), archivedAt: null };
        if (cloud) {
          push(
            repo.createHabit(base).then((created) => {
              if (created) mutate((d) => ({ ...d, habits: [...d.habits, created] }));
            }),
          );
          return;
        }
        mutate((d) => ({ ...d, habits: [...d.habits, { ...base, id: uid() }] }));
      },
      updateHabit: (id, patch) => {
        mutate((d) => ({ ...d, habits: upsert(d.habits, id, patch) }));
        if (cloud) push(repo.updateHabit(id, patch));
      },
      archiveHabit: (id) => {
        const archivedAt = todayISO();
        mutate((d) => ({ ...d, habits: upsert(d.habits, id, { archivedAt }) }));
        if (cloud) push(repo.updateHabit(id, { archivedAt }));
      },
      toggleHabit: (date, habitId) => {
        const existing = latest.current.days.find((x) => x.date === date);
        const current = existing?.habitsDone ?? [];
        const habitsDone = current.includes(habitId)
          ? current.filter((h) => h !== habitId)
          : [...current, habitId];

        mutate((d) => {
          const day: Day = existing
            ? { ...existing, habitsDone }
            : { date, weight: null, reflection: [], habitsDone };
          return {
            ...d,
            days: existing ? d.days.map((x) => (x.date === date ? day : x)) : [day, ...d.days],
          };
        });
        if (cloud) push(repo.upsertDay(date, { habitsDone }));
      },

      addCategory: (c) => {
        if (cloud) {
          push(
            repo.createCategory(c).then((created) => {
              if (created) mutate((d) => ({ ...d, categories: [...d.categories, created] }));
            }),
          );
          return;
        }
        mutate((d) => ({ ...d, categories: [...d.categories, { ...c, id: uid() }] }));
      },
      updateCategory: (id, patch) => {
        mutate((d) => ({ ...d, categories: upsert(d.categories, id, patch) }));
        if (cloud) push(repo.updateCategory(id, patch));
      },
      deleteCategory: (id) => {
        // The tasks outlive the category. Losing a label should never lose
        // the work filed under it.
        mutate((d) => ({
          ...d,
          categories: d.categories.filter((c) => c.id !== id),
          tasks: d.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
        }));
        if (cloud) push(repo.deleteCategory(id));
      },

      addCourse: (c) => {
        if (cloud) {
          push(
            repo
              .createCourse(c)
              .then((course) => mutate((d) => ({ ...d, courses: [...d.courses, course] }))),
          );
          return;
        }
        mutate((d) => ({ ...d, courses: [...d.courses, { ...c, id: uid() }] }));
      },
      updateCourse: (id, patch) => {
        mutate((d) => ({ ...d, courses: upsert(d.courses, id, patch) }));
        if (cloud) push(repo.updateCourse(id, patch));
      },
      // Deleting a course would orphan its tasks and grades, so those go too —
      // matching the ON DELETE CASCADE in the SQL schema.
      deleteCourse: (id) => {
        mutate((d) => ({
          ...d,
          courses: d.courses.filter((c) => c.id !== id),
          tasks: d.tasks.filter((t) => t.courseId !== id),
          grades: d.grades.filter((g) => g.courseId !== id),
        }));
        if (cloud) push(repo.deleteCourse(id));
      },

      addGrade: (g) => {
        if (cloud) {
          push(
            repo
              .createGrade(g)
              .then((grade) => mutate((d) => ({ ...d, grades: [...d.grades, grade] }))),
          );
          return;
        }
        mutate((d) => ({ ...d, grades: [...d.grades, { ...g, id: uid() }] }));
      },
      updateGrade: (id, patch) => {
        mutate((d) => ({ ...d, grades: upsert(d.grades, id, patch) }));
        if (cloud) push(repo.updateGrade(id, patch));
      },
      deleteGrade: (id) => {
        mutate((d) => ({ ...d, grades: d.grades.filter((g) => g.id !== id) }));
        if (cloud) push(repo.deleteGrade(id));
      },

      addUniversity: (u) => {
        if (cloud) {
          push(
            repo
              .createUniversity(u)
              .then((uni) => mutate((d) => ({ ...d, universities: [...d.universities, uni] }))),
          );
          return;
        }
        mutate((d) => ({ ...d, universities: [...d.universities, { ...u, id: uid() }] }));
      },
      updateUniversity: (id, patch) => {
        mutate((d) => ({ ...d, universities: upsert(d.universities, id, patch) }));
        if (cloud) push(repo.updateUniversity(id, patch));
      },
      deleteUniversity: (id) => {
        mutate((d) => ({ ...d, universities: d.universities.filter((u) => u.id !== id) }));
        if (cloud) push(repo.deleteUniversity(id));
      },

      setDay: (date, patch) => {
        mutate((d) => {
          const existing = d.days.find((x) => x.date === date);
          const next: Day = existing
            ? { ...existing, ...patch }
            : { date, weight: null, reflection: [], habitsDone: [], ...patch };
          const days = existing
            ? d.days.map((x) => (x.date === date ? next : x))
            : [...d.days, next];
          // Newest first, which is the order the journal reads in.
          days.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
          return { ...d, days };
        });
        if (cloud) push(repo.upsertDay(date, patch));
      },
      deleteDay: (date) => {
        mutate((d) => ({ ...d, days: d.days.filter((x) => x.date !== date) }));
        if (cloud) push(repo.deleteDay(date));
      },

      updateProfile: (patch) => {
        mutate((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
        if (cloud && patch.name !== undefined) push(repo.updateProfileName(patch.name));
      },

      setMemory: (notes) => {
        const before = latest.current.memory;
        mutate((d) => ({ ...d, memory: notes }));
        if (!cloud) return;

        // Diffed against what was there so the cloud sees the same three
        // operations the local list just went through, rather than a delete
        // and re-insert that would churn every id the student has pinned.
        const kept = new Set(notes.map((n) => n.id));
        for (const old of before) {
          if (!kept.has(old.id)) push(repo.deleteMemory(old.id));
        }
        for (const note of notes) {
          const previous = before.find((n) => n.id === note.id);
          if (!previous) {
            // Replaces the locally-invented id with the one Postgres assigned,
            // or the next edit to this note fails as a malformed uuid.
            push(
              repo.createMemory(note).then((created) => {
                if (created?.id) {
                  mutate((d) => ({
                    ...d,
                    memory: d.memory.map((n) =>
                      n.id === note.id ? { ...n, id: created.id } : n,
                    ),
                  }));
                }
              }),
            );
          } else if (previous.note !== note.note || previous.topic !== note.topic) {
            push(repo.updateMemory(note.id, note));
          }
        }
      },

      updateMemoryNote: (id, patch) => {
        mutate((d) => ({ ...d, memory: upsert(d.memory, id, patch) }));
        if (cloud) push(repo.updateMemory(id, patch));
      },

      deleteMemoryNote: (id) => {
        mutate((d) => ({ ...d, memory: d.memory.filter((n) => n.id !== id) }));
        if (cloud) push(repo.deleteMemory(id));
      },

      addInsights: (incoming) => {
        if (cloud) {
          for (const i of incoming) {
            push(
              repo.createInsight(i).then((created) => {
                if (created) mutate((d) => ({ ...d, insights: [created, ...d.insights] }));
              }),
            );
          }
          return;
        }
        mutate((d) => ({
          ...d,
          insights: [...incoming.map((i) => ({ ...i, id: uid() })), ...d.insights],
        }));
      },

      dismissInsight: (id) => {
        const at = new Date().toISOString();
        mutate((d) => ({ ...d, insights: upsert(d.insights, id, { dismissedAt: at }) }));
        if (cloud) push(repo.dismissInsight(id, at));
      },

      restoreInsight: (id) => {
        mutate((d) => ({ ...d, insights: upsert(d.insights, id, { dismissedAt: null }) }));
        if (cloud) push(repo.dismissInsight(id, null));
      },

      clearInsights: () => {
        const existing = latest.current.insights;
        mutate((d) => ({ ...d, insights: [] }));
        if (cloud) for (const i of existing) push(repo.deleteInsight(i.id));
      },

      markReflected: (at) => {
        mutate((d) => ({ ...d, reflectedAt: at }));
        if (cloud) push(repo.setReflectedAt(at));
      },

      resetToSample: () => {
        const sample = seedData();
        if (cloud) {
          // Wipe first, or the sample lands on top of whatever is there.
          push(
            wipeCloud(data)
              .then(() => repo.migrateLocalData(sample))
              .then(() => repo.fetchAll())
              .then(setData),
          );
          return;
        }
        setData(sample);
      },
      clearAll: () => {
        if (cloud) {
          push(wipeCloud(data).then(() => setData(emptyData())));
          return;
        }
        setData(emptyData());
      },
      exportJSON: () => JSON.stringify(data, null, 2),

      lockState,
      hasPassword,
      passwordAsked,

      unlock: async (password) => {
        const vault = readVault();
        if (!vault) return false;
        const key = await keyForVault(password, vault);
        const plain = await decrypt(key, vault);
        // AES-GCM fails its integrity check on the wrong key, so a null here
        // means a wrong password rather than corrupt data.
        if (plain == null) return false;

        cryptoRef.current = { key, salt: vault.salt };
        setData(parseData(plain));
        setLockState("ready");
        return true;
      },

      setPassword: async (password) => {
        const { key, salt } = await createKey(password);
        const blob = await encrypt(key, salt, JSON.stringify(data));
        localStorage.setItem(VAULT_KEY, JSON.stringify(blob));
        // The plaintext copy has to go, or the password protects nothing.
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem(PASSWORD_CHOICE_KEY, "set");

        cryptoRef.current = { key, salt };
        setHasPassword(true);
        setPasswordAsked(true);
      },

      changePassword: async (current, next) => {
        const vault = readVault();
        if (!vault) return false;
        const oldKey = await keyForVault(current, vault);
        const plain = await decrypt(oldKey, vault);
        if (plain == null) return false;

        const { key, salt } = await createKey(next);
        const blob = await encrypt(key, salt, plain);
        localStorage.setItem(VAULT_KEY, JSON.stringify(blob));
        cryptoRef.current = { key, salt };
        return true;
      },

      removePassword: async (current) => {
        const vault = readVault();
        if (!vault) return false;
        const key = await keyForVault(current, vault);
        const plain = await decrypt(key, vault);
        if (plain == null) return false;

        localStorage.setItem(STORAGE_KEY, plain);
        localStorage.removeItem(VAULT_KEY);
        localStorage.setItem(PASSWORD_CHOICE_KEY, "skipped");
        cryptoRef.current = null;
        setHasPassword(false);
        return true;
      },

      declinePassword: () => {
        try {
          localStorage.setItem(PASSWORD_CHOICE_KEY, "skipped");
        } catch {
          // Storage blocked; we will ask again next visit, which is harmless.
        }
        setPasswordAsked(true);
      },

      lock: () => {
        cryptoRef.current = null;
        setData(emptyData());
        setLockState("locked");
      },

      eraseVault: () => {
        localStorage.removeItem(VAULT_KEY);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PASSWORD_CHOICE_KEY);
        cryptoRef.current = null;
        setHasPassword(false);
        setPasswordAsked(false);
        setData(emptyData());
        setLockState("ready");
      },
    };
  }, [
    data,
    ready,
    mutate,
    push,
    cloud,
    authState,
    user,
    syncError,
    lockState,
    hasPassword,
    passwordAsked,
  ]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/**
 * Removes every row the account owns.
 *
 * Courses go last: tasks and grades hang off them by foreign key, and letting
 * the cascade take them would race the explicit deletes already in flight.
 */
async function wipeCloud(current: AppData): Promise<void> {
  await Promise.all([
    ...current.tasks.map((t) => repo.deleteTask(t.id)),
    ...current.grades.map((g) => repo.deleteGrade(g.id)),
    ...current.universities.map((u) => repo.deleteUniversity(u.id)),
    ...current.days.map((d) => repo.deleteDay(d.date)),
  ]);
  await Promise.all(current.courses.map((c) => repo.deleteCourse(c.id)));
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
