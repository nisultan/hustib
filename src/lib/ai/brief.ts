import { AppData } from "@/lib/types";
import { habitPatterns, pct, planPatterns, weekdayNames } from "@/lib/consistency";
import { upcoming } from "@/lib/calendar";

/**
 * The hub in a few hundred tokens.
 *
 * For calls that need to know someone without reading everything about them:
 * the check-in reply, so far. The full context sends the journal, every task
 * and every course — right for a conversation, absurd for answering "tired,
 * exam tomorrow" in two sentences.
 *
 * What survives the cut is what makes a reply sound like it was paying
 * attention: how each habit is actually going, whether the plan tends to
 * happen, what is close, and what the hub has already learned about them.
 * Those last notes are the cheapest intelligence in the app — a sentence each,
 * distilled from weeks of journal by a pass that has already been paid for.
 */
export function brief(data: AppData, today: string): string {
  const lines: string[] = [`Today: ${today}`];

  const habits = habitPatterns(data, today);
  if (habits.length > 0) {
    lines.push("Habits:");
    for (const h of habits) {
      const bits = [
        h.streak > 0 ? `${h.streak}-day run` : "no run",
        h.dueToday ? (h.doneToday ? "done today" : "not done yet today") : "not due today",
      ];
      if (h.due > 0) bits.push(`${h.kept}/${h.due} over 4 weeks`);
      if (h.trend === "down") bits.push(`slipping (${pct(h.recent)} vs ${pct(h.before)})`);
      if (h.trend === "up") bits.push(`improving (${pct(h.recent)} vs ${pct(h.before)})`);
      if (h.weakDays.length > 0) bits.push(`misses ${weekdayNames(h.weakDays)}`);
      lines.push(`- ${h.name}: ${bits.join(", ")}`);
    }
  }

  const plan = planPatterns(data, today);
  if (plan.planned >= 4) {
    lines.push(
      `Plan, last 14 days: ${plan.done}/${plan.planned} blocks done` +
        (plan.byPart.length > 1
          ? ` (${plan.byPart.map((s) => `${s.label} ${s.done}/${s.planned}`).join(", ")})`
          : ""),
    );
  }

  const todayPlan = data.plan.filter((p) => p.date === today);
  if (todayPlan.length > 0) {
    lines.push(
      `Today's plan: ${todayPlan.length} blocks, ${todayPlan.filter((p) => p.done).length} done`,
    );
  }

  const next = upcoming(data, today, { limit: 3, within: 14 });
  if (next.length > 0) {
    lines.push(
      `Coming up: ${next.map((u) => `${u.label} (${u.daysLeft === 0 ? "today" : `in ${u.daysLeft}d`})`).join("; ")}`,
    );
  }

  const notes = data.memory.slice(0, 8);
  if (notes.length > 0) {
    lines.push("What you already know about them:");
    for (const n of notes) lines.push(`- ${n.note}`);
  }

  return lines.join("\n");
}
