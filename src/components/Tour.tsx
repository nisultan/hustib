"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";
import { Button } from "./ui";
import {
  ArtDashboard,
  ArtGetStarted,
  ArtGrades,
  ArtQuickAdd,
  ArtRecommendations,
  ArtTasks,
  ArtUniversities,
  ArtWelcome,
} from "./TourArt";
import { Logo } from "./Logo";

export const TOUR_SEEN_KEY = "iblearner.tourSeen";

interface Step {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  points?: string[];
  art: ReactNode;
}

const STEPS: Step[] = [
  {
    id: "welcome",
    eyebrow: "Welcome",
    title: "One place for your whole academic life",
    body: "Tasks, notes, grades and university applications live together — so instead of checking four apps, you open one and know where you stand.",
    points: [
      "No more notes in one app and deadlines in another",
      "Everything stays on your device",
    ],
    art: <ArtWelcome />,
  },
  {
    id: "home",
    eyebrow: "Home",
    title: "Answers five questions in ten seconds",
    body: "The dashboard opens with what needs your attention today, what is coming, how your grades are moving, and what to do next.",
    points: [
      "Today's work, overdue items included",
      "Your next deadlines at a glance",
      "Course averages with trend arrows",
    ],
    art: <ArtDashboard />,
  },
  {
    id: "tasks",
    eyebrow: "Tasks & Notes",
    title: "The note lives on the task",
    body: "Write the task and everything you need to do it in the same place. Tag it with a course, topic, priority and deadline, then slice the list however you think.",
    points: [
      "Views: All, Today, Upcoming, Completed, By course, By priority",
      "Four priorities, three statuses",
    ],
    art: <ArtTasks />,
  },
  {
    id: "quick-add",
    eyebrow: "Quick add",
    title: "Write it the way you would say it",
    body: "Type a sentence and the course, deadline, time and priority are pulled out for you. Everything it worked out is shown, and you can change any of it before saving.",
    points: [
      "Understands “tomorrow”, “friday”, “Sep 18”, “in 3 days”",
      "Nothing is saved until you confirm it",
    ],
    art: <ArtQuickAdd />,
  },
  {
    id: "grades",
    eyebrow: "Grades",
    title: "Averages worked out, not guessed",
    body: "Record each assessment with its weight and the maths is done for you — per course, overall, and where you are heading. It always tells you how it got the number.",
    points: [
      "Weighted averages, or plain means when you have no weights",
      "What if? — see where one future score would put you",
      "Charts that show improving, declining or stable",
    ],
    art: <ArtGrades />,
  },
  {
    id: "universities",
    eyebrow: "Universities",
    title: "Applications, with the deadlines that matter",
    body: "Track every university from first interest through to a decision, sorted into dream, target and safety, with a notes field for scholarships, essays and requirements.",
    points: [
      "Seven application statuses, from Interested to Accepted",
      "Your next deadline is surfaced on the dashboard",
    ],
    art: <ArtUniversities />,
  },
  {
    id: "recommendations",
    eyebrow: "Recommendations",
    title: "Signals combined, not just listed",
    body: "A low grade is one thing. A low grade plus a test in two days plus unfinished work is something you should act on today — and that is what you get told.",
    points: ["Short, specific and about your own data", "Nothing leaves your device"],
    art: <ArtRecommendations />,
  },
  {
    id: "start",
    eyebrow: "Get started",
    title: "Your hub is empty — let's fill it",
    body: "Add your courses first; tasks and grades attach to them. You can do the rest in any order, and the dashboard gets more useful with each piece.",
    art: <ArtGetStarted />,
  },
];

