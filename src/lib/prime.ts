import { AppData, Goal, Priority } from "./types";
import { addDays, todayISO } from "./dates";
import { appliesOn } from "./habits";
import { progressOf } from "./goals/tracker";

/**
 * Am I in my prime?
 *
 * One verdict from everything the hub can see, built so that no single number
 * can carry it. Six pillars, each 0–100, read from the two weeks ending
 * yesterday (today is still being lived), with the last seven days counting
 * more than the seven before:
 *
 *  - Execution: of what you planned and promised, how much got done. Plan
 *    blocks ticked, habits kept per day they were due, tasks finished by their
 *    due date (late counts for less), minus a penalty for overdue work that
 *    grows with how long it has been sitting there.
 *  - Consistency: how many days you showed up at all, how long the current run
 *    is, and how evenly it is spread across the two weeks.
 *  - Momentum: direction, not level. Last 7 days against the 7 before, on the
 *    same measures. You can be Mid and rising, or Locked In and slipping.
 *  - Mind: the journal. How often, how deep, and the tone of the words, from
 *    a bilingual lexicon that understands "not tired" / "не устал".
 *  - Body: weigh-in regularity and the trend line (a fitted slope, not two
 *    noisy days), judged against the weight goal at a healthy pace.
 *  - Goals: see `goals()` below. Pace against the deadline, whether each goal
 *    actually moved lately, priority, and recent wins and misses, fading out.
 *
 * Small samples are pulled towards a neutral prior, so two ticked blocks are
 * not "100%". Missing pillars are left out, not scored as zero. Then three
 * rules make the result about everything at once:
 *
 *  - The weakest pillar drags the score towards it.
 *  - Ranks have floors: Prime needs every pillar 60+ and momentum not falling;
 *    Locked In needs every pillar 40+. Anti-Prime needs most pillars down.
 *  - Hysteresis: a score wobbling a point either side of a boundary keeps
 *    yesterday's rank, so the badge does not flicker day to day.
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
  goals: 1.0,
  body: 0.6,
};

const WINDOW = 14;
/** How far either side of a boundary yesterday's rank still holds. */
const STICKY = 2;

export type Evaluated = Omit<PrimeReading, "previous">;

export function primeReading(data: AppData, today = todayISO()): PrimeReading {
  const now = evaluate(data, addDays(today, -1));
  const yesterday = evaluate(data, addDays(today, -2));
  const before = evaluate(data, addDays(today, -8));
  const settled = stick(now, yesterday);
  return {
    ...settled,
    previous: before.score != null && before.rank ? { score: before.score, rank: before.rank } : null,
  };
}

/** Keep yesterday's rank when today's score only just crossed into a neighbour. */
function stick(now: Evaluated, prev: Evaluated): Evaluated {
  if (!now.rank || !prev.rank || now.score == null || now.heldBack) return now;
  const i = RANKS.indexOf(now.rank);
  const j = RANKS.indexOf(prev.rank);
  if (Math.abs(i - j) !== 1) return now;
  // Dropped one rank: hold the higher one while within STICKY of its floor.
  if (j < i && now.score >= prev.rank.min - STICKY) return { ...now, rank: prev.rank };
  // Rose one rank: only take it once clearly past the line.
  if (j > i && now.score < now.rank.min + STICKY) return { ...now, rank: prev.rank };
  return now;
}

function evaluate(data: AppData, end: string): Evaluated {
  const days = Array.from({ length: WINDOW }, (_, i) => addDays(end, -i)); // newest first
  return evaluateDays(data, days, days.slice(0, 7), days.slice(7), end, 4);
}

/**
 * The same model over any stretch of days, for reports: the whole period is
 * judged, and momentum compares it with the stretch of equal length before it.
 * A short period asks for less evidence before it will name a rank.
 */
export function periodReading(data: AppData, from: string, to: string): Evaluated {
  const days: string[] = [];
  for (let d = to; d >= from; d = addDays(d, -1)) days.push(d);
  const older = days.map((_, i) => addDays(from, -(i + 1)));
  return evaluateDays(data, days, days, older, to, Math.max(2, Math.round(days.length * 0.3)));
}

