export type ID = string;

export type Priority = "urgent" | "high" | "medium" | "low";
export type Status = "not_started" | "in_progress" | "completed";

export const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];
export const STATUSES: Status[] = ["not_started", "in_progress", "completed"];

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const STATUS_LABEL: Record<Status, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

/** Higher number = more important. Used for sorting. */
export const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 3,
  high: 2,
  medium: 1,
  low: 0,
};

export interface Course {
  id: ID;
  name: string;
  /** Short code shown in dense UI, e.g. "MATH". */
  code: string;
  color: string;
  lessons: string[];
}

/**
 * A part of the student's life, for sorting tasks that are not coursework.
 *
 * Defined by the student rather than fixed in code: the split that matters is
 * different for everyone — swimming, a side project, a part-time job — and a
 * list chosen here would be wrong for most people and unfixable without a
 * release. Courses stay separate; a course says which subject, a category says
 * which part of life, and a task can carry both.
 */
export interface Category {
  id: ID;
  name: string;
  /** One of COURSE_COLORS, so categories and courses share a palette. */
  color: string;
}

export interface Task {
  id: ID;
  title: string;
  courseId: ID | null;
  categoryId: ID | null;
  lesson: string | null;
  /** ISO date, "YYYY-MM-DD". Null means no deadline. */
  dueDate: string | null;
  /** "HH:MM" in local time, optional even when dueDate is set. */
  dueTime: string | null;
  priority: Priority;
  status: Status;
  notes: string;
  createdAt: string;
  completedAt: string | null;
}

export type AssessmentType = "Test" | "Quiz" | "Homework" | "Project" | "Exam" | "Other";

export const ASSESSMENT_TYPES: AssessmentType[] = [
  "Test",
  "Quiz",
  "Homework",
  "Project",
  "Exam",
  "Other",
];

export interface Grade {
  id: ID;
  courseId: ID;
  assessment: string;
  type: AssessmentType;
  /** Percentage, 0-100. */
  score: number;
  /** Percentage weight toward the course grade. Null means unweighted. */
  weight: number | null;
  date: string;
}

export type UniStatus =
  | "interested"
  | "researching"
  | "preparing"
  | "applied"
  | "accepted"
  | "rejected"
  | "waitlisted";

export const UNI_STATUSES: UniStatus[] = [
  "interested",
  "researching",
  "preparing",
  "applied",
  "accepted",
  "rejected",
  "waitlisted",
];

export const UNI_STATUS_LABEL: Record<UniStatus, string> = {
  interested: "Interested",
  researching: "Researching",
  preparing: "Preparing",
  applied: "Applied",
  accepted: "Accepted",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
};

export type UniPriority = "dream" | "target" | "safety";

export const UNI_PRIORITIES: UniPriority[] = ["dream", "target", "safety"];

export const UNI_PRIORITY_LABEL: Record<UniPriority, string> = {
  dream: "Dream",
  target: "Target",
  safety: "Safety",
};

export interface University {
  id: ID;
  name: string;
  country: string;
  /** Emoji flag, shown next to the country. */
  flag: string;
  city: string;
  program: string;
  deadline: string | null;
  status: UniStatus;
  priority: UniPriority;
  notes: string;
  website: string;
}

/**
 * Something the student has set aside time for on a particular day.
 *
 * Deliberately not the same thing as a Task. A task is work that exists until
 * it is done and carries a deadline; a plan item is an intention about one
 * day, and it stops mattering when that day ends. Conflating them is why
 * to-do lists become guilt archives — yesterday's unfinished plan should not
 * follow you around, but an unfinished essay should.
 *
 * `taskId` links the two when a block is time set aside for real work, so
 * ticking the block can finish the task.
 */
export interface PlanItem {
  id: ID;
  /** "YYYY-MM-DD". */
  date: string;
  title: string;
  /** "HH:MM". Null means it belongs to the day but not to an hour. */
  start: string | null;
  /** How long it is expected to take. */
  minutes: number;
  done: boolean;
  /**
   * How much this one matters, independent of when it sits.
   *
   * A day has an order in time and an order in importance, and they are not
   * the same — the thing at 9am is not automatically the thing that matters.
   * Separating them is what makes a plan survive a day that goes wrong: you
   * can see at a glance what still has to happen.
   */
  priority: Priority;
  categoryId: ID | null;
  taskId: ID | null;
}

/**
 * Something meant to happen regularly.
 *
 * Kept separate from plan items rather than generating one per day forever:
 * a habit is a rule, and writing out a year of rows to represent a rule makes
 * changing your mind expensive. Which days it was actually done lives on the
 * day itself.
 */
export interface Habit {
  id: ID;
  name: string;
  categoryId: ID | null;
  /** Weekdays it applies to, 0 = Sunday. Empty means every day. */
  weekdays: number[];
  createdAt: string;
  /** Set rather than deleted, so past completions stay honest. */
  archivedAt: string | null;
}

export const WEEKDAY_LABEL = ["S", "M", "T", "W", "T", "F", "S"];

export type GoalStatus = "active" | "achieved" | "paused";

export const GOAL_STATUSES: GoalStatus[] = ["active", "achieved", "paused"];

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  active: "Working on it",
  achieved: "Achieved",
  paused: "On hold",
};

