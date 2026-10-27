import { AppData } from "./types";
import { addDays } from "./dates";
import { habitPatterns } from "./consistency";
import { upcoming } from "./calendar";

/**
 * What to ask today, if anything.
 *
 * Chosen here, from the data, without a model. Asking costs nothing; only the
 * reply does, and only when there is an answer to reply to. A check-in that
 * spent a call deciding what to say before anyone had said anything back would
 * be paying for the cheapest part of the conversation.
 *
 * The questions with a reason come first. "How are you?" is fine on a quiet
 * day, but on the morning after two missed days of something they were
 * keeping well, asking about that is what makes it feel like someone was
 * paying attention rather than a widget reading from a list.
 */

export interface CheckIn {
  /** Stable for the day, so a reload does not change the question. */
  key: string;
  question: string;
  /** Whether there is a specific reason to ask today, beyond it being a while. */
  pointed: boolean;
}

const CASUAL = [
  "How are you, really?",
  "What's up?",
  "What's happening this week?",
  "What's on your mind today?",
  "How did you sleep?",
  "What's the one thing you want done today?",
  "How's your energy today?",
  "Anything stressing you out right now?",
  "What went well yesterday?",
  "What's been the hardest part of this week?",
];

export function pickCheckIn(data: AppData, today: string): CheckIn {
  const patterns = habitPatterns(data, today);

  // A habit they were keeping well that has gone quiet for two or three days:
  // the moment it can still be saved, which is the only moment worth asking.
  const lapsed = patterns.find(
    (p) =>
      p.lastKept != null &&
      p.lastKept >= 2 &&
      p.lastKept <= 4 &&
      ((p.before ?? 0) >= 0.6 || (p.recent ?? 0) >= 0.6),
  );
  if (lapsed) {
    return {
      key: `lapsed-${lapsed.id}`,
      question: `${lapsed.lastKept} days without ${lapsed.name}. What got in the way?`,
      pointed: true,
    };
  }

  const tomorrow = upcoming(data, today, { limit: 6, within: 1 }).find((u) => u.daysLeft === 1);
  if (tomorrow) {
    return {
      key: `tomorrow-${tomorrow.id}`,
      question: `${tomorrow.label} is tomorrow. How are you feeling about it?`,
      pointed: true,
    };
  }

  const yesterday = addDays(today, -1);
  const planned = data.plan.filter((p) => p.date === yesterday);
  if (planned.length >= 3 && planned.filter((p) => p.done).length <= planned.length / 2) {
    return {
      key: `plan-${yesterday}`,
      question: "Yesterday's plan got away from you a bit. What happened?",
      pointed: true,
    };
  }

  const slipping = patterns.find((p) => p.trend === "down");
  if (slipping) {
    return {
      key: `slipping-${slipping.id}`,
      question: `${slipping.name} has been slipping the last couple of weeks. Anything going on?`,
      pointed: true,
    };
  }

  const run = patterns.filter((p) => p.streak >= 7).sort((a, b) => b.streak - a.streak)[0];
  if (run) {
    return {
      key: `run-${run.id}-${run.streak}`,
      question: `${run.streak} days straight on ${run.name}. What's making it work this time?`,
      pointed: true,
    };
  }

  // Rotated by day so the same quiet question does not come back tomorrow.
  const day = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000);
  return { key: `casual-${day % CASUAL.length}`, question: CASUAL[day % CASUAL.length], pointed: false };
}

/**
 * Whether to show one today.
 *
 * "Sometimes" — not every morning, because a question that appears daily
 * becomes a box to close. A pointed question shows whenever there is one; a
 * casual one waits until two days have passed since the last answer.
 */
export function shouldAsk(checkIn: CheckIn, today: string, lastAnswered: string | null): boolean {
  if (checkIn.pointed) return true;
  if (lastAnswered == null) return true;
  return lastAnswered <= addDays(today, -2);
}
