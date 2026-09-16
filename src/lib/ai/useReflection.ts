"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { buildContext } from "./context";
import { Insight, InsightKind, MemoryNote } from "@/lib/types";

/**
 * The hub thinking about the student, rather than answering them.
 *
 * Runs at most once a day and only when there is something to think about.
 * The alternative — reflecting on every page load — would spend tokens to
 * rediscover the same week, and worse, would keep rewriting the memory from a
 * dataset that had not changed.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Below this there is nothing to notice, and a confident portrait would be invented. */
const MIN_SIGNAL = 3;

const PAGES = [
  "/tasks",
  "/courses",
  "/grades",
  "/universities",
  "/weight",
  "/reflection",
];

export function useReflection() {
  const store = useStore();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a second pass starting while the first is in flight — the
  // two would race to overwrite the same memory with different revisions.
  const inFlight = useRef(false);

  const reflect = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRunning(true);
    setError(null);

    try {
      const pinned = store.memory.filter((n) => n.pinned);
      const revisable = store.memory.filter((n) => !n.pinned);

      const response = await fetch("/api/ai/reflect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          context: buildContext(store),
          memory: describeMemory(revisable, pinned),
          standing: describeStanding(store.insights),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "The reflection failed.");

      const now = new Date().toISOString();

      // Pinned notes are the student's and are re-attached here rather than
      // being sent for revision, so the model cannot quietly drop one.
      const revised = toMemory(data.memory, revisable, now);
      store.setMemory([...pinned, ...revised]);

      const insights = toInsights(data.insights, now);
      if (insights.length > 0) store.addInsights(insights);

      store.markReflected(now);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The reflection failed.");
    } finally {
      inFlight.current = false;
      setRunning(false);
    }
  }, [store]);

  // Automatic daily pass. Deliberately not on a timer: the student is not
  // sitting on this page waiting, and "once when they open it on a new day"
  // is what a daily rhythm actually looks like.
  useEffect(() => {
    if (!store.ready || inFlight.current) return;
    if (!hasEnoughToSay(store)) return;

    const last = store.reflectedAt ? Date.parse(store.reflectedAt) : 0;
    if (Number.isFinite(last) && Date.now() - last < DAY_MS) return;

    void reflect();
  }, [store, reflect]);

  return { reflect, running, error, ready: hasEnoughToSay(store) };
}

/** Enough recorded that a portrait would be observation rather than invention. */
function hasEnoughToSay(store: ReturnType<typeof useStore>): boolean {
  const journalled = store.days.filter(
    (d) => d.weight != null || d.reflection.some((b) => b.text.trim() !== ""),
  ).length;
  return store.tasks.length + store.grades.length + journalled >= MIN_SIGNAL;
}

function describeMemory(revisable: MemoryNote[], pinned: MemoryNote[]): string {
  if (revisable.length === 0 && pinned.length === 0) return "Nothing learned yet.";

  const lines = revisable.map((n) => `- [id ${n.id}] (${n.topic}) ${n.note}`);
  const kept = pinned.map((n) => `- (${n.topic}) ${n.note}`);

  return [
    lines.length > 0 ? lines.join("\n") : "- (nothing yet)",
    kept.length > 0
      ? `\nPinned by the student — preserved automatically, do not return these:\n${kept.join("\n")}`
      : "",
  ].join("\n");
}

function describeStanding(insights: Insight[]): string {
  const live = insights.filter((i) => i.dismissedAt == null).slice(0, 10);
  if (live.length === 0) return "None.";
  return live.map((i) => `- ${i.title}: ${i.body}`).join("\n");
}

/**
 * Turns the model's memory list back into notes.
 *
 * A returned id that matches an existing note keeps that note's creation date,
 * so "known since March" survives a rewording. Anything else is new.
 */
function toMemory(raw: unknown, existing: MemoryNote[], now: string): MemoryNote[] {
  if (!Array.isArray(raw)) return existing;

  const out: MemoryNote[] = [];
  for (const item of raw.slice(0, 25)) {
    const note = str(item?.note);
    if (!note) continue;

    const previous = existing.find((n) => n.id === str(item?.id));
    out.push({
      id: previous?.id ?? uid(),
      topic: str(item?.topic) ?? "General",
      note,
      source: oneOf(item?.source, ["reflection", "conversation", "pattern"], "pattern"),
      createdAt: previous?.createdAt ?? now,
      updatedAt: previous && previous.note === note ? previous.updatedAt : now,
      pinned: false,
    });
  }
  return out;
}

function toInsights(raw: unknown, now: string): Omit<Insight, "id">[] {
  if (!Array.isArray(raw)) return [];

  const out: Omit<Insight, "id">[] = [];
  for (const item of raw.slice(0, 3)) {
    const title = str(item?.title);
    const body = str(item?.body);
    if (!title || !body) continue;

    const href = str(item?.href);
    out.push({
      kind: oneOf(item?.kind, ["takeaway", "recommendation", "pattern"], "takeaway") as InsightKind,
      title,
      body,
      basis: str(item?.basis) ?? "",
      href: href && PAGES.includes(href) ? href : null,
      createdAt: now,
      dismissedAt: null,
    });
  }
  return out;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  const s = str(v);
  return s && (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
