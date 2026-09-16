import { NextResponse } from "next/server";
import { fetchGemini } from "@/lib/ai/fetchGemini";
import { TOOL_DECLARATIONS } from "@/lib/ai/tools";
import { SYSTEM_INSTRUCTION } from "@/lib/ai/prompt";

/**
 * Server-side proxy to Gemini.
 *
 * The key stays here. Calling Google straight from the browser would mean
 * shipping it in the bundle, where anyone can read it out of devtools and
 * spend the quota — so the client posts the conversation to this route and
 * only ever sees what comes back.
 *
 * The route is deliberately thin and stateless: it holds no history of its
 * own. The client owns the transcript, executes any tool calls against the
 * local store, and posts the whole thing back. That keeps the student's data
 * on their device between turns rather than accumulating on a server.
 */

// Pinned to an exact model rather than a floating alias: a model swapping
// itself under a running app changes both the cost and the shape of what
// comes back. Bumping it should be a commit. Check the deprecation list
// before changing — 2.0-flash was shut down on 2026-06-01.
// https://ai.google.dev/gemini-api/docs/deprecations
const MODEL = "gemini-3.8-flash";

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** Roughly 15 turns. Long enough to hold a conversation, short enough to bound cost. */
const MAX_CONTENTS = 30;

interface Part {
  text?: string;
  /** Gemini 3 marks its internal reasoning; it must be kept but never shown. */
  thought?: boolean;
  /**
   * Opaque proof that the reasoning behind a part came from the model. Gemini
   * 3 rejects a follow-up request whose functionCall parts have lost theirs,
   * so parts are round-tripped verbatim rather than rebuilt.
   */
  thoughtSignature?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface Content {
  role: "user" | "model";
  parts: Part[];
}

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "The assistant is not configured: GEMINI_API_KEY is missing on the server." },
      { status: 503 },
    );
  }

  let body: { contents?: unknown; context?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const contents = body.contents;
  if (!Array.isArray(contents) || contents.length === 0) {
    return NextResponse.json(
      { error: "`contents` must be a non-empty array." },
      { status: 400 },
    );
  }

  // The snapshot of the student's hub rides in the system instruction rather
  // than as a first user turn, so it cannot be argued with by later messages
  // and does not read as something the student said.
  const context = typeof body.context === "string" ? body.context : "";

  let response: Response;
  try {
    response = await fetchGemini(ENDPOINT, key, {
      systemInstruction: {
        parts: [
          { text: `${SYSTEM_INSTRUCTION}\n\n# The student's hub, right now\n\n${context}` },
        ],
      },
      contents: (contents as Content[]).slice(-MAX_CONTENTS),
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    });
  } catch (e) {
    // Logged with the cause: "could not reach" covers DNS, TLS, a proxy and a
    // timeout, and they need different fixes.
    console.error("Gemini fetch failed:", e);
    return NextResponse.json({ error: "Could not reach the AI service." }, { status: 502 });
  }

  if (!response.ok) {
    // Google's error bodies can echo the request back, and the request
    // contains the student's journal — so this is logged, never returned.
    console.error(
      "Gemini request failed",
      response.status,
      await response.text().catch(() => ""),
    );
    const message =
      response.status === 429
        ? "The assistant is rate-limited right now. Try again in a moment."
        : "The assistant could not answer that. Try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const data = await response.json();
  const parts: Part[] = data?.candidates?.[0]?.content?.parts ?? [];

  // Reasoning parts are structural, not content: they carry the signatures the
  // next request needs, but showing them to the student would be showing
  // working-out they did not ask for.
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  const calls = parts
    .filter(
      (p): p is Part & { functionCall: NonNullable<Part["functionCall"]> } => !!p.functionCall,
    )
    .map((p) => ({ name: p.functionCall.name, args: p.functionCall.args ?? {} }));

  if (text === "" && calls.length === 0) {
    // Usually a safety block or a hit token ceiling; either way there is
    // nothing to render, and an empty bubble looks like a bug.
    return NextResponse.json(
      { error: "The assistant had nothing to say. Try rephrasing." },
      { status: 502 },
    );
  }

  // `parts` goes back verbatim for the client to replay into the next turn.
  // Rebuilding the model's turn from `text` and `calls` is what dropped the
  // thought signatures and had Gemini reject the follow-up.
  return NextResponse.json({ parts, text, calls });
}
