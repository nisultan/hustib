import { activityRange, DayActivity, SOURCES } from "./activity";
import { startOfWeek } from "./calendar";
import { addDays, formatDate, fromISO, toISO } from "./dates";
import { appliesOn, weekdayOf } from "./habits";
import { Evaluated, periodReading, Pillar, RankKey, tone } from "./prime";
import { AppData } from "./types";

/**
 * Reports: one period judged as a whole — which rank it earned, and five
 * things worth knowing about how you spent it.
 *
 * Built on the same model as the live reading (`periodReading`), so a report
 * never disagrees with the meter about what counts. The facts are picked by
 * how interesting they are this time: the strongest and weakest pillar always,
 * then whatever stood out most — a blank streak, a habit you nailed, a week
 * that beat the last one by half.
 */

export type Span = "week" | "month";

export const SPAN_LABEL: Record<Span, string> = { week: "week", month: "month" };

export interface Period {
  from: string;
  to: string;
  label: string;
  /** Still running: the report is "so far". */
  current: boolean;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The period `offset` steps back from the one containing today. */
export function period(span: Span, offset: number, today: string): Period {
  let from: string;
  let to: string;
  let label: string;
  if (span === "month") {
    const t = fromISO(today);
    const first = new Date(t.getFullYear(), t.getMonth() - offset, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    from = toISO(first);
    to = toISO(last);
    label = `${MONTHS[first.getMonth()]} ${first.getFullYear()}`;
  } else {
    from = addDays(startOfWeek(today), -7 * offset);
    to = addDays(from, 6);
    label = `${formatDate(from)} – ${formatDate(to)}`;
  }
  return { from, to, label, current: to >= today };
}

export type Visual =
  | { kind: "ring"; value: number }
  | { kind: "bars"; values: number[]; labels: string[]; highlight: number }
  | { kind: "delta"; value: number; unit: string; goodWhenUp: boolean | null }
  | { kind: "versus"; now: number; before: number; nowLabel: string; beforeLabel: string }
  | { kind: "dots"; hits: boolean[] };

export interface Fact {
  id: string;
  emoji: string;
  title: string;
  body: string;
  tone: "good" | "bad" | "neutral";
  visual?: Visual;
  interest: number;
}

export interface Report {
  from: string;
  /** Last day counted (today at most). */
  to: string;
  span: Span;
  days: DayActivity[];
  reading: Evaluated;
  previous: Evaluated | null;
  total: number;
  /** Same-length stretch just before, for "vs before". */
  prevTotal: number;
  prevActive: number;
  activeDays: number;
  bestRun: number;
  facts: Fact[];
  /** Above Mid: confetti. At Mid or below: boos. Null when unranked. */
  good: boolean | null;
}

const GOOD_RANKS: RankKey[] = ["prime", "locked", "rising"];

export function firstActiveDay(data: AppData, today: string): string | null {
  return activityRange(data, addDays(today, -730), today).find((d) => d.total > 0)?.date ?? null;
}

export function buildReport(data: AppData, p: Period, span: Span, today: string): Report {
  const to = p.to < today ? p.to : today;
  const len = Math.round((fromISO(p.to).getTime() - fromISO(p.from).getTime()) / 86_400_000) + 1;
  const days = to >= p.from ? activityRange(data, p.from, to) : [];
  const reading = periodReading(data, p.from, to);
  const prevFrom = addDays(p.from, -len);
  const prevTo = addDays(p.from, -1);
  const previous = periodReading(data, prevFrom, prevTo);
  const prevDays = activityRange(data, prevFrom, prevTo);

  const total = days.reduce((s, d) => s + d.total, 0);
  const activeDays = days.filter((d) => d.total > 0).length;
  let run = 0;
  let bestRun = 0;
  for (const d of days) {
    run = d.total > 0 ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
  }

  const facts = pickFacts(data, { days, prevDays, reading, previous, span, from: p.from, to, bestRun });
  const good = reading.rank ? GOOD_RANKS.includes(reading.rank.key) : null;

  return {
    from: p.from,
    to,
    span,
    days,
    reading,
    previous: previous.score != null ? previous : null,
    total,
    prevTotal: prevDays.reduce((s, d) => s + d.total, 0),
    prevActive: prevDays.filter((d) => d.total > 0).length,
    activeDays,
    bestRun,
    facts,
    good,
  };
}

/* --------------------------------- Facts ---------------------------------- */

interface Ctx {
  days: DayActivity[];
  prevDays: DayActivity[];
  reading: Evaluated;
  previous: Evaluated;
  span: Span;
  from: string;
  to: string;
  bestRun: number;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function breakdown(d: DayActivity): string {
  const noun: Record<string, [string, string]> = {
    tasks: ["task", "tasks"],
    plan: ["block", "blocks"],
    habits: ["habit", "habits"],
    reflection: ["journal entry", "journal entries"],
    weight: ["weigh-in", "weigh-ins"],
  };
  return SOURCES.filter((s) => d.by[s.key] > 0)
    .map((s) => plural(d.by[s.key], noun[s.key][0], noun[s.key][1]))
    .join(", ");
}

function dayBars(days: DayActivity[], highlight: number): Visual {
  const short = ["S", "M", "T", "W", "T", "F", "S"];
  return {
    kind: "bars",
    values: days.map((d) => d.total),
    labels: days.map((d) => (days.length <= 14 ? short[weekdayOf(d.date)] : `${fromISO(d.date).getDate()}`)),
    highlight,
  };
}

function pickFacts(data: AppData, c: Ctx): Fact[] {
  const out: Fact[] = [];
  const { days, span } = c;
  const word = SPAN_LABEL[span];
  if (days.length === 0) return out;

  // 1. Strongest and weakest pillar — always, they are the headline.
  const scored = c.reading.pillars.filter((p): p is Pillar & { score: number } => p.score != null);
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted.length > 1 ? sorted[sorted.length - 1] : null;
  if (best) {
    out.push({
      id: "best-pillar",
      emoji: "💪",
      title: `You're best at ${best.label.toLowerCase()}`,
      body: `${best.why}. Scored ${best.score}/100 — your strongest side this ${word}.`,
      tone: "good",
      visual: { kind: "ring", value: best.score },
      interest: 1000,
    });
  }
  if (worst && worst.key !== best?.key) {
    out.push({
      id: "worst-pillar",
      emoji: "🩹",
      title: `${worst.label} is your weak spot`,
      body: `${worst.why}. ${worst.fix}`,
      tone: "bad",
      visual: { kind: "ring", value: worst.score },
      interest: 999,
    });
  }

  // 2. Best day.
  const top = days.reduce((b, d) => (d.total > b.total ? d : b), days[0]);
  if (top.total > 0) {
    out.push({
      id: "best-day",
      emoji: "🔥",
      title: `Best day: ${WEEKDAY_FULL[weekdayOf(top.date)]}, ${formatDate(top.date)}`,
      body: `${plural(top.total, "thing")} done — ${breakdown(top)}.`,
      tone: "good",
      visual: dayBars(days, days.indexOf(top)),
      interest: 62,
    });
  }

  // 3. Blank days.
  const blank = days.filter((d) => d.total === 0);
  if (blank.length > 0) {
    const counts = new Map<number, number>();
    for (const d of blank) counts.set(weekdayOf(d.date), (counts.get(weekdayOf(d.date)) ?? 0) + 1);
    const [wd, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    out.push({
      id: "blank",
      emoji: "👻",
      title: `${plural(blank.length, "ghost day")}`,
      body:
        n > 1
          ? `Nothing logged at all on ${blank.length} days — ${WEEKDAY_FULL[wd]}s are where you vanish.`
          : `Nothing logged at all on ${blank.length === 1 ? formatDate(blank[0].date) : `${blank.length} days`}. Even one tick keeps the chain alive.`,
      tone: "bad",
      visual: { kind: "dots", hits: days.map((d) => d.total > 0) },
      interest: 40 + (blank.length / days.length) * 60,
    });
  } else if (days.length >= 5) {
    out.push({
      id: "no-blank",
      emoji: "⛓️",
      title: "Not a single blank day",
      body: `You showed up all ${days.length} days. That's the whole game.`,
      tone: "good",
      visual: { kind: "dots", hits: days.map(() => true) },
      interest: 88,
    });
  }

  // 4. Plan follow-through.
  const set = new Set(days.map((d) => d.date));
  const blocks = data.plan.filter((p) => set.has(p.date));
  if (blocks.length >= 3) {
    const done = blocks.filter((p) => p.done).length;
    const r = pct(done, blocks.length);
    const important = blocks.filter((p) => p.priority === "urgent" || p.priority === "high");
    const impDone = important.filter((p) => p.done).length;
    out.push({
      id: "plan",
      emoji: r >= 70 ? "🎯" : "🧱",
      title: `${done}/${blocks.length} planned blocks finished`,
      body:
        (r >= 80
          ? "You do what you plan. Rare."
          : r >= 60
            ? "Most of the plan happened — the rest leaked."
            : "Your plans are more wish than schedule right now. Plan less, finish more.") +
        (important.length > 0 ? ` High-priority ones: ${impDone}/${important.length}.` : ""),
      tone: r >= 70 ? "good" : r < 50 ? "bad" : "neutral",
      visual: { kind: "ring", value: r },
      interest: 50 + Math.abs(r - 60) / 2,
    });
  }

  // 5. Tasks.
  const completed = data.tasks.filter((t) => t.completedAt && set.has(t.completedAt.slice(0, 10)));
  const due = data.tasks.filter((t) => t.dueDate && set.has(t.dueDate));
  if (completed.length + due.length > 0) {
    const onTime = due.filter((t) => t.status === "completed" && t.completedAt && t.completedAt.slice(0, 10) <= t.dueDate!).length;
    const late = due.filter((t) => t.status === "completed" && t.completedAt && t.completedAt.slice(0, 10) > t.dueDate!).length;
    const open = due.length - onTime - late;
    const bad = open > 0 || late > onTime;
    out.push({
      id: "tasks",
      emoji: bad ? "⏰" : "✅",
      title: `${plural(completed.length, "task")} knocked out`,
      body:
        due.length > 0
          ? `Of ${plural(due.length, "deadline")} this ${word}: ${onTime} on time, ${late} late${open > 0 ? `, ${open} still open` : ""}.`
          : `None of them had a deadline in this ${word} — you were working ahead.`,
      tone: due.length === 0 ? "good" : bad ? "bad" : "good",
      visual: due.length > 0 ? { kind: "ring", value: pct(onTime, due.length) } : undefined,
      interest: 52 + open * 6,
    });
  }

  // 6. Habits: the champion and the casualty.
  const dayMap = new Map(data.days.map((d) => [d.date, d]));
  const habits = data.habits
    .map((h) => {
      const hits: boolean[] = [];
      for (const d of days) {
        if (!appliesOn(h, d.date)) continue;
        hits.push(dayMap.get(d.date)?.habitsDone.includes(h.id) ?? false);
      }
      return { h, hits, kept: hits.filter(Boolean).length };
    })
    .filter((x) => x.hits.length >= 2);
  if (habits.length > 0) {
    const byRate = [...habits].sort((a, b) => b.kept / b.hits.length - a.kept / a.hits.length);
    const champ = byRate[0];
    const champRate = pct(champ.kept, champ.hits.length);
    if (champRate >= 50) {
      out.push({
        id: "habit-best",
        emoji: "🏆",
        title: `“${champ.h.name}” is locked in`,
        body: `Kept ${champ.kept} of ${champ.hits.length} days (${champRate}%). This one is part of who you are now.`,
        tone: "good",
        visual: { kind: "dots", hits: champ.hits },
        interest: 48 + champRate / 5,
      });
    }
    const loser = byRate[byRate.length - 1];
    const loserRate = pct(loser.kept, loser.hits.length);
    if (loser !== champ && loserRate < 50) {
      out.push({
        id: "habit-worst",
        emoji: "🪦",
        title: `“${loser.h.name}” is slipping`,
        body: `Only ${loser.kept} of ${loser.hits.length} days. Shrink it until it's too small to skip.`,
        tone: "bad",
        visual: { kind: "dots", hits: loser.hits },
        interest: 50 + (50 - loserRate) / 3,
      });
    }
  }

  // 7. Journal.
  const entries = days
    .map((d) => dayMap.get(d.date))
    .filter((d) => d && d.reflection.some((b) => b.text.trim() !== ""))
    .map((d) => d!.reflection.filter((b) => b.type !== "image").map((b) => b.text).join(" "));
  if (entries.length > 0) {
    const words = entries.reduce((s, t) => s + t.split(/\s+/).filter(Boolean).length, 0);
    const tones = entries.map(tone).filter((t): t is number => t != null);
    const mood = tones.length ? tones.reduce((a, b) => a + b, 0) / tones.length : 0;
    const share = entries.length / days.length;
    out.push({
      id: "journal",
      emoji: mood < -0.2 ? "🌧️" : "✍️",
      title: `${words.toLocaleString()} words written`,
      body: `${plural(entries.length, "entry", "entries")}, ~${Math.round(words / entries.length)} words each. The tone was ${
        mood > 0.2 ? "mostly upbeat" : mood < -0.2 ? "heavy — something is weighing on you" : "mixed"
      }.`,
      tone: share >= 0.6 && mood >= -0.2 ? "good" : mood < -0.2 ? "bad" : "neutral",
      visual: { kind: "dots", hits: days.map((d) => d.by.reflection > 0) },
      interest: 44 + Math.abs(mood) * 20 + share * 10,
    });
  }

  // 8. Weight.
  const weighs = days.map((d) => dayMap.get(d.date)?.weight).filter((w): w is number => w != null);
  if (weighs.length >= 2) {
    const delta = Math.round((weighs[weighs.length - 1] - weighs[0]) * 10) / 10;
    out.push({
      id: "weight",
      emoji: "⚖️",
      title: delta === 0 ? "Weight held steady" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} kg`,
      body: `${plural(weighs.length, "weigh-in")}, from ${weighs[0]} to ${weighs[weighs.length - 1]} kg.`,
      tone: "neutral",
      visual: { kind: "delta", value: delta, unit: "kg", goodWhenUp: null },
      interest: 32 + Math.abs(delta) * 15,
    });
  }

  // 9. Versus the period before.
  const now = days.reduce((s, d) => s + d.total, 0);
  const before = c.prevDays.reduce((s, d) => s + d.total, 0);
  if (before > 0) {
    const change = Math.round(((now - before) / before) * 100);
    out.push({
      id: "versus",
      emoji: change >= 0 ? "📈" : "📉",
      title: change >= 0 ? `${change}% more than the ${word} before` : `${Math.abs(change)}% less than the ${word} before`,
      body:
        change >= 15
          ? `${now} things vs ${before}. You're climbing.`
          : change <= -15
            ? `${now} things vs ${before}. Something knocked you off — find it.`
            : `${now} things vs ${before}. Holding the line.`,
      tone: change >= 10 ? "good" : change <= -10 ? "bad" : "neutral",
      visual: { kind: "versus", now, before, nowLabel: `This ${word}`, beforeLabel: "Before" },
      interest: 46 + Math.min(40, Math.abs(change) / 3),
    });
  }

  // 10. Weekdays vs the weekend.
  const wkd = days.filter((d) => ![0, 6].includes(weekdayOf(d.date)));
  const wke = days.filter((d) => [0, 6].includes(weekdayOf(d.date)));
  if (wkd.length >= 3 && wke.length >= 2) {
    const a = wkd.reduce((s, d) => s + d.total, 0) / wkd.length;
    const b = wke.reduce((s, d) => s + d.total, 0) / wke.length;
    if (a + b > 0) {
      const ratio = (b + 0.5) / (a + 0.5);
      if (ratio < 0.6) {
        out.push({
          id: "weekend",
          emoji: "🛋️",
          title: "Weekends switch you off",
          body: `About ${a.toFixed(1)} things a weekday, ${b.toFixed(1)} on weekends. Rest is fine — disappearing isn't.`,
          tone: "bad",
          visual: { kind: "versus", now: Math.round(b * 10) / 10, before: Math.round(a * 10) / 10, nowLabel: "Weekend", beforeLabel: "Weekday" },
          interest: 38 + (1 - ratio) * 30,
        });
      } else if (ratio > 1.2) {
        out.push({
          id: "weekend",
          emoji: "🏋️",
          title: "Weekend warrior",
          body: `You do more on weekends (${b.toFixed(1)}/day) than on weekdays (${a.toFixed(1)}/day).`,
          tone: "neutral",
          visual: { kind: "versus", now: Math.round(b * 10) / 10, before: Math.round(a * 10) / 10, nowLabel: "Weekend", beforeLabel: "Weekday" },
          interest: 40,
        });
      }
    }
  }

  // 11. Longest run.
  if (c.bestRun >= 4 && c.bestRun < days.length) {
    out.push({
      id: "run",
      emoji: "🔗",
      title: `${c.bestRun} days in a row`,
      body: `Your longest unbroken run this ${word}. Beat it next time.`,
      tone: "good",
      visual: { kind: "dots", hits: days.map((d) => d.total > 0) },
      interest: 36 + c.bestRun * 2,
    });
  }

  // Headline pair, then the three loudest of the rest.
  const head = out.filter((f) => f.interest >= 999);
  const rest = out
    .filter((f) => f.interest < 999)
    // A run and blank days are the same strip told twice; keep the blank days.
    .filter((f) => f.id !== "run" || !out.some((g) => g.id === "blank"))
    .sort((a, b) => b.interest - a.interest);
  const picks = rest.slice(0, 5 - head.length);
  const strongest = head.find((f) => f.tone === "good");
  const weakest = head.find((f) => f.tone === "bad");
  return [...(strongest ? [strongest] : []), ...picks, ...(weakest ? [weakest] : [])];
}
