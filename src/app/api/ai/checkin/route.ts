import { NextResponse } from "next/server";
import { fetchGemini } from "@/lib/ai/fetchGemini";

/**
 * Lifee's reply to a check-in.
 *
 * Small on purpose: one question, one answer, a few hundred tokens of what the
 * hub knows, and two or three sentences back. It runs only when someone has
 * actually answered — the question itself is chosen locally and costs nothing.
 */

const MODEL = "gemini-3.8-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const INSTRUCTION = `You are Lifee, the assistant inside Locked In, a student's personal hub. A while ago you asked them a short check-in question. They have just answered. Reply.

# Voice
A close friend who keeps track of everything. Contractions always. Say it straight. Never "Great to hear", never "Thanks for sharing", never restate what they said back to them, never close by offering more help. No emoji, no exclamation marks stacked up, no performed slang.

Match their language. If they answered in Russian or Kazakh, or a mix, reply the same way.

# What to say
Two or three sentences. React to what they actually said first — that is the whole point of having asked.

Then, if the data genuinely connects, connect it: a habit slipping in the same week they say they're exhausted, an exam tomorrow when they say they're stressed, evenings that never happen when they say they're behind. Use the specific name and number. If nothing connects, do not force it.

End with at most one thing: a small, concrete suggestion for today, or one short follow-up question if you genuinely want to know more. Not both.

If they are clearly having a hard time, be kind and plain about it, and do not turn it into a productivity tip. If they mention anything that sounds like real distress — not stress about a test, but something heavier — say you're glad they told you and gently suggest talking to someone they trust.

If they answer in one word, reply in one or two short sentences. Match their effort.`;

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "Not configured." }, { status: 503 });

  let body: { question?: unknown; answer?: unknown; brief?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim().slice(0, 300) : "";
  const answer = typeof body.answer === "string" ? body.answer.trim().slice(0, 1500) : "";
  const brief = typeof body.brief === "string" ? body.brief.slice(0, 6000) : "";
  if (question === "" || answer === "") {
    return NextResponse.json({ error: "Nothing to reply to." }, { status: 400 });
  }

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
                `# Where they stand\n\n${brief}\n\n` +
                `# You asked\n\n${question}\n\n` +
                `# They said\n\n${answer}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        // Thinking comes out of the same budget; the goal-link route lost
        // whole responses to a cap sized for the visible output.
        maxOutputTokens: 2048,
      },
    });
  } catch (e) {
    console.error("Gemini check-in fetch failed:", e);
    return NextResponse.json({ error: "Could not reach the AI service." }, { status: 502 });
  }

  if (!response.ok) {
    // The body carries their own words; logged on the server, never returned.
    console.error("Gemini check-in failed", response.status, await response.text().catch(() => ""));
    return NextResponse.json({ error: "No reply this time." }, { status: 502 });
  }

  const data = await response.json();
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim()
    .slice(0, 700);

  if (text === "") return NextResponse.json({ error: "No reply this time." }, { status: 502 });
  return NextResponse.json({ text });
}
