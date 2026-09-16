import {
  PRIORITIES,
  STATUSES,
  ASSESSMENT_TYPES,
  UNI_STATUSES,
  UNI_PRIORITIES,
} from "@/lib/types";

/**
 * What the assistant is allowed to do, declared for Gemini's function calling.
 *
 * Reads are free — the whole hub is already in the prompt. These are the
 * writes, and the list is deliberately short of destructive ones: there is no
 * delete tool, because "clear my week" is exactly the kind of instruction a
 * model can take more literally than a tired student meant it, and losing a
 * term of grades to a misread sentence is not a recoverable mistake. Removing
 * things stays a deliberate act in the UI.
 *
 * Every id in here comes from the context snapshot, which is how the model is
 * able to name a specific task at all.
 */

const STR = { type: "STRING" } as const;

function enumOf(values: readonly string[], description: string) {
  return { type: "STRING", format: "enum", enum: [...values], description } as const;
}

export const TOOL_DECLARATIONS = [
  {
    name: "create_task",
    description:
      "Add a task to the student's list. Use for anything they say they need to do. " +
      "Resolve relative dates ('next Friday') against today's date yourself and pass an exact date.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: {
          ...STR,
          description: "Short imperative title, e.g. 'Finish physics lab report'.",
        },
        dueDate: {
          ...STR,
          description: "YYYY-MM-DD. Omit only if there is genuinely no deadline.",
        },
        dueTime: { ...STR, description: "HH:MM, 24-hour. Only when they named a time." },
        courseId: {
          ...STR,
          description: "Course id from the context. Omit if unrelated to a course.",
        },
        categoryId: {
          ...STR,
          description:
            "Category id from the context — which part of their life this belongs to. " +
            "Set it whenever one of their categories clearly fits; coursework belongs to " +
            "whichever category their other coursework uses.",
        },
        lesson: {
          ...STR,
          description: "Topic within the course, if one of the course's listed topics fits.",
        },
        priority: enumOf(PRIORITIES, "Default to 'medium' unless urgency is clear."),
        notes: {
          ...STR,
          description: "Any detail worth keeping that does not belong in the title.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description:
      "Change an existing task. Use for rescheduling, re-prioritising, or marking progress. " +
      "Pass only the fields that change.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: { ...STR, description: "The task id from the context." },
        title: STR,
        dueDate: {
          ...STR,
          description: "YYYY-MM-DD, or the string 'none' to clear the deadline.",
        },
        dueTime: STR,
        priority: enumOf(PRIORITIES, "New priority."),
        status: enumOf(STATUSES, "New status."),
        courseId: STR,
        categoryId: { ...STR, description: "Category id, or the string 'none' to clear it." },
        notes: STR,
      },
      required: ["id"],
    },
  },
  {
    name: "complete_task",
    description: "Mark a task done. Use when the student says they have finished something.",
    parameters: {
      type: "OBJECT",
      properties: { id: { ...STR, description: "The task id from the context." } },
      required: ["id"],
    },
  },
  {
    name: "create_category",
    description:
      "Add a category — a part of their life to sort tasks by, such as a sport, a job or a " +
      "side project. Only when they describe something recurring that none of their existing " +
      "categories covers. Never create one to hold a single task.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: { ...STR, description: "Short, one or two words, in their own wording." },
      },
      required: ["name"],
    },
  },
  {
    name: "create_course",
    description:
      "Add a course. Only when the student is clearly taking a subject the hub does not know about.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: { ...STR, description: "Full name, e.g. 'Physics HL'." },
        code: { ...STR, description: "Short code for dense UI, 2-6 characters, e.g. 'PHYS'." },
        lessons: {
          type: "ARRAY",
          items: STR,
          description: "Topics within the course, if they mentioned any.",
        },
      },
      required: ["name", "code"],
    },
  },
  {
    name: "record_grade",
    description: "Record a result the student reports. Scores are percentages out of 100.",
    parameters: {
      type: "OBJECT",
      properties: {
        courseId: { ...STR, description: "Course id from the context." },
        assessment: { ...STR, description: "What it was, e.g. 'Paper 2 mock'." },
        type: enumOf(ASSESSMENT_TYPES, "Kind of assessment."),
        score: { type: "NUMBER", description: "Percentage, 0-100." },
        weight: {
          type: "NUMBER",
          description: "Percentage weight toward the course grade, if known.",
        },
        date: { ...STR, description: "YYYY-MM-DD. Defaults to today." },
      },
      required: ["courseId", "assessment", "type", "score"],
    },
  },
  {
    name: "add_university",
    description: "Add a university to the application list.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: STR,
        country: STR,
        city: STR,
        program: { ...STR, description: "Course or major they would apply to." },
        deadline: { ...STR, description: "YYYY-MM-DD application deadline, if known." },
        status: enumOf(UNI_STATUSES, "Defaults to 'interested'."),
        priority: enumOf(UNI_PRIORITIES, "dream / target / safety. Defaults to 'target'."),
        notes: STR,
      },
      required: ["name"],
    },
  },
  {
    name: "log_weight",
    description: "Record a weigh-in in kilograms.",
    parameters: {
      type: "OBJECT",
      properties: {
        weight: { type: "NUMBER", description: "Kilograms." },
        date: { ...STR, description: "YYYY-MM-DD. Defaults to today." },
      },
      required: ["weight"],
    },
  },
  {
    name: "append_reflection",
    description:
      "Add lines to a day's reflection journal. Use when the student is recounting how something went " +
      "and it is worth keeping. Never rewrite what is already there — this only appends.",
    parameters: {
      type: "OBJECT",
      properties: {
        lines: {
          type: "ARRAY",
          items: STR,
          description:
            "Each string becomes one paragraph, in the student's own voice where possible.",
        },
        date: { ...STR, description: "YYYY-MM-DD. Defaults to today." },
      },
      required: ["lines"],
    },
  },
  {
    name: "schedule",
    description:
      "Put something on a day's plan — a block of time, or an intention with no particular hour. " +
      "Use when the student says when they will do something, or asks you to plan their day. " +
      "Pass taskId when the block is time set aside for a task already on their list, so ticking " +
      "it finishes the task.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: { ...STR, description: "What they will be doing." },
        date: { ...STR, description: "YYYY-MM-DD. Defaults to today." },
        start: { ...STR, description: "HH:MM, 24-hour. Omit for something with no set time." },
        minutes: { type: "NUMBER", description: "How long. Defaults to 45." },
        taskId: {
          ...STR,
          description: "Task id from the context, when this block is that task.",
        },
        categoryId: { ...STR, description: "Category id from the context." },
      },
      required: ["title"],
    },
  },
  {
    name: "remember",
    description:
      "Record something durable you have learned about the student that is not already " +
      "visible in their data — how they work, what derails them, what they are aiming at. " +
      "Use it when a conversation reveals something that should change how their weeks are " +
      "planned from now on. Do not use it for one-off events, for anything that is already " +
      "a task, grade or deadline, or for what they are feeling right this minute.",
    parameters: {
      type: "OBJECT",
      properties: {
        topic: {
          ...STR,
          description: "Short grouping, e.g. 'Study habits', 'Stress signals', 'Goals'.",
        },
        note: {
          ...STR,
          description:
            "One specific sentence in the third person, true next month as well as today.",
        },
      },
      required: ["topic", "note"],
    },
  },
  {
    name: "navigate",
    description:
      "Open a page in the app. Use after acting, when the student would want to see the result, " +
      "or when they ask to be taken somewhere.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: enumOf(
          [
            "/",
            "/tasks",
            "/courses",
            "/grades",
            "/universities",
            "/weight",
            "/reflection",
            "/recommendations",
            "/settings",
          ],
          "Which page to open.",
        ),
      },
      required: ["path"],
    },
  },
] as const;

export type ToolName = (typeof TOOL_DECLARATIONS)[number]["name"];

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

/** What the model is told back after a tool runs, and what the UI shows. */
export interface ToolResult {
  ok: boolean;
  /** One line, written for the student to read in the transcript. */
  summary: string;
}
