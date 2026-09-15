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
import { AppData, Course, Grade, Task, University, Profile, ID } from "./types";
import { seedData } from "./seed";
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
  lockState: LockState;
  /** True when this device's data is encrypted behind a password. */
  hasPassword: boolean;
  /** Whether we have already asked the student to choose a password. */
  passwordAsked: boolean;

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
  return { profile: { name: "there" }, courses: [], tasks: [], grades: [], universities: [] };
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [lockState, setLockState] = useState<LockState>("loading");
  const [hasPassword, setHasPassword] = useState(false);
  const [passwordAsked, setPasswordAsked] = useState(true);

  // The derived key and its salt, held only in memory. Losing them on reload
  // is the point: the password has to be re-entered to get back in.
  const cryptoRef = useRef<{ key: CryptoKey; salt: string } | null>(null);

  const ready = lockState === "ready";

  // Loading in an effect rather than in useState keeps the server render and
  // the first client render identical, avoiding a hydration mismatch.
  useEffect(() => {
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
  }, []);

  // Persisting is async once a password is set, so writes are sequenced
  // through a ref: a fast edit must never let an older blob land last and
  // overwrite a newer one.
  const writeSeq = useRef(0);

  useEffect(() => {
    if (lockState !== "ready") return;

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
  }, [data, lockState]);

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
  }, [data, ready, mutate, lockState, hasPassword, passwordAsked]);

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
