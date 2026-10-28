import { NextResponse } from "next/server";
import { fetchGemini } from "@/lib/ai/fetchGemini";

/**
 * Reading progress on the goals nothing countable can measure.
 *
 * "Get into NYU", "stop procrastinating", "be calmer before exams" — there is
 * no tick or weigh-in for these, and the honest evidence is what the student
 * writes. One call reads the recent journal against every such goal at once
 * and returns a number and a sentence for each. It runs every few days, not on
 * every visit; the client decides when a reading has gone stale.
 */

const MODEL = "gemini-3.8-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const INSTRUCTION = `You estimate how far a student has got with their own goals, from what they write in their journal and how they are keeping their habits and plans.

For each goal return a value from 0 to 100 and one sentence saying why.

# How to judge
Base it on evidence, not optimism. Things they wrote about doing, deciding, struggling with or finishing count. Things they only said they would do count for little until they say they did them.

Movement between readings should be modest unless the journal shows a real shift. You are given the previous value: if nothing new bears on a goal, keep the value where it was and say so plainly — "Nothing about this in the last couple of weeks." Do not drift it down just because it was not mentioned, and do not nudge it up to be kind.

A goal with a deadline should be judged against that deadline: halfway through the time with a quarter of the work done is not 50.

# The sentence
One short sentence, addressed to them as "you", in a friend's voice. Point at what they actually wrote when you can — "You sent the first draft on the 14th" — and never invent an event. If they write in Russian or Kazakh, write the sentence in that language.

No preamble, no encouragement for its own sake, no exclamation marks.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    readings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          handle: { type: "STRING", description: "The goal handle you were given, like G1." },
          // INTEGER, for the same reason as the goal-link route: asked for a
          // NUMBER, the model has padded a decimal until it ran out of budget.
          value: { type: "INTEGER" },
          why: { type: "STRING" },
        },
        required: ["handle", "value", "why"],
      },
    },
  },
  required: ["readings"],
};

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "Not configured." }, { status: 503 });

  let body: { goals?: unknown; journal?: unknown; brief?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const goals = typeof body.goals === "string" ? body.goals.slice(0, 4000) : "";
  const journal = typeof body.journal === "string" ? body.journal.slice(0, 12_000) : "";
  const brief = typeof body.brief === "string" ? body.brief.slice(0, 4000) : "";
  if (goals.trim() === "") return NextResponse.json({ error: "No goals to read." }, { status: 400 });

  let response: Response;
  try {
    response = await fetchGemini(ENDPOINT, key, {
      systemInstruction: { parts: [{ text: INSTRUCTION }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                `# Goals\n\n${goals}\n\n` +
                `# How they are doing otherwise\n\n${brief}\n\n` +
                `# Their journal, newest first\n\n${journal || "They have not written anything recently."}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        // Thinking shares this budget; sized well above the visible output.
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });
  } catch (e) {
    console.error("Gemini goal-judge fetch failed:", e);
    return NextResponse.json({ error: "Could not reach the AI service." }, { status: 502 });
  }

  if (!response.ok) {
    // The body carries the journal; logged on the server, never returned.
    console.error("Gemini goal-judge failed", response.status, await response.text().catch(() => ""));
    return NextResponse.json({ error: "Could not read the journal this time." }, { status: 502 });
  }

  const data = await response.json();
  const raw = (data?.candidates?.[0]?.content?.parts ?? [])
    .filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();

  try {
    const parsed = JSON.parse(raw);
    return NextResponse.json({ readings: Array.isArray(parsed.readings) ? parsed.readings : [] });
  } catch {
    console.error("Gemini goal-judge returned unparseable JSON, length", raw.length);
    return NextResponse.json({ error: "That came back malformed." }, { status: 502 });
  }
}
