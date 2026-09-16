import { NextResponse } from "next/server";

/**
 * Server-side proxy to Gemini.
 *
 * The key stays here. Calling Google straight from the browser would mean
 * shipping it in the bundle, where anyone can read it out of devtools and
 * spend the quota — so the client posts a prompt to this route instead and
 * only ever sees the generated text.
 */

// Pinned to an exact model rather than a floating alias: a model swapping
// itself under a running app changes both the cost and the shape of what
// comes back. Bumping it should be a commit. Check the deprecation list
// before changing — 2.0-flash was shut down on 2026-06-01.
// https://ai.google.dev/gemini-api/docs/deprecations
const MODEL = "gemini-3.8-flash";

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set on the server." },
      { status: 503 },
    );
  }

  let prompt: unknown;
  try {
    ({ prompt } = await request.json());
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (typeof prompt !== "string" || prompt.trim() === "") {
    return NextResponse.json({ error: "A `prompt` string is required." }, { status: 400 });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );

  if (!response.ok) {
    // Google's error bodies can echo request details, so they are logged
    // server-side rather than handed back to the browser.
    console.error("Gemini request failed", response.status, await response.text());
    return NextResponse.json({ error: "The AI request failed." }, { status: 502 });
  }

  const data = await response.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ??
    "";

  return NextResponse.json({ text });
}
