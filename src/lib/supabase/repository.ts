"use client";

import { AppData, Course, Grade, Task, University } from "../types";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./client";
import { CourseRow, GradeRow, LessonRow, TaskRow, UniversityRow } from "./types";

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

  const [profile, courses, lessons, tasks, grades, universities] = await Promise.all([
    supabase.from("profiles").select("*").maybeSingle(),
    supabase.from("courses").select("*").order("created_at"),
    supabase.from("lessons").select("*").order("position"),
    supabase.from("tasks").select("*").order("due_date", { nullsFirst: false }),
    supabase.from("grades").select("*").order("date", { ascending: false }),
    supabase.from("universities").select("*").order("deadline", { nullsFirst: false }),
  ]);

  const firstError =
    profile.error ??
    courses.error ??
    lessons.error ??
    tasks.error ??
    grades.error ??
    universities.error;
  if (firstError) throw firstError;

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
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

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
