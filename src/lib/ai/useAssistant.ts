"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { todayISO } from "@/lib/dates";
import { COURSE_COLORS } from "@/lib/appearance";
import { play } from "@/lib/sound";
import { buildContext } from "./context";
import { ToolCall, ToolResult } from "./tools";
import {
  ASSESSMENT_TYPES,
  AssessmentType,
  Block,
  Priority,
  PRIORITIES,
  Status,
  STATUSES,
  UNI_PRIORITIES,
  UNI_STATUSES,
  UniPriority,
  UniStatus,
} from "@/lib/types";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** What the assistant did on this turn, shown as chips under the reply. */
  actions?: ToolResult[];
}

/**
 * A Gemini `Content`. Kept separate from `Message` because the wire format
 * carries tool calls and their results, which the transcript must not render.
 */
interface Content {
  role: "user" | "model";
  parts: Part[];
}

/**
 * Model parts are replayed exactly as they arrived, never rebuilt.
 *
 * Gemini 3 attaches an opaque `thoughtSignature` to the parts it reasons with,
 * and rejects a follow-up request whose function calls have lost theirs — so
 * the transcript keeps whatever came back, including fields this code has no
 * opinion about.
 */
type Part = Record<string, unknown>;

/** Stops a misunderstanding turning into an unbounded chain of writes. */
const MAX_TOOL_ROUNDS = 4;

export function useAssistant() {
  const store = useStore();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The wire transcript lives in a ref, not state: it changes on every tool
  // round and nothing renders it, so re-rendering on each mutation would only
  // cost frames mid-conversation.
  const wire = useRef<Content[]>([]);

  const run = useCallback(
    async (
      contents: Content[],
    ): Promise<{ parts: Part[]; text: string; calls: ToolCall[] }> => {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents, context: buildContext(store) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "The assistant is unavailable.");
      return { parts: data.parts ?? [], text: data.text ?? "", calls: data.calls ?? [] };
    },
    [store],
  );

  const send = useCallback(
    async (input: string) => {
      const text = input.trim();
      if (text === "" || pending) return;

      setError(null);
      setPending(true);
      setMessages((m) => [...m, { id: uid(), role: "user", text }]);
      wire.current.push({ role: "user", parts: [{ text }] });

      const actions: ToolResult[] = [];
      try {
        let round = 0;
        for (;;) {
          const { parts, text: reply, calls } = await run(wire.current);

          if (calls.length === 0) {
            wire.current.push({ role: "model", parts });
            // The reply is the only thing here the student is waiting on, so
            // it is the only arrival worth a sound — tool rounds pass silently.
            void play("receive");
            setMessages((m) => [
              ...m,
              {
                id: uid(),
                role: "assistant",
                text: reply,
                actions: actions.length > 0 ? actions : undefined,
              },
            ]);
            return;
          }

          // The whole model turn goes back untouched — commentary, reasoning
          // and calls alike — so the signatures survive into the next request.
          wire.current.push({ role: "model", parts });

          if (round >= MAX_TOOL_ROUNDS) {
            throw new Error("The assistant got stuck repeating itself. Try rephrasing.");
          }
          round += 1;

          const results = calls.map((call) => {
            const result = runTool(call, store, router);
            actions.push(result);
            // The link is for the chip in the transcript, not for the model:
            // it has `navigate` for going places, and a URL in the response
            // only invites it to describe one in prose.
            return {
              functionResponse: {
                name: call.name,
                response: { ok: result.ok, summary: result.summary },
              },
            };
          });
          wire.current.push({ role: "user", parts: results });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        void play("error");
        // The failed turn is dropped from the wire transcript, so a retry does
        // not resend a conversation that ended mid-tool-call.
        wire.current = wire.current.slice(0, lastPlainUserTurn(wire.current));
      } finally {
        setPending(false);
      }
    },
    [pending, run, store, router],
  );

  const reset = useCallback(() => {
    wire.current = [];
    setMessages([]);
    setError(null);
  }, []);

  return { messages, pending, error, send, reset };
}

/* -------------------------------------------------------------------------
   Tool execution
   -------------------------------------------------------------------------
   Every write the assistant makes goes through the same store mutators the
   UI uses, so a change it makes is indistinguishable from one the student
   made by hand — same validation, same cloud sync, same everything.

   Arguments arrive from a language model, so nothing is trusted: enums are
   checked against the real unions and ids against the real collections. An
   unknown value fails the call rather than writing something the rest of the
   app cannot render.
------------------------------------------------------------------------- */

type Store = ReturnType<typeof useStore>;
type Router = ReturnType<typeof useRouter>;

const PAGES = [
  "/",
  "/tasks",
  "/courses",
  "/grades",
  "/universities",
  "/weight",
  "/reflection",
  "/recommendations",
  "/settings",
];

