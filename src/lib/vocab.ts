/**
 * Your own words for dictation.
 *
 * The browser's recogniser has no idea what "IELTS" or "Nazarbayev
 * University" is, so it writes whatever common words sound closest. This
 * repairs the transcript afterwards: each term you list is matched against
 * runs of spoken words, by spelling closeness and by any "heard as" variants
 * you give it, and the run is replaced with your spelling.
 *
 * One term per line. Optional variants after a colon:
 *   IELTS: yelts, i elts, aisles
 */

export const VOCAB_KEY = "lockin.dictation.words";

export const DEFAULT_VOCAB = ["IELTS: yelts, i elts, ielts, eye elts", "Nazarbayev University", "Doomsday Datathon"].join("\n");

export interface Term {
  term: string;
  variants: string[];
}

export function readVocab(): string {
  try {
    return localStorage.getItem(VOCAB_KEY) ?? DEFAULT_VOCAB;
  } catch {
    return DEFAULT_VOCAB;
  }
}

export function parseVocab(text: string): Term[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [term, rest = ""] = line.split(/:(.*)/s);
      return {
        term: term.trim(),
        variants: rest
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean),
      };
    })
    .filter((t) => t.term.length > 0);
}

const squash = (s: string) => s.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** How close a run of spoken words is to a term, 0..1. */
function closeness(heard: string, term: Term): number {
  const h = squash(heard);
  if (!h) return 0;
  let best = 0;
  for (const form of [term.term, ...term.variants]) {
    const f = squash(form);
    if (!f) continue;
    if (h === f) return 1;
    // Short words are too easy to confuse by spelling alone; only exact
    // matches and listed variants count for them.
    if (f.length < 5 || form !== term.term) continue;
    best = Math.max(best, 1 - distance(h, f) / Math.max(h.length, f.length));
  }
  return best;
}

const THRESHOLD = 0.75;

export function fixVocab(text: string, terms: Term[]): string {
  if (!terms.length || !text.trim()) return text;
  const words = text.split(/\s+/).filter(Boolean);
  const bestAt = (i: number) => {
    let pick: { term: string; len: number; score: number } | null = null;
    for (const t of terms) {
      const n = t.term.split(/\s+/).length;
      for (let len = Math.max(1, n - 1); len <= n + 2 && i + len <= words.length; len++) {
        const score = closeness(words.slice(i, i + len).join(" "), t);
        if (score >= THRESHOLD && (!pick || score > pick.score || (score === pick.score && len < pick.len))) {
          pick = { term: t.term, len, score };
        }
      }
    }
    return pick;
  };
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const pick = bestAt(i);
    // A run that starts one word later and fits as well means this word is
    // not part of the term ("go to nazarbaev university").
    const later = pick ? bestAt(i + 1) : null;
    if (pick && !(later && later.term === pick.term && later.score >= pick.score)) {
      // Keep punctuation the recogniser put after the last word.
      const tail = words[i + pick.len - 1].match(/[.,!?;:…]+$/)?.[0] ?? "";
      out.push(pick.term + tail);
      i += pick.len;
    } else {
      out.push(words[i]);
      i++;
    }
  }
  return out.join(" ");
}