/**
 * Something the student is aiming at.
 *
 * Not a task and not a habit. A task is finished by doing it once, a habit by
 * doing it repeatedly; a goal is the thing both of those are for, and it is
 * usually too big to tick. It gets a picture because a goal you can see is a
 * different kind of reminder from one you can read — a photograph of the
 * campus does work that "apply to NYU Abu Dhabi" does not.
 *
 * The deadline is optional on purpose. Plenty of what matters has no date, and
 * inventing one to satisfy a form turns an ambition into an overdue item.
 */
export interface Goal {
  id: ID;
  title: string;
  /** Why it matters, in their words. Markdown is not parsed; it is prose. */
  note: string;
  /** A picture, as a data URL. Null when they have not added one. */
  image: string | null;
  /** "YYYY-MM-DD", or null for something with no date attached. */
  deadline: string | null;
  priority: Priority;
  status: GoalStatus;
  /** 0-100, set by hand. Null when the student is not tracking it that way. */
  progress: number | null;
  categoryId: ID | null;
  createdAt: string;
  achievedAt: string | null;
  /** Keeps a hand-arranged order stable. */
  position: number;
}

export interface Profile {
  name: string;
}

/**
 * A block in a day's reflection.
 *
 * Reflection is stored as a list of blocks rather than one string because
 * that is what makes the editor feel like a document: a heading, a bullet and
 * a checkbox each know what they are, so Enter, Backspace and the checkbox
 * can behave differently in each without parsing prose on every keystroke.
 */
export type BlockType =
  "text" | "h2" | "h3" | "bullet" | "todo" | "quote" | "divider" | "image" | "link";

export const BLOCK_LABEL: Record<BlockType, string> = {
  image: "Image",
  link: "Link",
  text: "Text",
  h2: "Heading",
  h3: "Subheading",
  bullet: "Bulleted list",
  todo: "To-do",
  quote: "Quote",
  divider: "Divider",
};

export interface Block {
  id: ID;
  type: BlockType;
  /** The body. For "image" and "link" this is the caption or label. */
  text: string;
  /** Only meaningful for "todo". */
  done: boolean;
  /**
   * For "image": the picture itself, as a data URL.
   *
   * Inline rather than a file reference, because the journal is encrypted on
   * the student's device and an image kept outside that would be the one part
   * of their diary sitting in the clear. Downscaled on the way in — a phone
   * photo is several megabytes and localStorage is not.
   */
  src?: string;
  /** For "link": where it points. */
  href?: string;
}

/**
 * One day of the journal.
 *
 * Keyed by date rather than by id: there is exactly one 15 September, and
 * making that structural means logging a weight twice cannot produce two
 * competing rows for the same morning.
 */
export interface Day {
  /** "YYYY-MM-DD". Unique across the collection. */
  date: string;
  /** Kilograms. Null when the day has a reflection but no weigh-in. */
  weight: number | null;
  reflection: Block[];
  /** Ids of the habits ticked off on this day. */
  habitsDone: ID[];
}

/**
 * One durable thing the hub has learned about the student.
 *
 * Deliberately a list of short, separate notes rather than one growing essay:
 * a note can be corrected or deleted on its own, the student can read exactly
 * what is believed about them, and a wrong inference does not contaminate
 * everything around it.
 *
 * `source` is kept so a note that turns out to be wrong can be traced back to
 * whatever produced it.
 */
export interface MemoryNote {
  id: ID;
  /** Grouping shown in Settings, e.g. "Study habits", "Stress signals". */
  topic: string;
  /** One sentence, written in the third person: "Works best early." */
  note: string;
  source: "reflection" | "conversation" | "pattern";
  createdAt: string;
  updatedAt: string;
  /** Set by the student. A pinned note is never revised or dropped. */
  pinned: boolean;
}

export type InsightKind = "takeaway" | "recommendation" | "pattern";

export const INSIGHT_LABEL: Record<InsightKind, string> = {
  takeaway: "Takeaway",
  recommendation: "Suggestion",
  pattern: "Pattern",
};

/**
 * Something the hub noticed on its own, rather than in reply to a question.
 *
 * Kept as data instead of being regenerated on every render: the student
 * should be able to dismiss one and have it stay dismissed, and comparing what
 * was said last week against this week is the whole point of a hub that is
 * supposed to know them better over time.
 */
export interface Insight {
  id: ID;
  kind: InsightKind;
  /** A few words. The line the student reads first. */
  title: string;
  body: string;
  /** What in the hub it was drawn from, so the reasoning can be checked. */
  basis: string;
  /** Where acting on it would start, when there is an obvious place. */
  href: string | null;
  createdAt: string;
  dismissedAt: string | null;
}

export interface AppData {
  profile: Profile;
  courses: Course[];
  categories: Category[];
  tasks: Task[];
  grades: Grade[];
  universities: University[];
  days: Day[];
  plan: PlanItem[];
  habits: Habit[];
  goals: Goal[];
  memory: MemoryNote[];
  insights: Insight[];
  /** When the hub last sat down and thought about the student. ISO datetime. */
  reflectedAt: string | null;
}