function runTool(call: ToolCall, store: Store, router: Router): ToolResult {
  const a = call.args;
  try {
    switch (call.name) {
      case "create_task": {
        const title = str(a.title);
        if (!title) return fail("A task needs a title.");
        const courseId = optionalCourse(a.courseId, store);
        if (courseId === INVALID) return fail("That course is not in the hub.");

        const categoryId = optionalCategory(a.categoryId, store);
        if (categoryId === INVALID) return fail("That category is not in the hub.");

        const due = date(a.dueDate);
        store.addTask({
          title,
          courseId,
          categoryId,
          lesson: str(a.lesson),
          dueDate: due,
          dueTime: time(a.dueTime),
          priority: oneOf(a.priority, PRIORITIES, "medium") as Priority,
          status: "not_started",
          notes: str(a.notes) ?? "",
        });
        return ok(`Added "${title}"${due ? ` — due ${due}` : ""}`, "/tasks");
      }

      case "update_task": {
        const task = store.tasks.find((t) => t.id === str(a.id));
        if (!task) return fail("No task with that id.");

        const patch: Record<string, unknown> = {};
        if (str(a.title)) patch.title = str(a.title);
        if (a.dueDate !== undefined)
          patch.dueDate = a.dueDate === "none" ? null : date(a.dueDate);
        if (a.dueTime !== undefined)
          patch.dueTime = a.dueTime === "none" ? null : time(a.dueTime);
        if (a.priority !== undefined)
          patch.priority = oneOf(a.priority, PRIORITIES, task.priority);
        if (a.notes !== undefined) patch.notes = str(a.notes) ?? "";
        if (a.courseId !== undefined) {
          const courseId = optionalCourse(a.courseId, store);
          if (courseId === INVALID) return fail("That course is not in the hub.");
          patch.courseId = courseId;
        }
        if (a.categoryId !== undefined) {
          if (a.categoryId === "none") {
            patch.categoryId = null;
          } else {
            const categoryId = optionalCategory(a.categoryId, store);
            if (categoryId === INVALID) return fail("That category is not in the hub.");
            patch.categoryId = categoryId;
          }
        }

        const status =
          a.status === undefined
            ? undefined
            : (oneOf(a.status, STATUSES, task.status) as Status);
        if (status !== undefined && status !== "completed") patch.status = status;

        if (Object.keys(patch).length === 0 && status === undefined) {
          return fail("Nothing to change.");
        }

        if (Object.keys(patch).length > 0) store.updateTask(task.id, patch);

        // completedAt is the store's business, so completion routes through
        // toggleTask rather than being written straight into the patch.
        if (status === "completed" && task.status !== "completed") {
          store.toggleTask(task.id);
          return ok(`Completed "${task.title}"`, "/tasks");
        }

        return ok(`Updated "${task.title}"`, "/tasks");
      }

      case "complete_task": {
        const task = store.tasks.find((t) => t.id === str(a.id));
        if (!task) return fail("No task with that id.");
        if (task.status === "completed")
          return ok(`"${task.title}" was already done`, "/tasks");
        store.toggleTask(task.id);
        return ok(`Completed "${task.title}"`, "/tasks");
      }

      case "create_category": {
        const name = str(a.name);
        if (!name) return fail("A category needs a name.");
        if (store.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
          return ok(`You already have a "${name}" category`);
        }
        // The palette is shared with courses; cycling keeps a new category
        // from landing on the same colour as the last one.
        const color = COURSE_COLORS[store.categories.length % COURSE_COLORS.length].id;
        store.addCategory({ name, color });
        return ok(`Added the "${name}" category`);
      }

      case "create_course": {
        const name = str(a.name);
        const code = str(a.code);
        if (!name || !code) return fail("A course needs a name and a code.");
        store.addCourse({
          name,
          code: code.toUpperCase().slice(0, 6),
          color: "violet",
          lessons: strings(a.lessons),
        });
        return ok(`Added course ${name}`, "/courses");
      }

      case "record_grade": {
        const course = store.courses.find((c) => c.id === str(a.courseId));
        if (!course) return fail("That course is not in the hub.");
        const score = num(a.score);
        if (score == null || score < 0 || score > 100) return fail("A score must be 0-100.");
        const assessment = str(a.assessment);
        if (!assessment) return fail("A grade needs a name.");

        store.addGrade({
          courseId: course.id,
          assessment,
          type: oneOf(a.type, ASSESSMENT_TYPES, "Other") as AssessmentType,
          score,
          weight: num(a.weight),
          date: date(a.date) ?? todayISO(),
        });
        return ok(`Recorded ${assessment} — ${score}% in ${course.name}`, "/school");
      }

      case "add_university": {
        const name = str(a.name);
        if (!name) return fail("A university needs a name.");
        store.addUniversity({
          name,
          country: str(a.country) ?? "",
          flag: "",
          city: str(a.city) ?? "",
          program: str(a.program) ?? "",
          deadline: date(a.deadline),
          status: oneOf(a.status, UNI_STATUSES, "interested") as UniStatus,
          priority: oneOf(a.priority, UNI_PRIORITIES, "target") as UniPriority,
          notes: str(a.notes) ?? "",
          website: "",
        });
        return ok(`Added ${name} to your university list`, "/universities");
      }

      case "log_weight": {
        const weight = num(a.weight);
        if (weight == null || weight <= 0 || weight > 500) {
          return fail("That weight is out of range.");
        }
        const when = date(a.date) ?? todayISO();
        store.setDay(when, { weight });
        return ok(`Logged ${weight}kg for ${when}`, "/weight");
      }

      case "append_reflection": {
        const lines = strings(a.lines).filter((l) => l.trim() !== "");
        if (lines.length === 0) return fail("Nothing to write.");
        const when = date(a.date) ?? todayISO();
        const existing = store.days.find((d) => d.date === when)?.reflection ?? [];
        const added: Block[] = lines.map((text) => ({
          id: uid(),
          type: "text",
          text,
          done: false,
        }));
        store.setDay(when, { reflection: [...existing, ...added] });
        return ok(
          `Added ${lines.length === 1 ? "a note" : `${lines.length} notes`} to ${when}`,
          "/reflection",
        );
      }

      case "schedule": {
        const title = str(a.title);
        if (!title) return fail("A plan item needs a title.");

        const categoryId = optionalCategory(a.categoryId, store);
        if (categoryId === INVALID) return fail("That category is not in the hub.");

        const taskId = str(a.taskId);
        const task = taskId ? store.tasks.find((t) => t.id === taskId) : null;
        if (taskId && !task) return fail("No task with that id.");

        const when = date(a.date) ?? todayISO();
        const start = time(a.start);
        const minutes = Math.min(24 * 60, Math.max(5, num(a.minutes) ?? 45));

        store.addPlanItem({
          date: when,
          title,
          start,
          minutes,
          done: false,
          priority: oneOf(a.priority, PRIORITIES, task?.priority ?? "medium") as Priority,
          // A block standing in for a task inherits its category, so the plan
          // is coloured the same way the task list is.
          categoryId: categoryId ?? task?.categoryId ?? null,
          taskId: task?.id ?? null,
        });
        return ok(`Planned "${title}"${start ? ` at ${start}` : ""} on ${when}`, "/plan");
      }

      case "remember": {
        const note = str(a.note);
        if (!note) return fail("Nothing to remember.");
        const topic = str(a.topic) ?? "General";

        // A near-duplicate is an update, not a second note: the same
        // observation arriving twice should sharpen the memory, not pad it.
        const now = new Date().toISOString();
        const existing = store.memory.find(
          (n) => n.topic.toLowerCase() === topic.toLowerCase() && similar(n.note, note),
        );
        if (existing) {
          if (existing.pinned) return ok("Already noted");
          store.updateMemoryNote(existing.id, { note, updatedAt: now });
          return ok(`Updated what I know about ${topic.toLowerCase()}`);
        }

        store.setMemory([
          ...store.memory,
          {
            id: uid(),
            topic,
            note,
            source: "conversation",
            createdAt: now,
            updatedAt: now,
            pinned: false,
          },
        ]);
        return ok(`Noted — ${note}`, "/settings");
      }

      case "navigate": {
        const path = str(a.path);
        if (!path || !PAGES.includes(path)) return fail("Unknown page.");
        router.push(path);
        return ok(`Opened ${path === "/" ? "the dashboard" : path.slice(1)}`);
      }

      default:
        return fail(`Unknown action "${call.name}".`);
    }
  } catch {
    return fail("That action failed.");
  }
}

