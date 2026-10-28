import { Insight } from "@/lib/types";

/**
 * A picture of what the card is about.
 *
 * The cards used to carry one glyph per kind — an arrow for every suggestion,
 * a wave for every pattern — so a column of them was the same two shapes in
 * turn and told you nothing before you read the words. The mark now comes
 * from the subject: a calendar on the one about an overfull day, scales on the
 * one about weight, a book on the one about the IA. You can find the card you
 * want by its picture.
 *
 * Chosen from the words already on the card, in this file, with no model. It
 * works on cards written before this existed, costs nothing, and when nothing
 * matches it falls back to a mark for the kind. Colour still belongs to the
 * kind, because colour is the one thing that says how far to trust the card.
 */

type Topic =
  | "weight"
  | "training"
  | "sleep"
  | "feeling"
  | "journal"
  | "habit"
  | "study"
  | "schedule"
  | "deadline"
  | "goal"
  | "pattern"
  | "suggestion"
  | "takeaway";

/*
  Ordered most specific first. "You logged 111.9kg… alongside the 3am
  wake-ups and back-to-back schedules" mentions three topics; the earliest
  rule that matches the *title* wins, and only then the body.
*/
const RULES: [Topic, RegExp][] = [
  ["weight", /\b(weight|weigh|kg|kilos?|weigh-?ins?|calories?|diet|eat(ing)?)\b/i],
  ["training", /\b(gym|train(ing)?|workout|run(ning)?|exercise|sport|lift(ing)?)\b/i],
  ["sleep", /\b(sleep|slept|wake|woke|wake-?ups?|alarm|night|tired|exhaust\w*|3\s?am|rest)\b/i],
  ["feeling", /\b(stress\w*|pressure|overwhelm\w*|overload\w*|spiral\w*|anxi\w*|panic|worr\w*|calm|mood|feel\w*|furious|angry|self-critic\w*|harsh|guilt|burn\s?out|cr(y|ied)|emotion\w*)\b/i],
  ["journal", /\b(journal|wrote|writ(e|ing)|reflect\w*|entr(y|ies))\b/i],
  ["habit", /\b(habit|streak|routine|consisten\w*|pray\w*|every day|daily)\b/i],
  ["study", /\b(IA|exam|test|quiz|homework|revis\w*|stud(y|ying)|physics|math\w*|econ\w*|english|kazakh|chemistry|biology|essay|formative|course|grade|school)\b/i],
  ["schedule", /\b(days?|plans?|plann(ed|ing)|schedul\w*|blocks?|slack|buffer|calendar|mornings?|evenings?|afternoons?|weeks?|weekends?)\b/i],
  ["deadline", /\b(deadline|due|overdue|late|tomorrow|hours?|time)\b/i],
  ["goal", /\b(goals?|targets?|bars?|aims?|ambition\w*|aspir\w*)\b/i],
];

export function topicOf(insight: Pick<Insight, "title" | "body" | "kind">): Topic {
  for (const text of [insight.title, insight.body]) {
    for (const [topic, re] of RULES) if (re.test(text)) return topic;
  }
  return insight.kind === "pattern" ? "pattern" : insight.kind === "recommendation" ? "suggestion" : "takeaway";
}

/** Line icons on a 24 grid, one stroke weight, so the set reads as one family. */
const PATHS: Record<Topic, React.ReactNode> = {
  weight: (
    <>
      <path d="M12 3v2M5 7h14M7 7l-3 7a3 3 0 0 0 6 0L7 7Zm10 0-3 7a3 3 0 0 0 6 0l-3-7Z" />
      <path d="M12 5v14M8 21h8" />
    </>
  ),
  training: (
    <>
      <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
    </>
  ),
  sleep: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  feeling: (
    <path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10Z" />
  ),
  journal: (
    <>
      <path d="M15.5 4.5 19.5 8.5 9 19H5v-4L15.5 4.5Z" />
      <path d="M13.5 6.5 17.5 10.5" />
    </>
  ),
  habit: (
    <path d="M12 3c2.8 3 5 5 5 8.5a5 5 0 0 1-10 0c0-1.9.9-3.3 2-4.6.3 1.2.9 2 1.6 2.4C10.3 7 10.8 5 12 3Z" />
  ),
  study: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5v-15Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5v-15Z" />
    </>
  ),
  schedule: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13.5h3M7.5 16.5h6" />
    </>
  ),
  deadline: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9v4l2.5 2.5M9.5 3h5" />
    </>
  ),
  goal: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </>
  ),
  pattern: <path d="M3 12c2.5-5 5-5 7.5 0s5 5 7.5 0 3-3 3-3" />,
  suggestion: (
    <>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V17h5v-1.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
    </>
  ),
  takeaway: <path d="M5 12.5 10 17.5 19.5 7" />,
};

export function InsightIcon({
  insight,
  tone,
  label,
}: {
  insight: Pick<Insight, "title" | "body" | "kind">;
  tone: string;
  label: string;
}) {
  const topic = topicOf(insight);
  return (
    <span
      aria-hidden
      title={label}
      className="relative mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105"
      style={{
        // Lit from the top-left, so the tile has a little depth instead of
        // being a flat tinted square — the difference between an icon and a
        // coloured blob at this size.
        background: `linear-gradient(140deg, color-mix(in srgb, ${tone} 26%, transparent), color-mix(in srgb, ${tone} 7%, transparent))`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 22%, transparent), 0 6px 16px -10px ${tone}`,
        color: tone,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[19px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[topic]}
      </svg>
    </span>
  );
}
