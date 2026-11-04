import { AppData } from "./types";
import { addDays, todayISO } from "./dates";
import { appliesOn } from "./habits";
import { progressOf } from "./goals/tracker";

/**
 * Am I in my prime?
 *
 * One verdict from everything the hub can see, built so that no single number
 * can carry it. Six pillars, each scored 0–100 from the last two weeks:
 *
 *  - Execution: of what you planned and promised, how much got done — plan
 *    blocks ticked, habits kept per opportunity, tasks finished, and a penalty
 *    for a growing overdue pile.
 *  - Consistency: how many days you showed up at all, how long the current run
 *    is, and how evenly the work is spread (three huge days and eleven empty
 *    ones is not a rhythm).
 *  - Momentum: this week against last week on the same measures. Rising from
 *    a low place counts for something; falling from a high one is a warning.
 *  - Mind: what the journal says — how often you write, how much, and the tone
 *    of the words (a small bilingual lexicon: proud, calm, alhamdulillah… vs
 *    tired, anxious, lazy, failed…), weighted towards the last few days.
 *  - Body: whether you weigh in and whether the trend moves the way your weight
 *    goal wants; with no weight goal, stability is the healthy reading.
 *  - Goals: active goals' progress against how much of their time has passed —
 *    on pace beats far along.
 *
 * Pillars without data are left out rather than scored as zero. They're combined
 * with a weighted mean, then two rules make the result "all factors" rather than
 * an average that one strong area can carry:
 *
 *  - The weakest pillar drags: the score is pulled towards it in proportion to
 *    how far below the rest it sits. A great week of habits does not make up
 *    for a journal full of despair and a pile of overdue work.
 *  - Ranks have floors. Prime needs every pillar at 60+ and momentum not
 *    falling; Locked In needs every pillar at 40+. Anti-Prime needs most
 *    pillars collapsing at once, not just a low average.
 */

export type RankKey = "prime" | "locked" | "rising" | "drifting" | "slump" | "anti";

export interface Rank {
  key: RankKey;
  name: string;
  /** One line, in a mate's voice. */
  line: string;
  color: string;
  min: number;
}

export const RANKS: Rank[] = [
  { key: "prime", name: "Prime", line: "This is you at your best. Everything's firing — protect it.", color: "var(--up)", min: 80 },
  { key: "locked", name: "Locked In", line: "Strong and steady. A couple of things away from your prime.", color: "var(--accent)", min: 65 },
  { key: "rising", name: "Cooking", line: "Something's on the stove. Fix the weak spot and you're climbing.", color: "var(--medium)", min: 50 },
  { key: "drifting", name: "Mid", line: "Not bad, not good. Pick a lane and lock back in.", color: "var(--high)", min: 36 },
  { key: "slump", name: "Cooked", line: "Rough stretch. Win one small thing today and climb out.", color: "var(--urgent)", min: 22 },
  { key: "anti", name: "Anti-Prime", line: "Everything's down at once. Reset: sleep, one habit, one task. That's it.", color: "#be123c", min: 0 },
];

export type PillarKey = "execution" | "consistency" | "momentum" | "mind" | "body" | "goals";

export interface Pillar {
  key: PillarKey;
  label: string;
  score: number | null;
  /** What it is based on, in plain words. */
  why: string;
  /** What would lift it, when it is the weak one. */
  fix: string;
}

export interface PrimeReading {
  score: number | null;
  rank: Rank | null;
  pillars: Pillar[];
  weakest: Pillar | null;
  strongest: Pillar | null;
  /** Same model run a week earlier, for "up from Mid". */
  previous: { score: number; rank: Rank } | null;
  /** Why it is not one rank higher, when a floor held it back. */
  heldBack: string | null;
  enoughData: boolean;
}

const WEIGHTS: Record<PillarKey, number> = {
  execution: 1.4,
  consistency: 1.2,
  mind: 1.1,
  momentum: 0.8,
  goals: 0.9,
  body: 0.6,
};

const WINDOW = 14;

export function primeReading(data: AppData, today = todayISO()): PrimeReading {
  const now = evaluate(data, addDays(today, -1));
  const before = evaluate(data, addDays(today, -8));
  return {
    ...now,
    previous: before.score != null && before.rank ? { score: before.score, rank: before.rank } : null,
  };
}

