import { Course, Priority } from "./types";
import { addDays, todayISO, toISO, fromISO } from "./dates";

export interface ParsedTask {
  title: string;
  courseId: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: Priority;
  /** Which fields the parser actually found, for highlighting in the UI. */
  matched: { course: boolean; date: boolean; time: boolean; priority: boolean };
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const PRIORITY_WORDS: [RegExp, Priority][] = [
  [/\b(urgent|asap|critical|emergency)\b/i, "urgent"],
  [/\b(high priority|important|high-priority|very important)\b/i, "high"],
  [/\b(medium priority|normal priority|medium)\b/i, "medium"],
  [/\b(low priority|whenever|no rush|low-priority)\b/i, "low"],
];

/**
 * Extracts structured task fields from a sentence like
 * "Finish physics worksheet tomorrow at 5pm, high priority".
 *
 * Every matched phrase is stripped from the title so the saved task reads
 * cleanly. The caller always shows the result for editing before saving.
 */
export function parseQuickAdd(input: string, courses: Course[]): ParsedTask {
  let text = ` ${input.trim()} `;
  const matched = { course: false, date: false, time: false, priority: false };

  // Priority
  let priority: Priority = "medium";
  for (const [re, p] of PRIORITY_WORDS) {
    const m = text.match(re);
    if (m) {
      priority = p;
      matched.priority = true;
      text = text.replace(re, " ");
      break;
    }
  }

  // Course — try full names first, then codes and distinctive single words so
  // "physics" matches "Physics SL" without "SL" alone matching anything.
  let courseId: string | null = null;
  for (const c of courses) {
    const candidates = [c.name, c.code, ...significantWords(c.name)];
    for (const cand of candidates) {
      if (cand.length < 3) continue;
      const re = new RegExp(`\\b${escapeRe(cand)}\\b`, "i");
      if (re.test(text)) {
        courseId = c.id;
        matched.course = true;
        // Only strip a full course name; a bare topic word is often part of
        // the title itself ("finish physics worksheet").
        if (cand.toLowerCase() === c.name.toLowerCase()) text = text.replace(re, " ");
        break;
      }
    }
    if (courseId) break;
  }

  // Time — "at 5pm", "17:30", "5:30 pm"
  let dueTime: string | null = null;
  const timeRe =
    /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(?:at\s+)?(\d{1,2}):(\d{2})\b/i;
  const tm = text.match(timeRe);
  if (tm) {
    if (tm[1]) {
      let h = parseInt(tm[1], 10) % 12;
      if (tm[3].toLowerCase() === "pm") h += 12;
      dueTime = `${`${h}`.padStart(2, "0")}:${tm[2] ?? "00"}`;
    } else {
      dueTime = `${tm[4].padStart(2, "0")}:${tm[5]}`;
    }
    matched.time = true;
    text = text.replace(timeRe, " ");
  }

  // Date
  const date = extractDate(text);
  let dueDate: string | null = null;
  if (date) {
    dueDate = date.iso;
    matched.date = true;
    text = text.replace(date.matchedText, " ");
  }

  const title = cleanTitle(text);

  return { title, courseId, dueDate, dueTime, priority, matched };
}

interface DateMatch {
  iso: string;
  matchedText: string;
}

function extractDate(text: string): DateMatch | null {
  const today = todayISO();

  const simple: [RegExp, () => string][] = [
    [/\btoday\b/i, () => today],
    [/\btomorrow\b/i, () => addDays(today, 1)],
    [/\bday after tomorrow\b/i, () => addDays(today, 2)],
    [/\btonight\b/i, () => today],
    [/\bnext week\b/i, () => addDays(today, 7)],
    [/\bin (\d+) days?\b/i, () => today], // replaced below with the real offset
  ];

  const inDays = text.match(/\bin (\d+) days?\b/i);
  if (inDays) {
    return { iso: addDays(today, parseInt(inDays[1], 10)), matchedText: inDays[0] };
  }

  for (const [re, resolve] of simple) {
    const m = text.match(re);
    if (m) return { iso: resolve(), matchedText: m[0] };
  }

  // "friday" / "this friday" / "next friday" — all mean the next occurrence,
  // never today. "Next Friday" is ambiguous in ordinary speech (this coming
  // one, or the one after?), and the nearer reading is the safer default for a
  // deadline: an early reminder costs less than a missed one.
  const wd = text.match(
    /\b(?:(next|this)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[2].toLowerCase());
    const current = fromISO(today).getDay();
    const delta = (target - current + 7) % 7 || 7;
    return { iso: addDays(today, delta), matchedText: wd[0] };
  }

  // "Sep 18" / "18 September" / "on September 18th"
  const md = text.match(
    /\b(?:on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
  );
  if (md) {
    const month = MONTHS.findIndex((m) => m.startsWith(md[1].toLowerCase()));
    return { iso: resolveMonthDay(month, parseInt(md[2], 10)), matchedText: md[0] };
  }

  const dm = text.match(
    /\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i,
  );
  if (dm) {
    const month = MONTHS.findIndex((m) => m.startsWith(dm[2].toLowerCase()));
    return { iso: resolveMonthDay(month, parseInt(dm[1], 10)), matchedText: dm[0] };
  }

  return null;
}

/** A month/day with no year means the next time that date comes around. */
function resolveMonthDay(month: number, day: number): string {
  const now = new Date();
  let candidate = new Date(now.getFullYear(), month, day);
  if (toISO(candidate) < todayISO()) {
    candidate = new Date(now.getFullYear() + 1, month, day);
  }
  return toISO(candidate);
}

/**
 * Tidies what is left after the matched phrases are cut out.
 *
 * Removing "friday" from "finish the lab by friday, it's important" strands a
 * "by" in the middle of the remaining text, so the trailing-word pass runs
 * repeatedly and only after punctuation and filler have gone — one pass in the
 * wrong order leaves "Finish the lab by".
 */
function cleanTitle(text: string): string {
  let cleaned = text.replace(/[,;]+/g, " ").replace(/\s+/g, " ").trim();

  const trailing = /\s+(by|due|on|at|before|and|it's|its|is)$/i;
  const leading = /^(and|it's|its)\s+/i;

  for (let i = 0; i < 4; i++) {
    const next = cleaned.replace(leading, "").replace(trailing, "").trim();
    if (next === cleaned) break;
    cleaned = next;
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function significantWords(name: string): string[] {
  // "Math AA HL" -> ["Math"]; level markers carry no identity on their own.
  const skip = new Set(["hl", "sl", "aa", "ai", "ib", "a", "b"]);
  return name.split(/\s+/).filter((w) => !skip.has(w.toLowerCase()));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
