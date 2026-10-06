import { NextResponse } from "next/server";
import { fetchGemini } from "@/lib/ai/fetchGemini";

/**
 * One line, once a day.
 *
 * The cheapest call in the app by a distance, and it has to stay that way: it
 * runs without being asked, which is a privilege nothing else here has. So it
 * is sent a handful of numbers rather than the journal — the streak, what is
 * left today, the nearest deadline — and asked for a single sentence.
 *
 * Deliberately not "motivation" in the poster sense. A line that would be true
 * for anybody is worse than no line, because it teaches the student to stop
 * reading this part of the page. It has to be about today, theirs, and short.
 */

const MODEL = "gemini-3.8-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const INSTRUCTION = `You write one line for the top of a student's dashboard, once a day.

You get a few numbers about where they stand this morning. Write a single sentence — two short ones at most — that would make them more likely to do the thing in front of them.

# Voice
Their close friend, who keeps track. Contractions always. Say it straight.

Never a greeting, never a preamble, never their name. Start at the point.

# What makes it land
Use the specific thing you were given. "Six days running" beats "keep up the good work" because only one of them could have been written about this person on this morning. If the numbers are quiet, say something quiet and true rather than inventing drama.

Earn the encouragement. If they have broken a streak, you can say so — a friend would. If they are two days from an exam with four tasks open, that is the line, not a quote about perseverance.

# What this is not
Not a fortune cookie. No quotes from anyone, no proverbs, no "remember that…", no "you've got this", no exclamation marks, no emoji. Nothing that would fit on a poster in a dentist's waiting room.

Not a nag either. One observation and at most one nudge. They are about to start their day, not read a report.

Under 20 words. One line of plain text, no markdown, no quotation marks.

If they write in Russian or Kazakh, write it in the language they use.`;

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "Not configured." }, { status: 503 });

  let body: { state?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const state = typeof body.state === "string" ? body.state.trim() : "";
  if (state === "") return NextResponse.json({ error: "Nothing to go on." }, { status: 400 });

  let response: Response;
  try {
    response = await fetchGemini(ENDPOINT, key, {
      systemInstruction: { parts: [{ text: INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: state }] }],
      generationConfig: {
        // Higher than the classifier routes: this one is writing, and the same
        // sentence every morning is the failure mode to avoid.
        temperature: 0.9,
        // Short output, but thinking comes out of the same budget — the
        // goal-link route lost whole responses to a cap set by output length.
        maxOutputTokens: 2048,
      },
    });
  } catch (e) {
    console.error("Gemini spark fetch failed:", e);
    return NextResponse.json({ error: "Could not reach the AI service." }, { status: 502 });
  }

  if (!response.ok) {
    console.error("Gemini spark failed", response.status, await response.text().catch(() => ""));
    return NextResponse.json({ error: "No line today." }, { status: 502 });
  }

  const data = await response.json();
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim()
    // A model that wraps its one sentence in quotes has made it look like a
    // quotation, which is the one thing this is not.
    .replace(/^["“”']+|["“”']+$/g, "")
    .slice(0, 220);

  if (text === "") return NextResponse.json({ error: "No line today." }, { status: 502 });
  return NextResponse.json({ text });
}