function evaluate(data: AppData, end: string): Omit<PrimeReading, "previous"> {
  const days = Array.from({ length: WINDOW }, (_, i) => addDays(end, -i)); // newest first
  const recent = days.slice(0, 7);
  const older = days.slice(7);

  const pillars: Pillar[] = [
    execution(data, days, end),
    consistency(data, days),
    momentum(data, recent, older),
    mind(data, days),
    body(data, days),
    goals(data, end),
  ];

  const used = pillars.filter((p) => p.score != null) as (Pillar & { score: number })[];
  const enoughData = used.length >= 3 && activeDays(data, days) >= 4;
  if (!enoughData) {
    return { score: null, rank: null, pillars, weakest: null, strongest: null, heldBack: null, enoughData };
  }

  const total = used.reduce((s, p) => s + WEIGHTS[p.key], 0);
  const mean = used.reduce((s, p) => s + p.score * WEIGHTS[p.key], 0) / total;

  // The weakest pillar drags the whole reading towards it.
  const sorted = [...used].sort((a, b) => a.score - b.score);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];
  const gap = Math.max(0, mean - weakest.score);
  let score = Math.round(mean - gap * 0.35);
  score = Math.max(0, Math.min(100, score));

  // Floors: a rank is only reachable when nothing is collapsing under it.
  let rank = RANKS.find((r) => score >= r.min) ?? RANKS[RANKS.length - 1];
  let heldBack: string | null = null;
  const lowest = weakest.score;
  const mom = used.find((p) => p.key === "momentum")?.score ?? 50;
  if (rank.key === "prime" && (lowest < 60 || mom < 40)) {
    rank = RANKS[1];
    heldBack = lowest < 60 ? `${weakest.label} is holding you out of Prime.` : "Your momentum is dipping — Prime needs it steady.";
  }
  if (rank.key === "locked" && lowest < 40) {
    rank = RANKS[2];
    heldBack = `${weakest.label} is too low for Locked In.`;
  }
  // Anti-Prime only when most of it is down, not just the average.
  if (rank.key === "anti" && used.filter((p) => p.score < 35).length < Math.ceil(used.length * 0.6)) {
    rank = RANKS[4];
  }

  return { score, rank, pillars, weakest, strongest, heldBack, enoughData };
}

/* ------------------------------------------------------------------------- */

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function dayOf(data: AppData, date: string) {
  return data.days.find((d) => d.date === date);
}

function written(data: AppData, date: string): string {
  const d = dayOf(data, date);
  return d ? d.reflection.filter((b) => b.type !== "image").map((b) => b.text).join(" ").trim() : "";
}

function activeOn(data: AppData, date: string): boolean {
  const d = dayOf(data, date);
  if (d?.weight != null || (d?.habitsDone.length ?? 0) > 0 || written(data, date) !== "") return true;
  if (data.plan.some((p) => p.date === date && p.done)) return true;
  return data.tasks.some((t) => t.completedAt?.slice(0, 10) === date);
}

function activeDays(data: AppData, days: string[]) {
  return days.filter((d) => activeOn(data, d)).length;
}

/** Done-rates for plan, habits and tasks over some days, each null when unused. */
function rates(data: AppData, days: string[]) {
  const set = new Set(days);
  const planned = data.plan.filter((p) => set.has(p.date));
  const plan = planned.length >= 2 ? planned.filter((p) => p.done).length / planned.length : null;

  let due = 0;
  let kept = 0;
  for (const date of days) {
    const hs = data.habits.filter((h) => h.archivedAt == null && appliesOn(h, date));
    due += hs.length;
    const done = dayOf(data, date)?.habitsDone ?? [];
    kept += hs.filter((h) => done.includes(h.id)).length;
  }
  const habits = due >= 2 ? kept / due : null;

  const finished = data.tasks.filter((t) => t.completedAt && set.has(t.completedAt.slice(0, 10))).length;
  const dueIn = data.tasks.filter((t) => t.dueDate && set.has(t.dueDate)).length;
  const tasks = data.tasks.length === 0 ? null : Math.min(1, finished / Math.max(1, Math.max(dueIn, days.length * 0.4)));

  return { plan, habits, tasks, planned: planned.length, finishedPlan: planned.filter((p) => p.done).length, due, kept, finished };
}

