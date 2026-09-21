import { NextResponse } from "next/server";
import { fetchGemini } from "@/lib/ai/fetchGemini";

/**
 * Reading a goal once, and deciding what in the hub measures it.
 *
 * The smallest AI call in the app, and deliberately: it runs when a goal is
 * created, never again, and it does not do the measuring. It translates one
 * sentence of intent into a spec that `lib/goals/tracker.ts` can evaluate
 * locally forever after. Everything expensive about knowing whether someone is
 * keeping a goal is arithmetic; only the first step is language.
 *
 * The inventory is sent as short handles — H1, C2, K3 — rather than UUIDs. It
 * is a third of the tokens, and a model cannot half-remember a two-character
 * id the way it can a thirty-six character one, so the client maps handles back
 * to real ids and drops anything it does not recognise.
 */

const MODEL = "gemini-3.8-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const INSTRUCTION = `You connect a student's goal to the data their hub already collects, so a progress bar can be computed instead of guessed.

You are given the goal and an inventory of what the hub tracks. Return one measurement spec.

# Sources
- habits — counts ticks of named habits. For anything that is a repeated practice: training, prayer, reading, sleep, language study.
- tasks — counts finished school tasks. For coursework: an IA, a set of past papers, revision for a subject.
- plan — counts finished blocks in the daily planner. For time spent on something that is not coursework and not a habit.
- journal — counts days with a written reflection. Only for goals about writing, reflecting or self-tracking.
- weight — the only source measured as a distance. For a target weight. Put the target weight in kg in "target".

# Choosing
Pick the source with real evidence behind it. A goal about training is measured by the training habit if one exists, not by keywords.

Set habitIds / courseIds / categoryIds from the inventory using the handles given. These are alternatives, not conditions — anything matching one of them counts. Add keywords only when the filing is not enough on its own, and keep them to distinctive words ("IA", "past paper"), never generic ones ("study", "work", "do").

# The window
windowDays: 0 counts everything since the goal was set, and only ever rises. Use it for a finite pile of work — "finish 40 past papers", "write the IA".
Otherwise windowDays is a rolling window and the bar falls when they stop, which is what an ongoing practice needs — "train three times a week", "read every day". This is usually the right answer for a habit. It must be one of 7, 14, 28, 30, 60 or 90. Never more than 90: a window longer than that stops responding to anything they did this month, which is the only thing it is for.

# The target
Make it reachable by the deadline if there is one, and honest. "Train 3x a week" over a rolling 28 days is a target of 12, not 3.

# When you cannot measure it
If nothing in the inventory measures this goal, return trackable: false and fill the remaining fields with anything — they are discarded. A goal about getting into a university, or feeling less anxious, is not measurable from ticks, and a made-up proxy is worse than a slider the student sets themselves. Do not stretch.

# basis
One short sentence, addressed to the student, saying what is being counted and why that stands for the goal. It sits under the progress bar. No preamble.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    trackable: {
      type: "BOOLEAN",
      description: "False when nothing in the inventory honestly measures this goal.",
    },
    source: {
      type: "STRING",
      format: "enum",
      enum: ["habits", "tasks", "plan", "journal", "weight"],
    },
    habitIds: { type: "ARRAY", items: { type: "STRING" }, description: "Handles like H1." },
    courseIds: { type: "ARRAY", items: { type: "STRING" }, description: "Handles like S1." },
    categoryIds: { type: "ARRAY", items: { type: "STRING" }, description: "Handles like C1." },
    keywords: { type: "ARRAY", items: { type: "STRING" } },
    /*
      INTEGER, not NUMBER, and the difference is not cosmetic.

      Asked for a NUMBER, the model produced `"windowDays": 30.0000…` followed
      by nearly three thousand zeros — it filled the entire output budget with
      a decimal expansion and the JSON was cut off mid-number. Declaring the
      field an integer removes the fractional part it was padding.

      The cost is that a weight target is whole kilograms. Worth it: nobody
      sets out to reach 72.4 kg, and the alternative is a class of failure that
      looks like the model refusing rather than a formatting quirk.
    */
    target: { type: "INTEGER" },
    windowDays: { type: "INTEGER" },
    basis: { type: "STRING" },
  },
  /*
    Everything required, including the fields that mean nothing when trackable
    is false. Left optional, the model simply omitted half of them — no habit
    ids, no basis — and the spec arrived pointing at nothing in particular.
    A schema is the only instruction a model cannot skim.
  */
  required: [
    "trackable",
    "source",
    "habitIds",
    "courseIds",
    "categoryIds",
    "keywords",
    "target",
    "windowDays",
    "basis",
  ],
};

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "The assistant is not configured: GEMINI_API_KEY is missing on the server." },
      { status: 503 },
    );
  }

  let body: { goal?: unknown; inventory?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  if (goal === "") {
    return NextResponse.json({ error: "No goal to read." }, { status: 400 });
  }
  const inventory = typeof body.inventory === "string" ? body.inventory : "Nothing tracked yet.";

  let response: Response;
  try {
    response = await fetchGemini(ENDPOINT, key, {
      systemInstruction: { parts: [{ text: INSTRUCTION }] },
      contents: [
        {
          role: "user",
          parts: [{ text: `# Goal\n\n${goal}\n\n# The hub tracks\n\n${inventory}` }],
        },
      ],
      generationConfig: {
        // Low: this is a classification with a right answer, not a piece of
        // writing. A creative reading here produces a bar that measures the
        // wrong thing and never says so.
        temperature: 0.2,
        /*
          Far more than the output needs, because thinking is spent from the
          same budget and a goal that takes some deciding — is finishing an IA
          a task count or a planner count? — can think for two thousand tokens
          and leave a hundred characters of truncated JSON behind. Nothing is
          charged for headroom that goes unused, so the cap is generous.
        */
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });
  } catch (e) {
    console.error("Gemini goal-link fetch failed:", e);
    return NextResponse.json({ error: "Could not reach the AI service." }, { status: 502 });
  }

  if (!response.ok) {
    // The body carries the goal's own wording, and Google's errors echo the
    // request, so this is logged on the server and never returned.
    console.error("Gemini goal-link failed", response.status, await response.text().catch(() => ""));
    return NextResponse.json({ error: "Could not read that goal." }, { status: 502 });
  }

  const data = await response.json();
  const raw = (data?.candidates?.[0]?.content?.parts ?? [])
    .filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();

  try {
    return NextResponse.json(JSON.parse(raw));
  } catch {
    // The length is the tell: a short body is a refusal, a long one that still
    // will not parse is the budget running out mid-object.
    // The length is the tell, and worth keeping: a short body is a refusal, a
    // long one that still will not parse is an output that ran out of budget.
    console.error("Gemini goal-link returned unparseable JSON, length", raw.length);
    return NextResponse.json({ error: "That came back malformed." }, { status: 502 });
  }
}
