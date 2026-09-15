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
import { AppData, Course, Day, Grade, Task, University, Profile, ID } from "./types";
import { seedData } from "./seed";
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

function emptyData(): AppData {
  return {
    profile: { name: "there" },
    courses: [],
    tasks: [],
    grades: [],
    universities: [],
    days: [],
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

function loadPlain(): AppData {
  if (typeof window === "undefined") return emptyData();
  try {
    return parseData(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyData();
  }
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
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

  const mutate = useCallback((fn: (d: AppData) => AppData) => setData(fn), []);

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
            : { date, weight: null, reflection: [], ...patch };
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