function evaluateDays(
  data: AppData,
  days: string[],
  recent: string[],
  older: string[],
  end: string,
  minActive: number,
): Evaluated {

  const pillars: Pillar[] = [
    execution(data, days, end),
    consistency(data, days),
    momentum(data, recent, older),
    mind(data, days),
    body(data, days),
    goals(data, end),
  ];

  const used = pillars.filter((p) => p.score != null) as (Pillar & { score: number })[];
  const enoughData = used.length >= 3 && activeDays(data, days) >= minActive;
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
  const score = clamp(mean - gap * 0.35);

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

/**
 * A rate that does not overreact to a handful of samples: `prior` acts like
 * `k` imaginary observations. 2 of 2 reads ~0.81, 20 of 20 reads ~0.97.
 */
function smooth(hit: number, total: number, prior = 0.6, k = 3): number {
  return (hit + prior * k) / (total + k);
}

/** Days 0–6 back count fully; the older week counts 60%. */
function recency(i: number) {
  return i < 7 ? 1 : 0.6;
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

interface Rates {
  plan: number | null;
  habits: number | null;
  tasks: number | null;
  planned: number;
  finishedPlan: number;
  due: number;
  kept: number;
  tasksDue: number;
  onTime: number;
  late: number;
}

/**
 * Done-rates for plan, habits and tasks over some days (newest first), each
 * null when there was nothing to do. Recent days weigh more; small samples are
 * smoothed.
 */
function rates(data: AppData, days: string[]): Rates {
  let pw = 0, ph = 0, planned = 0, finishedPlan = 0;
  let hw = 0, hh = 0, due = 0, kept = 0;
  days.forEach((date, i) => {
    const w = recency(i);
    for (const p of data.plan) {
      if (p.date !== date) continue;
      planned += 1;
      pw += w;
      if (p.done) {
        finishedPlan += 1;
        ph += w;
      }
    }
    const done = dayOf(data, date)?.habitsDone ?? [];
    for (const h of data.habits) {
      if (!appliesOn(h, date)) continue;
      due += 1;
      hw += w;
      if (done.includes(h.id)) {
        kept += 1;
        hh += w;
      }
    }
  });

  // Tasks that fell due in the window: on time counts 1, late 0.6, open 0.
  const set = new Set(days);
  let tw = 0, th = 0, tasksDue = 0, onTime = 0, late = 0;
  for (const t of data.tasks) {
    if (!t.dueDate || !set.has(t.dueDate)) continue;
    const w = recency(days.indexOf(t.dueDate));
    tasksDue += 1;
    tw += w;
    const doneOn = t.completedAt?.slice(0, 10);
    if (t.status === "completed" && doneOn) {
      if (doneOn <= t.dueDate) {
        onTime += 1;
        th += w;
      } else {
        late += 1;
        th += w * 0.6;
      }
    }
  }

  return {
    plan: planned > 0 ? smooth(ph, pw) : null,
    habits: due > 0 ? smooth(hh, hw) : null,
    tasks: tasksDue > 0 ? smooth(th, tw) : null,
    planned, finishedPlan, due, kept, tasksDue, onTime, late,
  };
}

/** Mean weighted by how much evidence is behind each part. */
function weighted(parts: [number | null, number][]): number | null {
  let s = 0, w = 0;
  for (const [v, n] of parts) {
    if (v == null) continue;
    const k = Math.sqrt(Math.max(1, n));
    s += v * k;
    w += k;
  }
  return w ? s / w : null;
}

function execution(data: AppData, days: string[], end: string): Pillar {
  const r = rates(data, days);
  const base = weighted([[r.plan, r.planned], [r.habits, r.due], [r.tasks, r.tasksDue]]);
  // Overdue work hurts more the longer it sits: 3 pts fresh, up to 7 after two weeks.
  const overdue = data.tasks.filter((t) => t.status !== "completed" && t.dueDate != null && t.dueDate <= end);
  const penalty = Math.min(
    30,
    overdue.reduce((s, t) => {
      const age = (Date.parse(end) - Date.parse(t.dueDate as string)) / 86_400_000;
      return s + 3 + Math.min(age, 14) / 14 * 4;
    }, 0),
  );
  const bits = [
    r.planned > 0 ? `${r.finishedPlan}/${r.planned} blocks` : null,
    r.due > 0 ? `${r.kept}/${r.due} habits` : null,
    r.tasksDue > 0 ? `${r.onTime + r.late}/${r.tasksDue} tasks due${r.late ? ` (${r.late} late)` : ""}` : null,
    overdue.length > 0 ? `${overdue.length} overdue` : null,
  ].filter(Boolean);
  return {
    key: "execution",
    label: "Execution",
    score: base == null ? null : clamp(base * 100 - penalty),
    why: bits.length ? bits.join(" · ") : "Nothing planned or tracked yet",
    fix:
      overdue.length > 2
        ? "Clear the overdue pile — even moving it to a real date counts."
        : r.plan != null && r.habits != null && r.plan < r.habits
          ? "Plan fewer blocks and finish all of them."
          : "Keep the habits that are due — those are the easy points.",
  };
}

function consistency(data: AppData, days: string[]): Pillar {
  let showed = 0;
  let weightShown = 0;
  let weightAll = 0;
  days.forEach((d, i) => {
    const on = activeOn(data, d);
    if (on) showed += 1;
    weightAll += recency(i);
    if (on) weightShown += recency(i);
  });
  let run = 0;
  for (const d of days) {
    if (!activeOn(data, d)) break;
    run += 1;
  }
  const a = activeDays(data, days.slice(0, 7));
  const b = activeDays(data, days.slice(7));
  const evenness = 1 - Math.abs(a - b) / 7;
  const score = (weightShown / weightAll) * 70 + (Math.min(run, 7) / 7) * 20 + evenness * 10;
  return {
    key: "consistency",
    label: "Consistency",
    score: clamp(score),
    why: `${showed}/${days.length} days active · ${run}-day run`,
    fix: "Show up daily, even small: one habit tick keeps the run alive.",
  };
}

/**
 * Direction of travel. Compares only what exists in both weeks, so starting
 * to use plan blocks this week does not read as a swing either way.
 */
function momentum(data: AppData, recent: string[], older: string[]): Pillar {
  const now = rates(data, recent);
  const then = rates(data, older);
  const pairs: [number, number][] = [];
  if (now.plan != null && then.plan != null) pairs.push([now.plan, then.plan]);
  if (now.habits != null && then.habits != null) pairs.push([now.habits, then.habits]);
  if (now.tasks != null && then.tasks != null) pairs.push([now.tasks, then.tasks]);
  const actA = activeDays(data, recent);
  const actB = activeDays(data, older);
  if (actA + actB === 0) {
    return { key: "momentum", label: "Momentum", score: null, why: "Needs two weeks to compare", fix: "" };
  }
  pairs.push([actA / recent.length, actB / older.length]);
  const a = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const b = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  const diff = a - b; // -1..1
  // Mostly direction; a little for where you are, so 100% → 100% reads steady-good.
  const score = 50 + diff * 120 + (a - 0.5) * 30;
  const pct = Math.round(diff * 100);
  return {
    key: "momentum",
    label: "Momentum",
    score: clamp(score),
    why:
      diff > 0.05
        ? `This week beats last week (+${pct} pts)`
        : diff < -0.05
          ? `This week is behind last week (${pct} pts)`
          : "Holding level with last week",
    fix: "Beat last week by one thing — one more block, one more habit.",
  };
}

/* ---------------------------------- Mind ---------------------------------- */

const GOOD = [
  "good", "great", "happy", "proud", "calm", "grateful", "thankful", "alhamdulillah", "productive", "focused",
  "strong", "better", "progress", "achieved", "won", "win", "energy", "energized", "motivated", "peace", "peaceful",
  "love", "loved", "fun", "confident", "improved", "discipline", "excited", "rested", "accomplished", "nailed",
  "хорошо", "хороший", "отлично", "рад", "радост", "счастлив", "горжусь", "спокойн", "продуктивн", "сильн",
  "лучше", "успел", "получилось", "доволен", "довольн", "кайф", "мотивир", "энерги", "неплохо", "справил",
];
const BAD = [
  "tired", "sad", "anxious", "anxiety", "stress", "stressed", "lazy", "failed", "fail", "bad", "worse", "worst",
  "angry", "lonely", "depressed", "exhausted", "burnout", "burned", "wasted", "procrastinat", "scared", "hopeless",
  "crying", "cried", "sick", "overwhelmed", "relapse", "unmotivated", "miserable", "awful", "terrible", "stuck",
  "устал", "грустн", "тревог", "стресс", "ленив", "лень", "провал", "плохо", "плохой", "хуже", "злой", "злюсь",
  "одинок", "выгор", "страшно", "болею", "болел", "бесит", "депресс", "прокраст", "ужасн", "отвратит", "сорвал",
];
const NEGATIONS = new Set(["not", "no", "never", "dont", "didnt", "wasnt", "isnt", "arent", "cant", "wont", "не", "ни", "нет", "без"]);

/** A word hits a lexicon entry exactly, or by stem when the entry is 5+ letters. */
function hitsWord(word: string, list: string[]) {
  return list.some((w) => word === w || (w.length >= 5 && word.startsWith(w)));
}

/** -1..1, or null when nothing in the text carries tone. Handles "not tired". */
export function tone(text: string): number | null {
  const words = text.toLowerCase().replace(/[’']/g, "").split(/[^\p{L}]+/u).filter(Boolean);
  let g = 0;
  let b = 0;
  words.forEach((w, i) => {
    let s = hitsWord(w, GOOD) ? 1 : hitsWord(w, BAD) ? -1 : 0;
    if (s === 0) return;
    if (NEGATIONS.has(words[i - 1] ?? "") || NEGATIONS.has(words[i - 2] ?? "")) s = -s;
    if (s > 0) g += 1;
    else b += 1;
  });
  if (g + b === 0) return null;
  return (g - b) / (g + b);
}

function mind(data: AppData, days: string[]): Pillar {
  const entries = days.map((d, i) => ({ text: written(data, d), i })).filter((e) => e.text !== "");
  if (!data.days.some((d) => d.reflection.some((b) => b.text.trim() !== ""))) {
    return { key: "mind", label: "Mind", score: null, why: "No journal yet", fix: "Write three lines tonight." };
  }
  // Five days a week is a full mark; daily is not required.
  const freq = Math.min(1, entries.length / (days.length * (5 / 7)));
  const words = entries.reduce((s, e) => s + e.text.split(/\s+/).length, 0) / Math.max(1, entries.length);
  const depth = Math.min(1, words / 120);
  let tw = 0;
  let ts = 0;
  for (const e of entries) {
    const s = tone(e.text);
    if (s == null) continue;
    const w = 1 / (1 + e.i * 0.3); // recent entries count more
    ts += s * w;
    tw += w;
  }
  // With few toned entries, lean towards neutral.
  const mood = tw ? (ts / tw) * Math.min(1, tw / 1.5) : 0;
  const score = freq * 40 + depth * 20 + ((mood + 1) / 2) * 40;
  return {
    key: "mind",
    label: "Mind",
    score: clamp(score),
    why: `${entries.length} entries · ~${Math.round(words)} words · tone ${mood > 0.2 ? "positive" : mood < -0.2 ? "heavy" : "mixed"}`,
    fix:
      mood < -0.2
        ? "Heavy few days. Write what's weighing on you — then one thing you're grateful for."
        : entries.length < 5
          ? "Write more often, even a few lines."
          : "Go deeper: answer one of the questions properly.",
  };
}

/* ---------------------------------- Body ---------------------------------- */

/** Least-squares slope in kg per week. */
function slope(points: { date: string; weight: number }[]): number {
  const t0 = Date.parse(points[0].date);
  const xs = points.map((p) => (Date.parse(p.date) - t0) / (7 * 86_400_000));
  const ys = points.map((p) => p.weight);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  return den ? num / den : 0;
}

function body(data: AppData, days: string[]): Pillar {
  if (!data.days.some((d) => d.weight != null)) return { key: "body", label: "Body", score: null, why: "No weigh-ins", fix: "" };
  const set = new Set(days);
  const w = data.days
    .filter((d) => d.weight != null && set.has(d.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ date: d.date, weight: d.weight as number }));
  const regular = Math.min(1, w.length / 7);
  const goal = data.goals.find((g) => g.status === "active" && g.tracker?.source === "weight");
  let dir = 0.5;
  let why = `${w.length} weigh-ins`;
  let fix = "Weigh in most mornings — the trend needs points.";
  if (w.length >= 2) {
    const perWeek = w.length >= 3 ? slope(w) : (w[w.length - 1].weight - w[0].weight) / Math.max(1, (Date.parse(w[w.length - 1].date) - Date.parse(w[0].date)) / (7 * 86_400_000));
    const current = w[w.length - 1].weight;
    const pct = (perWeek / current) * 100; // % of bodyweight per week
    const sign = perWeek > 0 ? "+" : "";
    why += ` · ${sign}${perWeek.toFixed(2)} kg/wk`;
    if (goal?.tracker) {
      const remaining = goal.tracker.target - current;
      if (Math.abs(remaining) < 0.5) {
        // At target: holding steady is the win.
        dir = Math.abs(pct) < 0.3 ? 1 : 0.6;
        why += " · at goal";
        fix = "You're there — hold it steady.";
      } else {
        const toward = Math.sign(remaining) * pct; // >0 means moving the right way
        if (toward <= -0.1) dir = 0.15;
        else if (toward < 0.15) dir = 0.4; // flat
        else if (toward <= 1) dir = 0.75 + (toward / 1) * 0.25; // healthy 0.15–1%/wk
        else dir = Math.max(0.6, 1 - (toward - 1) * 0.3); // faster than healthy
        why += toward > 0.1 ? " towards goal" : toward < -0.1 ? " away from goal" : " · flat";
        fix = toward > 1 ? "Moving fast — ease off a little, aim for under 1% a week." : "Keep the trend moving towards your goal.";
      }
    } else {
      dir = Math.abs(pct) < 0.4 ? 0.85 : Math.abs(pct) < 1 ? 0.6 : 0.4;
    }
  }
  return {
    key: "body",
    label: "Body",
    score: clamp(regular * 35 + dir * 65),
    why,
    fix: regular < 0.5 ? "Weigh in most mornings — the trend needs points." : fix,
  };
}

/* ---------------------------------- Goals --------------------------------- */

const PRIORITY_WEIGHT: Record<Priority, number> = { urgent: 1.6, high: 1.3, medium: 1, low: 0.7 };

/** Was this goal being worked on at `end`? Lets the week-ago reading be honest. */
function liveAt(g: Goal, end: string): boolean {
  if (g.createdAt.slice(0, 10) > end) return false;
  if (g.status === "active") return true;
  if (g.status === "achieved") return g.achievedAt != null && g.achievedAt.slice(0, 10) > end;
  if (g.status === "missed") return g.deadline != null && g.deadline > end;
  return false; // paused
}

/**
 * Goals, judged the way a coach would rather than by how full the bars are.
 *
 * Each live goal gets a score from three things:
 *  - Where it should be. A goal with a deadline is held to pace: progress
 *    against how much of its time has gone. Early on that's unreliable (5%
 *    of the way through, 0% done means little), so pace only counts in full
 *    once a quarter of the time has passed. A rolling goal ("gym 3× a week,
 *    last 30 days") has no pace: its value already is the current level. A
 *    goal with no deadline has no pace either.
 *  - Whether it moved. Progress now against two weeks ago. A goal untouched
 *    for a fortnight is stalled, whatever its bar says.
 *  - What's at stake. Urgent and high-priority goals count for more.
 * A goal past its deadline still waiting for a verdict counts as behind.
 *
 * On top: goals achieved or missed in the last 60 days, fading as they age.
 * A miss that got to 80% stings less than one that never started.
 */
function goals(data: AppData, end: string): Pillar {
  const live = data.goals.filter((g) => liveAt(g, end));
  let sum = 0;
  let weight = 0;
  let stalled = 0;
  let behind = 0;
  let worst: { title: string; score: number } | null = null;

  for (const g of live) {
    const { value, tracked } = progressOf(g, data, end);
    if (value == null) continue;
    if (value >= 100) {
      sum += 95 * PRIORITY_WEIGHT[g.priority];
      weight += PRIORITY_WEIGHT[g.priority];
      continue;
    }
    const rolling = (g.tracker?.windowDays ?? 0) > 0 || g.tracker?.source === "reflection";

    // 1. Where it should be.
    let standing: number;
    if (g.deadline && !rolling) {
      const start = Date.parse(g.createdAt.slice(0, 10));
      const stop = Date.parse(g.deadline);
      const now = Date.parse(end);
      const elapsed = stop > start ? Math.max(0, Math.min(1, (now - start) / (stop - start))) : 1;
      const expected = Math.max(0.05, elapsed);
      const pace = Math.min(1.2, value / 100 / expected); // 1 = exactly on pace
      const paceScore = Math.min(100, pace * 80 + (value / 100) * 20);
      const trust = Math.min(1, elapsed / 0.25);
      standing = paceScore * trust + 65 * (1 - trust);
      if (g.deadline <= end) standing = Math.min(standing, value * 0.6); // overdue, no verdict
      if (pace < 0.7 && trust > 0.5) behind += 1;
    } else {
      standing = rolling ? value : 55 + value * 0.35;
    }

    // 2. Did it move? Weight goals are judged by Body; skip their history.
    let moveScore: number | null = null;
    if (tracked?.source !== "weight" && !rolling && g.createdAt.slice(0, 10) <= addDays(end, -14)) {
      const was = progressOf(g, data, addDays(end, -14)).value ?? value;
      const moved = value - was;
      moveScore = moved <= 0 ? 20 : Math.min(100, 55 + moved * 3);
      if (moved <= 0) stalled += 1;
    }

    const score = moveScore == null ? standing : standing * 0.7 + moveScore * 0.3;
    const pw = PRIORITY_WEIGHT[g.priority];
    sum += score * pw;
    weight += pw;
    if (!worst || score < worst.score) worst = { title: g.title, score };
  }

  // 3. Outcomes, fading over 60 days.
  const fade = (date: string) => {
    const age = (Date.parse(end) - Date.parse(date)) / 86_400_000;
    return age < 0 || age > 60 ? 0 : 1 - age / 60;
  };
  let outcome = 0;
  let wins = 0;
  let misses = 0;
  for (const g of data.goals) {
    if (g.status === "achieved" && g.achievedAt) {
      const f = fade(g.achievedAt.slice(0, 10));
      if (f > 0) {
        wins += 1;
        outcome += 10 * f * PRIORITY_WEIGHT[g.priority];
      }
    }
    if (g.status === "missed" && g.deadline) {
      const f = fade(g.deadline);
      if (f > 0) {
        misses += 1;
        const reached = (progressOf(g, data, g.deadline).value ?? 0) / 100;
        outcome -= 18 * f * PRIORITY_WEIGHT[g.priority] * (1 - reached * 0.6);
      }
    }
  }

  if (weight === 0 && wins === 0 && misses === 0) {
    return { key: "goals", label: "Goals", score: null, why: "No tracked goals", fix: "" };
  }
  const base = weight ? sum / weight : 65;
  const bits = [
    `${live.length} live`,
    behind ? `${behind} behind pace` : null,
    stalled ? `${stalled} stalled` : null,
    wins ? `${wins} won lately` : null,
    misses ? `${misses} missed lately` : null,
  ].filter(Boolean);
  return {
    key: "goals",
    label: "Goals",
    score: clamp(base + outcome),
    why: bits.join(" · "),
    fix: worst
      ? `"${worst.title}" needs you most — do one thing for it today.`
      : misses > 0
        ? "A recent miss still weighs here. Set a new goal and hit it — wins lift this fastest."
        : "Set a goal with a deadline and let the hub track it.",
  };
}