export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const router = useRouter();
  const mounted = useMounted();

  const [index, setIndex] = useState(0);
  // Drives the enter animation's direction so going back feels like going back.
  const [direction, setDirection] = useState<1 | -1>(1);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  useEffect(() => {
    if (open) {
      setIndex(0);
      setDirection(1);
    }
  }, [open]);

  const go = useCallback((delta: 1 | -1) => {
    setIndex((i) => {
      const next = i + delta;
      if (next < 0 || next >= STEPS.length) return i;
      setDirection(delta);
      return next;
    });
  }, []);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(TOUR_SEEN_KEY, "1");
    } catch {
      // Storage blocked — the tour reappears next visit, which is harmless.
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, finish, go]);

  if (!open || !mounted) return null;

  const startFresh = () => {
    finish();
    router.push("/courses");
  };

  const exploreSample = () => {
    store.resetToSample();
    finish();
    router.push("/");
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Product tour"
    >
      <div className="fade-up flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-panel shadow-2xl sm:max-w-3xl sm:rounded-2xl">
        {/* Header: progress and an always-available exit. */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="nums text-[11px] text-ink-3">
              {index + 1} of {STEPS.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5" aria-hidden>
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => {
                  setDirection(i > index ? 1 : -1);
                  setIndex(i);
                }}
                aria-label={`Go to step ${i + 1}: ${s.title}`}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === index ? 18 : 6,
                  background: i === index ? "var(--accent)" : "var(--border-strong)",
                }}
              />
            ))}
          </div>

          <button
            onClick={finish}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
          >
            Skip
          </button>
        </div>

        {/* Body. Keyed on the step so the illustration remounts and replays. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div key={step.id} className={direction === 1 ? "tour-enter" : "tour-enter-back"}>
            <div className="grid gap-5 px-4 py-5 sm:grid-cols-2 sm:items-center sm:gap-7 sm:px-6 sm:py-7">
              <div className="order-2 sm:order-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-accent-text">
                  {step.eyebrow}
                </p>
                <h2 className="mt-2 text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
                  {step.title}
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-2">{step.body}</p>

                {step.points && (
                  <ul className="mt-4 space-y-2">
                    {step.points.map((p, i) => (
                      <li
                        key={p}
                        className="rise flex items-start gap-2 text-[13px] text-ink-2"
                        style={{ "--d": `${260 + i * 110}ms` } as React.CSSProperties}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden
                          className="mt-0.5 shrink-0 text-accent"
                        >
                          <path
                            d="m3 8.4 3.2 3.2L13 4.8"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {p}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="order-1 sm:order-2">{step.art}</div>
            </div>
          </div>
        </div>

        {/* Footer: navigation, or the two ways to begin on the last step. */}
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-6">
          <Button variant="ghost" onClick={() => go(-1)} disabled={index === 0}>
            Back
          </Button>

          {isLast ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={exploreSample}>Explore with sample data</Button>
              <Button variant="primary" onClick={startFresh}>
                Add my first course
              </Button>
            </div>
          ) : (
            <Button variant="primary" onClick={() => go(1)}>
              Next
              <span aria-hidden>→</span>
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Opens the tour once, on a student's first visit.
 *
 * Gated on the store being ready and empty as well as the flag: someone who
 * already has courses does not need a welcome, even in a browser that lost
 * the flag.
 */
export function TourHost() {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!store.ready || checked) return;
    setChecked(true);

    let seen = true;
    try {
      seen = localStorage.getItem(TOUR_SEEN_KEY) === "1";
    } catch {
      // Storage blocked; skip the tour rather than showing it every navigation.
    }

    const isNew = store.courses.length === 0 && store.tasks.length === 0;
    if (!seen && isNew) setOpen(true);
  }, [store.ready, store.courses.length, store.tasks.length, checked]);

  useEffect(() => {
    const replay = () => setOpen(true);
    window.addEventListener("iblearner:open-tour", replay);
    return () => window.removeEventListener("iblearner:open-tour", replay);
  }, []);

  return <Tour open={open} onClose={() => setOpen(false)} />;
}

/** Replays the tour from anywhere (Settings, the empty dashboard). */
export function openTour(): void {
  window.dispatchEvent(new Event("iblearner:open-tour"));
}
