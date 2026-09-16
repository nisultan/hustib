/**
 * One call to Gemini, retried once if the connection itself failed.
 *
 * A TLS-inspecting proxy sits between many machines and the internet —
 * corporate middleboxes, and consumer antivirus doing the same thing — and
 * those reset long-lived connections often enough to matter. A reset is not a
 * refusal: the request never reached Google, so replaying it cannot duplicate
 * anything.
 *
 * Only transport failures are retried. An HTTP response, including 4xx and
 * 5xx, is returned as-is: a rejected request will be rejected again, and a
 * 429 in particular should back off rather than immediately knock again.
 */
export async function fetchGemini(
  endpoint: string,
  key: string,
  body: unknown,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
      });
    } catch (e) {
      lastError = e;
      // A short pause, because an immediate replay down the same broken
      // connection tends to fail the same way.
      if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
    }
  }

  throw lastError;
}
