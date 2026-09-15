import { AppData } from "./types";
import { addDays, todayISO } from "./dates";

/**
 * Example data for a first run, so the dashboard demonstrates what it does
 * instead of showing five empty states. Dates are relative to today so the
 * "Today" and "Upcoming" sections are always populated. Clearable in Settings.
 */
export function seedData(): AppData {
  const t = todayISO();

  return {
    profile: { name: "Sultan" },
    courses: [
      {
        id: "c-math",
        name: "Math AA HL",
        code: "MATH",
        color: "violet",
        lessons: ["Integration", "Probability", "Complex numbers"],
      },
      {
        id: "c-econ",
        name: "Economics HL",
        code: "ECON",
        color: "amber",
        lessons: ["Elasticity", "Market failure"],
      },
      {
        id: "c-phys",
        name: "Physics SL",
        code: "PHYS",
        color: "sky",
        lessons: ["Waves", "Mechanics"],
      },
      {
        id: "c-eng",
        name: "English B",
        code: "ENG",
        color: "emerald",
        lessons: ["Vocabulary", "Written task"],
      },
    ],
    tasks: [
      task(
        "t1",
        "Finish integration homework",
        "c-math",
        "Integration",
        t,
        null,
        "high",
        "in_progress",
        "Need to complete exercises 5–12.",
      ),
      task(
        "t2",
        "Read article for IA",
        "c-econ",
        "Market failure",
        t,
        "18:00",
        "medium",
        "not_started",
        "",
      ),
      task(
        "t3",
        "Vocabulary revision",
        "c-eng",
        "Vocabulary",
        t,
        null,
        "low",
        "not_started",
        "",
      ),
      task(
        "t4",
        "Physics homework",
        "c-phys",
        "Waves",
        addDays(t, 1),
        null,
        "high",
        "not_started",
        "Worksheet on wave interference.",
      ),
      task(
        "t5",
        "Economics IA draft",
        "c-econ",
        "Elasticity",
        addDays(t, 3),
        null,
        "urgent",
        "in_progress",
        "First draft: 800 words minimum.",
      ),
      task(
        "t6",
        "Math test",
        "c-math",
        "Integration",
        addDays(t, 5),
        "09:00",
        "high",
        "not_started",
        "Covers integration by substitution and by parts.",
      ),
      task(
        "t7",
        "Physics test",
        "c-phys",
        "Waves",
        addDays(t, 2),
        null,
        "high",
        "not_started",
        "",
      ),
      task(
        "t8",
        "Review wave interference notes",
        "c-phys",
        "Waves",
        addDays(t, 1),
        null,
        "medium",
        "not_started",
        "",
      ),
      task(
        "t9",
        "Practice past paper questions",
        "c-math",
        "Probability",
        addDays(t, 4),
        null,
        "medium",
        "not_started",
        "",
      ),
      task(
        "t10",
        "Submit English written task",
        "c-eng",
        "Written task",
        addDays(t, -1),
        null,
        "high",
        "not_started",
        "",
      ),
      {
        ...task(
          "t11",
          "Complete probability problem set",
          "c-math",
          "Probability",
          addDays(t, -3),
          null,
          "medium",
          "completed",
          "",
        ),
        completedAt: addDays(t, -3),
      },
      {
        ...task(
          "t12",
          "Economics reading notes",
          "c-econ",
          "Elasticity",
          addDays(t, -5),
          null,
          "low",
          "completed",
          "",
        ),
        completedAt: addDays(t, -5),
      },
    ],
    grades: [
      grade("g1", "c-math", "Test 1", "Test", 92, 20, addDays(t, -35)),
      grade("g2", "c-math", "Homework set 3", "Homework", 100, 10, addDays(t, -20)),
      grade("g3", "c-math", "Quiz 2", "Quiz", 88, 10, addDays(t, -8)),
      grade("g4", "c-econ", "Quiz 1", "Quiz", 84, 15, addDays(t, -30)),
      grade("g5", "c-econ", "Essay", "Project", 90, 25, addDays(t, -12)),
      grade("g6", "c-phys", "Test 1", "Test", 74, 20, addDays(t, -33)),
      grade("g7", "c-phys", "Lab report", "Project", 81, 15, addDays(t, -16)),
      grade("g8", "c-phys", "Quiz 1", "Quiz", 80, 10, addDays(t, -6)),
      grade("g9", "c-eng", "Oral", "Test", 94, 25, addDays(t, -28)),
      grade("g10", "c-eng", "Written task 1", "Project", 92, 20, addDays(t, -10)),
    ],
    universities: [
      uni(
        "u1",
        "NYU Abu Dhabi",
        "UAE",
        "🇦🇪",
        "Abu Dhabi",
        "Computer Science / Economics",
        nextJan(5),
        "preparing",
        "dream",
        "Full scholarship consideration is automatic.\nRequires 2 supplemental essays.\nCandidate Weekend in February.",
        "https://nyuad.nyu.edu",
      ),
      uni(
        "u2",
        "University of Toronto",
        "Canada",
        "🇨🇦",
        "Toronto",
        "Computer Science",
        nextJan(15),
        "researching",
        "target",
        "IELTS 6.5 minimum.\nCheck the supplementary application deadline.",
        "https://utoronto.ca",
      ),
      uni(
        "u3",
        "TU Delft",
        "Netherlands",
        "🇳🇱",
        "Delft",
        "Applied Mathematics",
        nextJan(15),
        "interested",
        "target",
        "Numerus fixus programme — early deadline.",
        "https://tudelft.nl",
      ),
      uni(
        "u4",
        "Nazarbayev University",
        "Kazakhstan",
        "🇰🇿",
        "Astana",
        "Computer Science",
        nextJan(31),
        "applied",
        "safety",
        "Application submitted. Waiting on NUFYP results.",
        "https://nu.edu.kz",
      ),
    ],
  };
}

function task(
  id: string,
  title: string,
  courseId: string,
  lesson: string,
  dueDate: string | null,
  dueTime: string | null,
  priority: "urgent" | "high" | "medium" | "low",
  status: "not_started" | "in_progress" | "completed",
  notes: string,
) {
  return {
    id,
    title,
    courseId,
    lesson,
    dueDate,
    dueTime,
    priority,
    status,
    notes,
    createdAt: todayISO(),
    completedAt: null as string | null,
  };
}

function grade(
  id: string,
  courseId: string,
  assessment: string,
  type: "Test" | "Quiz" | "Homework" | "Project" | "Exam" | "Other",
  score: number,
  weight: number | null,
  date: string,
) {
  return { id, courseId, assessment, type, score, weight, date };
}

function uni(
  id: string,
  name: string,
  country: string,
  flag: string,
  city: string,
  program: string,
  deadline: string,
  status:
    | "interested"
    | "researching"
    | "preparing"
    | "applied"
    | "accepted"
    | "rejected"
    | "waitlisted",
  priority: "dream" | "target" | "safety",
  notes: string,
  website: string,
) {
  return { id, name, country, flag, city, program, deadline, status, priority, notes, website };
}

/** The next January `day` that hasn't passed yet. */
function nextJan(day: number): string {
  const now = new Date();
  const year =
    now.getMonth() === 0 && now.getDate() <= day ? now.getFullYear() : now.getFullYear() + 1;
  return `${year}-01-${`${day}`.padStart(2, "0")}`;
}
