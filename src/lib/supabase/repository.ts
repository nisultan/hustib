"use client";

import {
  AppData,
  Block,
  BlockType,
  Category,
  Course,
  Day,
  Grade,
  Insight,
  InsightKind,
  MemoryNote,
  Task,
  University,
} from "../types";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./client";
import {
  CategoryRow,
  CourseRow,
  DayRow,
  GradeRow,
  InsightRow,
  LessonRow,
  MemoryNoteRow,
  TaskRow,
  UniversityRow,
} from "./types";

/**
 * The Supabase implementation of the same operations `store.tsx` performs
 * against localStorage.
 *
 * Every function here is a drop-in for one store mutator. Switching the app
 * over means having `StoreProvider` call these instead of writing to
 * localStorage — the component tree does not change, because it already
 * treats mutations as fire-and-forget and reads a single `AppData` object.
 *
 * `user_id` is never sent. The schema defaults it to `auth.uid()` and RLS
 * rejects anything else, so the client cannot write into another account even
 * if it tried.
 */

function client() {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
    );
  }
  return supabase;
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await client().auth.signUp({
    email,
    password,
    // Read by the handle_new_user trigger to populate profiles.name.
    options: { data: { name } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Starts the Google redirect flow.
 *
 * Returning to the page it left from means a student who signs in from
 * /grades lands back on /grades. The browser client has detectSessionInUrl
 * on, so the tokens in the returned URL become a session without a callback
 * route of our own.
 */
export async function signInWithGoogle(redirectTo?: string) {
  const { error } = await client().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo:
        redirectTo ?? (typeof window !== "undefined" ? window.location.href : undefined),
      queryParams: {
        // Without this Google skips the account chooser once a session
        // exists, which makes switching accounts impossible.
        prompt: "select_account",
      },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}

/** The session restored from storage on load, or null when signed out. */
export async function currentSession() {
  const { data } = await client().auth.getSession();
  return data.session;
}

/**
 * Subscribes to sign-in and sign-out, including the token refresh that keeps
 * a remembered session alive. Returns the unsubscribe.
 */
export function onAuthChange(fn: (user: User | null) => void): () => void {
  const { data } = client().auth.onAuthStateChange((_event, session) => {
    fn(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

export async function currentUser() {
  const { data } = await client().auth.getUser();
  return data.user;
}

/**
 * Whether an error means "this feature's migration has not been run here"
 * rather than "this write failed".
 *
 * A database one migration behind the code is a normal state — the app deploys
 * before someone runs the SQL, and both halves have to survive the gap. The
 * feature that needs the missing table goes quiet; everything else keeps
 * working, and the student is never shown a sync failure they cannot act on.
 *
 * Postgres reports the undefined table or column; PostgREST reports its own
 * schema cache missing them.
 */
function isMissingSchema(error: { code?: string } | null): boolean {
  const code = error?.code;
  return code === "42P01" || code === "42703" || code === "PGRST205" || code === "PGRST204";
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Loads the whole hub in one round trip.
 *
 * A student's entire dataset is a few hundred rows at most, so fetching it all
 * on sign-in and working from memory is both simpler and faster than querying
 * per page — and it keeps the store's synchronous read model intact.
 */
export async function fetchAll(): Promise<AppData> {
  const supabase = client();

  const [
    profile,
    courses,
    lessons,
    tasks,
    grades,
    universities,
    days,
    categories,
    memory,
    insights,
  ] = await Promise.all([
    supabase.from("profiles").select("*").maybeSingle(),
    supabase.from("courses").select("*").order("created_at"),
    supabase.from("lessons").select("*").order("position"),
    supabase.from("tasks").select("*").order("due_date", { nullsFirst: false }),
    supabase.from("grades").select("*").order("date", { ascending: false }),
    supabase.from("universities").select("*").order("deadline", { nullsFirst: false }),
    supabase.from("days").select("*").order("date", { ascending: false }),
    supabase.from("categories").select("*").order("created_at"),
    supabase.from("memory_notes").select("*").order("created_at"),
    supabase.from("insights").select("*").order("created_at", { ascending: false }),
  ]);

  const firstError =
    profile.error ??
    courses.error ??
    lessons.error ??
    tasks.error ??
    grades.error ??
    universities.error ??
    days.error;
  if (firstError) throw firstError;

  // Memory and insights are deliberately excluded from the check above. They
  // arrived after the rest of the schema, and a database still on the earlier
  // migration must load a student's courses and grades exactly as before
  // rather than failing the entire hub over a table it has never heard of.
  for (const optional of [categories, memory, insights]) {
    if (optional.error && !isMissingSchema(optional.error)) throw optional.error;
  }

  const lessonsByCourse = new Map<string, string[]>();
  for (const l of (lessons.data ?? []) as LessonRow[]) {
    const list = lessonsByCourse.get(l.course_id) ?? [];
    list.push(l.name);
    lessonsByCourse.set(l.course_id, list);
  }

  return {
    profile: { name: profile.data?.name ?? "there" },
    courses: ((courses.data ?? []) as CourseRow[]).map((c) =>
      toCourse(c, lessonsByCourse.get(c.id) ?? []),
    ),
    tasks: ((tasks.data ?? []) as TaskRow[]).map(toTask),
    grades: ((grades.data ?? []) as GradeRow[]).map(toGrade),
    universities: ((universities.data ?? []) as UniversityRow[]).map(toUniversity),
    days: ((days.data ?? []) as DayRow[]).map(toDay),
    categories: ((categories.data ?? []) as CategoryRow[]).map(toCategory),
    memory: ((memory.data ?? []) as MemoryNoteRow[]).map(toMemory),
    insights: ((insights.data ?? []) as InsightRow[]).map(toInsight),
    // Undefined on a pre-migration database, which reads as "never reflected".
    reflectedAt: (profile.data as { reflected_at?: string | null } | null)?.reflected_at ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Courses                                                                    */
/* -------------------------------------------------------------------------- */

export async function createCourse(c: Omit<Course, "id">): Promise<Course> {
  const supabase = client();
  const { data, error } = await supabase
    .from("courses")
    .insert({ name: c.name, code: c.code, color: c.color })
    .select()
    .single();
  if (error) throw error;

  await replaceLessons(data.id, c.lessons);
  return toCourse(data as CourseRow, c.lessons);
}

export async function updateCourse(id: string, patch: Partial<Course>): Promise<void> {
  const supabase = client();
  const { lessons, ...rest } = patch;

  if (Object.keys(rest).length > 0) {
    const { error } = await supabase
      .from("courses")
      .update({ name: rest.name, code: rest.code, color: rest.color })
      .eq("id", id);
    if (error) throw error;
  }

  if (lessons) await replaceLessons(id, lessons);
}

/** Lessons are a plain string list in the app, so the row set is rewritten. */
async function replaceLessons(courseId: string, lessons: string[]): Promise<void> {
  const supabase = client();

  const { error: delError } = await supabase.from("lessons").delete().eq("course_id", courseId);
  if (delError) throw delError;

  if (lessons.length === 0) return;

  const { error } = await supabase
    .from("lessons")
    .insert(lessons.map((name, position) => ({ course_id: courseId, name, position })));
  if (error) throw error;
}

/** Tasks and grades go with it, via ON DELETE CASCADE in the schema. */
export async function deleteCourse(id: string): Promise<void> {
  const { error } = await client().from("courses").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

export async function createTask(
  t: Omit<Task, "id" | "createdAt" | "completedAt">,
): Promise<Task> {
  const { data, error } = await client()
    .from("tasks")
    .insert({
      title: t.title,
      course_id: t.courseId,
      category_id: t.categoryId,
      lesson: t.lesson,
      notes: t.notes,
      due_date: t.dueDate,
      due_time: t.dueTime,
      priority: t.priority,
      status: t.status,
      // The schema's completed_has_timestamp constraint ties these together.
      completed_at: t.status === "completed" ? new Date().toISOString().slice(0, 10) : null,
    })
    .select()
    .single();
  if (error) throw error;
  return toTask(data as TaskRow);
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  const row: Partial<TaskRow> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.courseId !== undefined) row.course_id = patch.courseId;
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
  if (patch.lesson !== undefined) row.lesson = patch.lesson;
  if (patch.notes !== undefined) row.notes = patch.notes;
  if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
  if (patch.dueTime !== undefined) row.due_time = patch.dueTime;
  if (patch.priority !== undefined) row.priority = patch.priority;
  if (patch.status !== undefined) {
    row.status = patch.status;
    row.completed_at =
      patch.status === "completed"
        ? (patch.completedAt ?? new Date().toISOString().slice(0, 10))
        : null;
  }
  if (Object.keys(row).length === 0) return;

  const { error } = await client().from("tasks").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await client().from("tasks").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Grades                                                                     */
/* -------------------------------------------------------------------------- */

export async function createGrade(g: Omit<Grade, "id">): Promise<Grade> {
  const { data, error } = await client()
    .from("grades")
    .insert({
      course_id: g.courseId,
      assessment: g.assessment,
      type: g.type,
      score: g.score,
      weight: g.weight,
      date: g.date,
    })
    .select()
    .single();
  if (error) throw error;
  return toGrade(data as GradeRow);
}

export async function updateGrade(id: string, patch: Partial<Grade>): Promise<void> {
  const row: Partial<GradeRow> = {};
  if (patch.courseId !== undefined) row.course_id = patch.courseId;
  if (patch.assessment !== undefined) row.assessment = patch.assessment;
  if (patch.type !== undefined) row.type = patch.type;
  if (patch.score !== undefined) row.score = patch.score;
  if (patch.weight !== undefined) row.weight = patch.weight;
  if (patch.date !== undefined) row.date = patch.date;
  if (Object.keys(row).length === 0) return;

  const { error } = await client().from("grades").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteGrade(id: string): Promise<void> {
  const { error } = await client().from("grades").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Universities                                                               */
/* -------------------------------------------------------------------------- */

export async function createUniversity(u: Omit<University, "id">): Promise<University> {
  const { data, error } = await client()
    .from("universities")
    .insert({
      name: u.name,
      country: u.country,
      flag: u.flag,
      city: u.city,
      program: u.program,
      deadline: u.deadline,
      status: u.status,
      priority: u.priority,
      notes: u.notes,
      website: u.website,
    })
    .select()
    .single();
  if (error) throw error;
  return toUniversity(data as UniversityRow);
}

export async function updateUniversity(id: string, patch: Partial<University>): Promise<void> {
  const row: Partial<UniversityRow> = {};
  for (const [key, column] of Object.entries({
    name: "name",
    country: "country",
    flag: "flag",
    city: "city",
    program: "program",
    deadline: "deadline",
    status: "status",
    priority: "priority",
    notes: "notes",
    website: "website",
  })) {
    const value = (patch as Record<string, unknown>)[key];
    if (value !== undefined) (row as Record<string, unknown>)[column] = value;
  }
  if (Object.keys(row).length === 0) return;

  const { error } = await client().from("universities").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteUniversity(id: string): Promise<void> {
  const { error } = await client().from("universities").delete().eq("id", id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Journal                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Creates or edits the row for a date.
 *
 * Upsert on the (user_id, date) key rather than select-then-insert: two
 * devices logging the same morning should converge on one row instead of
 * racing to create two.
 */
export async function upsertDay(
  date: string,
  patch: Partial<Omit<Day, "date">>,
): Promise<void> {
  const supabase = client();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in.");

  const row: Record<string, unknown> = {
    user_id: data.user.id,
    date,
    updated_at: new Date().toISOString(),
  };
  if (patch.weight !== undefined) row.weight = patch.weight;
  if (patch.reflection !== undefined) row.reflection = patch.reflection;

  const { error } = await supabase.from("days").upsert(row, { onConflict: "user_id,date" });
  if (error) throw error;
}

export async function deleteDay(date: string): Promise<void> {
  const { error } = await client().from("days").delete().eq("date", date);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

/* --------------------------------- Categories ---------------------------- */

export async function createCategory(c: Omit<Category, "id">): Promise<Category | null> {
  const { data, error } = await client()
    .from("categories")
    .insert({ name: c.name, color: c.color })
    .select()
    .single();
  if (error) {
    if (isMissingSchema(error)) return null;
    throw error;
  }
  return toCategory(data as CategoryRow);
}

export async function updateCategory(id: string, patch: Partial<Category>): Promise<void> {
  const row: Partial<CategoryRow> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.color !== undefined) row.color = patch.color;
  if (Object.keys(row).length === 0) return;

  const { error } = await client().from("categories").update(row).eq("id", id);
  if (error && !isMissingSchema(error)) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await client().from("categories").delete().eq("id", id);
  if (error && !isMissingSchema(error)) throw error;
}

/* ----------------------------- Memory & insights ------------------------- */

export async function createMemory(m: Omit<MemoryNote, "id">): Promise<MemoryNote> {
  const { data, error } = await client()
    .from("memory_notes")
    .insert({
      topic: m.topic,
      note: m.note,
      source: m.source,
      pinned: m.pinned,
      created_at: m.createdAt,
      updated_at: m.updatedAt,
    })
    .select()
    .single();
  if (error) {
    if (isMissingSchema(error)) return { ...m, id: "" };
    throw error;
  }
  return toMemory(data as MemoryNoteRow);
}

export async function updateMemory(id: string, patch: Partial<MemoryNote>): Promise<void> {
  const row: Partial<MemoryNoteRow> = { updated_at: new Date().toISOString() };
  if (patch.topic !== undefined) row.topic = patch.topic;
  if (patch.note !== undefined) row.note = patch.note;
  if (patch.pinned !== undefined) row.pinned = patch.pinned;

  const { error } = await client().from("memory_notes").update(row).eq("id", id);
  if (error && !isMissingSchema(error)) throw error;
}

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await client().from("memory_notes").delete().eq("id", id);
  if (error && !isMissingSchema(error)) throw error;
}

export async function createInsight(i: Omit<Insight, "id">): Promise<Insight> {
  const { data, error } = await client()
    .from("insights")
    .insert({
      kind: i.kind,
      title: i.title,
      body: i.body,
      basis: i.basis,
      href: i.href,
      created_at: i.createdAt,
      dismissed_at: i.dismissedAt,
    })
    .select()
    .single();
  if (error) {
    if (isMissingSchema(error)) return { ...i, id: "" };
    throw error;
  }
  return toInsight(data as InsightRow);
}

export async function dismissInsight(id: string, at: string | null): Promise<void> {
  const { error } = await client().from("insights").update({ dismissed_at: at }).eq("id", id);
  if (error && !isMissingSchema(error)) throw error;
}

export async function deleteInsight(id: string): Promise<void> {
  const { error } = await client().from("insights").delete().eq("id", id);
  if (error && !isMissingSchema(error)) throw error;
}

export async function setReflectedAt(at: string): Promise<void> {
  const supabase = client();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not signed in.");
  const { error } = await supabase
    .from("profiles")
    .update({ reflected_at: at })
    .eq("id", user.user.id);
  if (error && !isMissingSchema(error)) throw error;
}

export async function updateProfileName(name: string): Promise<void> {
  const supabase = client();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in.");

  const { error } = await supabase.from("profiles").update({ name }).eq("id", data.user.id);
  if (error) throw error;
}

/* -------------------------------------------------------------------------- */
/* Migration                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Pushes a local hub into a freshly signed-in account, so a student who used
 * the local-only build does not lose what they already entered.
 *
 * Courses go first and their new server-assigned ids are mapped, because tasks
 * and grades reference them; the local ids are meaningless server-side.
 */
export async function migrateLocalData(local: AppData): Promise<void> {
  const courseIdMap = new Map<string, string>();

  for (const course of local.courses) {
    const created = await createCourse({
      name: course.name,
      code: course.code,
      color: course.color,
      lessons: course.lessons,
    });
    courseIdMap.set(course.id, created.id);
  }

  for (const task of local.tasks) {
    await createTask({
      ...task,
      courseId: task.courseId ? (courseIdMap.get(task.courseId) ?? null) : null,
    });
  }

  for (const grade of local.grades) {
    const courseId = courseIdMap.get(grade.courseId);
    // A grade whose course did not migrate has nothing to hang off.
    if (!courseId) continue;
    await createGrade({ ...grade, courseId });
  }

  for (const uni of local.universities) {
    await createUniversity(uni);
  }

  for (const day of local.days) {
    await upsertDay(day.date, { weight: day.weight, reflection: day.reflection });
  }

  if (local.profile.name && local.profile.name !== "there") {
    await updateProfileName(local.profile.name);
  }
}

/* -------------------------------------------------------------------------- */
/* Row → app mappers                                                          */
/* -------------------------------------------------------------------------- */

function toCourse(row: CourseRow, lessons: string[]): Course {
  return { id: row.id, name: row.name, code: row.code, color: row.color, lessons };
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    courseId: row.course_id,
    // Null on a database that has not run the categories migration.
    categoryId: row.category_id ?? null,
    lesson: row.lesson,
    dueDate: row.due_date,
    // Postgres `time` comes back as "HH:MM:SS"; the app works in "HH:MM".
    dueTime: row.due_time ? row.due_time.slice(0, 5) : null,
    priority: row.priority,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function toGrade(row: GradeRow): Grade {
  return {
    id: row.id,
    courseId: row.course_id,
    assessment: row.assessment,
    type: row.type,
    // numeric columns arrive as strings over the wire in some drivers.
    score: Number(row.score),
    weight: row.weight == null ? null : Number(row.weight),
    date: row.date,
  };
}

const BLOCK_TYPES = ["text", "h2", "h3", "bullet", "todo", "quote", "divider"];

const MEMORY_SOURCES = ["reflection", "conversation", "pattern"];
const INSIGHT_KINDS = ["takeaway", "recommendation", "pattern"];

function toCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, color: row.color };
}

function toMemory(row: MemoryNoteRow): MemoryNote {
  return {
    id: row.id,
    topic: row.topic,
    note: row.note,
    // Written by a model through an older client, so the column is plain text
    // rather than an enum; an unrecognised value degrades instead of breaking.
    source: (MEMORY_SOURCES.includes(row.source) ? row.source : "pattern") as MemoryNote["source"],
    pinned: Boolean(row.pinned),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toInsight(row: InsightRow): Insight {
  return {
    id: row.id,
    kind: (INSIGHT_KINDS.includes(row.kind) ? row.kind : "takeaway") as InsightKind,
    title: row.title,
    body: row.body,
    basis: row.basis ?? "",
    href: row.href,
    createdAt: row.created_at,
    dismissedAt: row.dismissed_at,
  };
}

function toDay(row: DayRow): Day {
  return {
    date: row.date,
    weight: row.weight == null ? null : Number(row.weight),
    // jsonb is whatever was written to it, and an older client may have
    // written a type this build does not know. Falling back to plain text
    // keeps the words rather than dropping the block.
    reflection: (Array.isArray(row.reflection) ? row.reflection : []).map((b): Block => ({
      id: String(b?.id ?? Math.random().toString(36).slice(2)),
      type: (BLOCK_TYPES.includes(b?.type) ? b.type : "text") as BlockType,
      text: String(b?.text ?? ""),
      done: Boolean(b?.done),
    })),
  };
}

function toUniversity(row: UniversityRow): University {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    flag: row.flag,
    city: row.city,
    program: row.program,
    deadline: row.deadline,
    status: row.status,
    priority: row.priority,
    notes: row.notes,
    website: row.website,
  };
}
