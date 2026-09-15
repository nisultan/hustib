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

export interface Task {
  id: ID;
  title: string;
  courseId: ID | null;
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

export interface Profile {
  name: string;
}

export interface AppData {
  profile: Profile;
  courses: Course[];
  tasks: Task[];
  grades: Grade[];
  universities: University[];
}
