import { NextResponse } from "next/server";
import { fetchGemini } from "@/lib/ai/fetchGemini";
import { REFLECT_INSTRUCTION } from "@/lib/ai/prompt";

/**
 * The reflection pass.
 *
 * Separate from the chat route because it is a different kind of call: no
 * conversation, no tools, and a response shape the client has to be able to
 * write straight into the store. Structured output is enforced by the schema
 * below rather than by parsing prose, so a malformed day degrades into "no
 * insights" instead of corrupting what the hub believes about someone.
 */

const MODEL = "gemini-3.8-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    memory: {
      type: "ARRAY",
      description: "The complete memory to keep, excluding pinned notes.",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING", description: "Existing note id, or omitted for a new note." },
          topic: { type: "STRING" },
          note: { type: "STRING" },
          source: {
            type: "STRING",
            format: "enum",
            enum: ["reflection", "conversation", "pattern"],
          },
        },
        required: ["topic", "note", "source"],
      },
    },
    insights: {
      type: "ARRAY",
      description: "Between 0 and 3. Empty is correct on a quiet week.",
      items: {
        type: "OBJECT",
        properties: {
          kind: {
            type: "STRING",
            format: "enum",
            enum: ["takeaway", "recommendation", "pattern"],
          },
          title: { type: "STRING" },
          body: { type: "STRING" },
          basis: { type: "STRING" },
          href: { type: "STRING" },
        },
        required: ["kind", "title", "body", "basis"],
      },
    },
  },
  required: ["memory", "insights"],
};

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "The assistant is not configured: GEMINI_API_KEY is missing on the server." },
      { status: 503 },
    );
  }

  let body: { context?: unknown; memory?: unknown; standing?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const context = typeof body.context === "string" ? body.context : "";
  if (context.trim() === "") {
    return NextResponse.json({ error: "Nothing to reflect on." }, { status: 400 });
  }

  const memory = typeof body.memory === "string" ? body.memory : "Nothing learned yet.";
  const standing = typeof body.standing === "string" ? body.standing : "None.";

  let response: Response;
  try {
    response = await fetchGemini(ENDPOINT, key, {
      systemInstruction: { parts: [{ text: REFLECT_INSTRUCTION }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                `# The student's hub, right now\n\n${context}\n\n` +
                `# What you already know about them\n\n${memory}\n\n` +
                `# Insights still showing in the app\n\n${standing}\n\n` +
                `Update the memory, and return any insight worth surfacing today.`,
            },
          ],
        },
      ],
      generationConfig: {
        // Lower than the chat route: this one is making durable claims about
        // a person, and should reach for the obvious reading, not a novel one.
        temperature: 0.4,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });
  } catch (e) {
    console.error("Gemini reflect fetch failed:", e);
    return NextResponse.json({ error: "Could not reach the AI service." }, { status: 502 });
  }

  if (!response.ok) {
    // The request body contains the student's journal, and Google's errors can
    // echo it back, so this is logged and never returned.
    console.error(
      "Gemini reflect failed",
      response.status,
      await response.text().catch(() => ""),
    );
    return NextResponse.json(
      { error: "The reflection could not be completed." },
      { status: 502 },
    );
  }

  const data = await response.json();
  const raw = (data?.candidates?.[0]?.content?.parts ?? [])
    .filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();

  try {
    const parsed = JSON.parse(raw);
    return NextResponse.json({
      memory: Array.isArray(parsed.memory) ? parsed.memory : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    });
  } catch {
    // A truncated or non-JSON body is a failed pass, not a reason to wipe what
    // the hub already knew — the client keeps its existing memory on an error.
    console.error("Gemini reflect returned unparseable JSON");
    return NextResponse.json({ error: "The reflection came back malformed." }, { status: 502 });
  }
}
