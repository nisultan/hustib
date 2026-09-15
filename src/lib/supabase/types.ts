/**
 * Row types for the tables in `supabase/schema.sql`.
 *
 * Hand-written to match that file. Once your project is up you can regenerate
 * this from the live database instead, which keeps it honest as the schema
 * moves:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 *
 * Note the naming gap that `repository.ts` exists to bridge: Postgres columns
 * are snake_case, the app's types are camelCase.
 */

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "not_started" | "in_progress" | "completed";
export type AssessmentTypeDb = "Test" | "Quiz" | "Homework" | "Project" | "Exam" | "Other";
export type ApplicationStatus =
  | "interested"
  | "researching"
  | "preparing"
  | "applied"
  | "accepted"
  | "rejected"
  | "waitlisted";
export type ApplicationPriority = "dream" | "target" | "safety";

export type ProfileRow = {
  id: string;
  name: string;
  created_at: string;
};

export type CourseRow = {
  id: string;
  user_id: string;
  name: string;
  code: string;
  color: string;
  created_at: string;
};

export type LessonRow = {
  id: string;
  user_id: string;
  course_id: string;
  name: string;
  position: number;
};

export type TaskRow = {
  id: string;
  user_id: string;
  course_id: string | null;
  lesson: string | null;
  title: string;
  notes: string;
  due_date: string | null;
  due_time: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
};

export type GradeRow = {
  id: string;
  user_id: string;
  course_id: string;
  category_id: string | null;
  assessment: string;
  type: AssessmentTypeDb;
  score: number;
  weight: number | null;
  date: string;
  created_at: string;
};

export type UniversityRow = {
  id: string;
  user_id: string;
  name: string;
  country: string;
  flag: string;
  city: string;
  program: string;
  deadline: string | null;
  status: ApplicationStatus;
  priority: ApplicationPriority;
  notes: string;
  website: string;
  created_at: string;
};

// Declared as type aliases, not interfaces, on purpose: supabase-js constrains
// every Row/Insert/Update to `Record<string, unknown>`, and an interface has no
// implicit index signature to satisfy that. Using `interface` here makes every
// query in the app silently resolve to `never`.

/**
 * Shape supabase-js expects for its generic.
 *
 * Insert and Update are both `Partial<Row>`: every column the app omits is
 * either server-defaulted (`id`, `created_at`), filled by RLS (`user_id`) or
 * genuinely nullable. Spelling out which are required per table would
 * duplicate constraints the database already enforces, and get out of step
 * with them the first time the schema moves.
 */
type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  // supabase-js requires this key on every table for its generic to match;
  // leaving it out silently resolves every query type to `never`. Empty is
  // fine — it only powers typed joins, which this app does not use.
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      courses: Table<CourseRow>;
      lessons: Table<LessonRow>;
      tasks: Table<TaskRow>;
      grades: Table<GradeRow>;
      universities: Table<UniversityRow>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      task_priority: TaskPriority;
      task_status: TaskStatus;
      assessment_type: AssessmentTypeDb;
      application_status: ApplicationStatus;
      application_priority: ApplicationPriority;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