function ok(summary: string, href?: string): ToolResult {
  return { ok: true, summary, href };
}

function fail(summary: string): ToolResult {
  return { ok: false, summary };
}

/* Coercion. Gemini sends JSON, but the schema is advisory: a string field can
   still arrive as a number, and an enum as something invented. */

const INVALID = Symbol("invalid");

/**
 * Whether two notes are the same observation worded differently.
 *
 * A word-overlap ratio rather than anything cleverer: it only has to catch
 * "Works best in the morning" against "Works best early in the morning", and
 * a false negative just means one extra note the student can delete.
 */
function similar(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );
  const x = words(a);
  const y = words(b);
  if (x.size === 0 || y.size === 0) return false;

  let shared = 0;
  for (const w of x) if (y.has(w)) shared += 1;
  return shared / Math.min(x.size, y.size) >= 0.6;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function date(v: unknown): string | null {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function time(v: unknown): string | null {
  const s = str(v);
  return s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  const s = str(v);
  return s && (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

/** null means "no category"; INVALID means the model named one that does not exist. */
function optionalCategory(v: unknown, store: Store): string | null | typeof INVALID {
  const id = str(v);
  if (!id) return null;
  return store.categories.some((c) => c.id === id) ? id : INVALID;
}

/** null means "no course"; INVALID means the model named one that does not exist. */
function optionalCourse(v: unknown, store: Store): string | null | typeof INVALID {
  const id = str(v);
  if (!id) return null;
  return store.courses.some((c) => c.id === id) ? id : INVALID;
}

/** Where to rewind to when a turn fails partway through a tool exchange. */
function lastPlainUserTurn(contents: Content[]): number {
  for (let i = contents.length - 1; i >= 0; i -= 1) {
    if (contents[i].role === "user" && contents[i].parts.some((p) => "text" in p)) return i;
  }
  return 0;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