function avg(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function execution(data: AppData, days: string[], end: string): Pillar {
  const r = rates(data, days);
  const base = avg([r.plan, r.habits, r.tasks]);
  const overdue = data.tasks.filter((t) => t.status !== "completed" && t.dueDate != null && t.dueDate <= end).length;
  const penalty = Math.min(30, overdue * 5);
  const bits = [
    r.plan != null ? `${r.finishedPlan}/${r.planned} blocks` : null,
    r.habits != null ? `${r.kept}/${r.due} habits` : null,
    r.tasks != null ? `${r.finished} tasks done` : null,
    overdue > 0 ? `${overdue} overdue` : null,
  ].filter(Boolean);
  return {
    key: "execution",
    label: "Execution",
    score: base == null ? null : clamp(base * 100 - penalty),
    why: bits.length ? bits.join(" · ") : "Nothing planned or tracked yet",
    fix: overdue > 2 ? "Clear the overdue pile — even moving it to a real date counts." : "Plan fewer blocks and finish all of them.",
  };
}

function consistency(data: AppData, days: string[]): Pillar {
  const showed = activeDays(data, days);
  let run = 0;
  for (const d of days) {
    if (!activeOn(data, d)) break;
    run += 1;
  }
  // Evenness: share of active days in each week, penalising a lopsided fortnight.
  const a = activeDays(data, days.slice(0, 7));
  const b = activeDays(data, days.slice(7));
  const evenness = 1 - Math.abs(a - b) / 7;
  const score = (showed / days.length) * 70 + Math.min(run, 7) / 7 * 20 + evenness * 10;
  return {
    key: "consistency",
    label: "Consistency",
    score: clamp(score),
    why: `${showed}/${days.length} days active · ${run}-day run`,
    fix: "Show up daily, even small: one habit tick keeps the run alive.",
  };
}

function momentum(data: AppData, recent: string[], older: string[]): Pillar {
  const now = rates(data, recent);
  const then = rates(data, older);
  const a = avg([now.plan, now.habits, now.tasks, activeDays(data, recent) / 7]);
  const b = avg([then.plan, then.habits, then.tasks, activeDays(data, older) / 7]);
  if (a == null || b == null) return { key: "momentum", label: "Momentum", score: null, why: "Needs two weeks to compare", fix: "" };
  const diff = a - b; // -1..1
  return {
    key: "momentum",
    label: "Momentum",
    score: clamp(50 + diff * 120 + (a - 0.5) * 30),
    why: diff > 0.05 ? "This week beats last week" : diff < -0.05 ? "This week is behind last week" : "Holding level with last week",
    fix: "Beat last week by one thing — one more block, one more habit.",
  };
}

const GOOD = [
  "good", "great", "happy", "proud", "calm", "grateful", "alhamdulillah", "productive", "focused", "strong", "better",
  "progress", "achieved", "won", "energy", "motivated", "peace", "love", "fun", "confident", "improved", "discipline",
  "хорошо", "отлично", "рад", "счастлив", "горжусь", "спокойн", "продуктивн", "сильн", "лучше", "успел", "получилось",
];
const BAD = [
  "tired", "sad", "anxious", "stress", "stressed", "lazy", "failed", "fail", "bad", "worse", "angry", "lonely", "depressed",
  "exhausted", "burnout", "wasted", "procrastinat", "scared", "hopeless", "crying", "cried", "sick", "overwhelmed", "relapse",
  "устал", "грустн", "тревог", "стресс", "ленив", "провал", "плохо", "хуже", "злой", "одинок", "выгор", "страшно", "болею",
];

function tone(text: string): number | null {
  const t = text.toLowerCase();
  let g = 0;
  let b = 0;
  for (const w of GOOD) if (t.includes(w)) g += 1;
  for (const w of BAD) if (t.includes(w)) b += 1;
  if (g + b === 0) return null;
  return (g - b) / (g + b); // -1..1
}

function mind(data: AppData, days: string[]): Pillar {
  const entries = days.map((d, i) => ({ text: written(data, d), i })).filter((e) => e.text !== "");
  if (!data.days.some((d) => d.reflection.some((b) => b.text.trim() !== ""))) {
    return { key: "mind", label: "Mind", score: null, why: "No journal yet", fix: "Write three lines tonight." };
  }
  const freq = entries.length / days.length;
  const words = entries.reduce((s, e) => s + e.text.split(/\s+/).length, 0) / Math.max(1, entries.length);
  const depth = Math.min(1, words / 120);
  // Recent entries count more.
  let tw = 0;
  let ts = 0;
  for (const e of entries) {
    const s = tone(e.text);
    if (s == null) continue;
    const w = 1 / (1 + e.i * 0.3);
    ts += s * w;
    tw += w;
  }
  const mood = tw ? ts / tw : 0;
  const score = freq * 40 + depth * 20 + (mood + 1) / 2 * 40;
  return {
    key: "mind",
    label: "Mind",
    score: clamp(score),
    why: `${entries.length} entries · tone ${mood > 0.2 ? "positive" : mood < -0.2 ? "heavy" : "mixed"}`,
    fix: mood < -0.2 ? "Heavy few days. Write what's weighing on you — then one thing you're grateful for." : "Write more often, even a few lines.",
  };
}

function body(data: AppData, days: string[]): Pillar {
  if (!data.days.some((d) => d.weight != null)) return { key: "body", label: "Body", score: null, why: "No weigh-ins", fix: "" };
  const set = new Set(days);
  const w = data.days.filter((d) => d.weight != null && set.has(d.date)).sort((a, b) => a.date.localeCompare(b.date));
  const regular = Math.min(1, w.length / 7);
  const goal = data.goals.find((g) => g.status === "active" && g.tracker?.source === "weight");
  let dir = 0.5;
  let why = `${w.length} weigh-ins`;
  if (w.length >= 2) {
    const change = (w[w.length - 1].weight as number) - (w[0].weight as number);
    if (goal?.tracker) {
      const want = Math.sign(goal.tracker.target - (w[0].weight as number));
      dir = Math.abs(change) < 0.2 ? 0.45 : Math.sign(change) === want ? Math.min(1, 0.65 + Math.abs(change) * 0.15) : 0.15;
      why += ` · ${change > 0 ? "+" : ""}${change.toFixed(1)} kg ${Math.sign(change) === want ? "towards" : "away from"} goal`;
    } else {
      dir = Math.abs(change) < 1 ? 0.8 : 0.5;
      why += ` · ${change > 0 ? "+" : ""}${change.toFixed(1)} kg`;
    }
  }
  return {
    key: "body",
    label: "Body",
    score: clamp(regular * 40 + dir * 60),
    why,
    fix: "Weigh in most mornings and keep the trend moving the right way.",
  };
}

function goals(data: AppData, end: string): Pillar {
  const active = data.goals.filter((g) => g.status === "active");
  const recentWins = data.goals.filter((g) => g.achievedAt && g.achievedAt.slice(0, 10) >= addDays(end, -30)).length;
  const scores: number[] = [];
  for (const g of active) {
    const { value } = progressOf(g, data, end);
    if (value == null) continue;
    let expected = 0.5;
    if (g.deadline) {
      const start = Date.parse(g.createdAt.slice(0, 10));
      const stop = Date.parse(g.deadline);
      const now = Date.parse(end);
      expected = stop > start ? Math.max(0.05, Math.min(1, (now - start) / (stop - start))) : 1;
    }
    const pace = value / 100 / expected; // 1 = on pace
    scores.push(Math.min(1, pace) * 80 + (value / 100) * 20);
  }
  // A goal closed as missed in the last month counts against you.
  const recentMisses = data.goals.filter(
    (g) => g.status === "missed" && g.deadline != null && g.deadline >= addDays(end, -30),
  ).length;
  if (scores.length === 0 && recentWins === 0 && recentMisses === 0) return { key: "goals", label: "Goals", score: null, why: "No tracked goals", fix: "" };
  const base = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 70;
  return {
    key: "goals",
    label: "Goals",
    score: clamp(base + recentWins * 8 - recentMisses * 15),
    why: `${scores.length} tracked${recentWins ? ` · ${recentWins} achieved this month` : ""}${recentMisses ? ` · ${recentMisses} missed` : ""}`,
    fix: "Pick the goal furthest behind pace and do one thing for it today.",
  };
}
