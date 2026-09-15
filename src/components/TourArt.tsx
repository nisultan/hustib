"use client";

import { ReactNode } from "react";

/**
 * Animated mini-mockups for the onboarding tour — one per step.
 *
 * These are deliberately not screenshots. They are simplified, schematic
 * versions of each page that animate their point into place: the dashboard
 * fills in top to bottom, the chart draws itself, the quick-add box types a
 * sentence and the fields fill from it. Each mounts fresh when its step
 * becomes active, so the animation plays on every visit to the step.
 *
 * `--d` sets a per-element delay; see the tour keyframes in globals.css.
 */

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative overflow-hidden rounded-xl border border-line bg-panel-2 p-3 sm:p-4"
      style={{ aspectRatio: "16 / 10" }}
    >
      {children}
    </div>
  );
}

function Card({
  children,
  className = "",
  delay = 0,
  anim = "rise",
}: {
  children?: ReactNode;
  className?: string;
  delay?: number;
  anim?: "rise" | "pop";
}) {
  return (
    <div
      className={`${anim} rounded-lg border border-line bg-panel ${className}`}
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/** A grey bar standing in for a line of text. */
function Line({ w = "100%", h = 5, dim = false }: { w?: string; h?: number; dim?: boolean }) {
  return (
    <span
      className="block rounded-full"
      style={{
        width: w,
        height: h,
        background: dim ? "var(--border)" : "var(--border-strong)",
      }}
    />
  );
}

function Dot({ tone }: { tone: string }) {
  return (
    <span
      className="inline-block size-1.5 shrink-0 rounded-full"
      style={{ background: `var(--${tone})` }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Welcome — the four areas converging on one hub                          */
/* -------------------------------------------------------------------------- */

export function ArtWelcome() {
  const areas = [
    { label: "Tasks", tone: "high" },
    { label: "Grades", tone: "medium" },
    { label: "Courses", tone: "up" },
    { label: "Universities", tone: "accent" },
  ];

  return (
    <Frame label="Four areas — tasks, grades, courses and universities — feeding one hub">
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <div
          className="pop grid size-12 place-items-center rounded-xl bg-accent text-sm font-bold text-white"
          style={{ "--d": "80ms" } as React.CSSProperties}
        >
          IB
        </div>

        <svg viewBox="0 0 200 26" className="w-full max-w-[280px]" aria-hidden>
          {[28, 76, 124, 172].map((x, i) => (
            <path
              key={x}
              d={`M100 1 C100 14, ${x} 10, ${x} 25`}
              fill="none"
              stroke="var(--border-strong)"
              strokeWidth="1"
              pathLength={1}
              className="draw"
              style={{ "--d": `${260 + i * 90}ms` } as React.CSSProperties}
            />
          ))}
        </svg>

        <div className="grid w-full max-w-[320px] grid-cols-4 gap-1.5">
          {areas.map((a, i) => (
            <Card
              key={a.label}
              delay={420 + i * 90}
              anim="pop"
              className="px-1.5 py-2 text-center"
            >
              <span
                className="mx-auto mb-1 block size-1.5 rounded-full"
                style={{ background: `var(--${a.tone})` }}
              />
              <span className="block text-[9px] font-medium text-ink-2">{a.label}</span>
            </Card>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Home dashboard                                                          */
/* -------------------------------------------------------------------------- */

export function ArtDashboard() {
  return (
    <Frame label="The dashboard: a recommendation, today's tasks and course averages">
      <div className="flex h-full flex-col gap-2">
        <div className="rise" style={{ "--d": "60ms" } as React.CSSProperties}>
          <div className="text-[11px] font-semibold">Good morning, Sultan 👋</div>
          <div className="mt-0.5 text-[8px] text-ink-3">
            Here&apos;s what needs your attention.
          </div>
        </div>

        <Card delay={220} className="halo flex items-start gap-1.5 px-2 py-1.5">
          <span className="text-[9px]" aria-hidden>
            💡
          </span>
          <span className="flex-1 space-y-1 pt-0.5">
            <Line w="92%" h={4} />
            <Line w="64%" h={4} dim />
          </span>
        </Card>

        <div className="grid min-h-0 flex-1 grid-cols-[1.3fr_1fr] gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[7px] font-semibold uppercase tracking-wider text-ink-3">
              Today
            </span>
            {[
              { tone: "urgent", w: "76%" },
              { tone: "high", w: "62%" },
              { tone: "medium", w: "70%" },
            ].map((t, i) => (
              <Card
                key={i}
                delay={420 + i * 110}
                className="flex items-center gap-1.5 px-2 py-1.5"
              >
                <span className="size-2 shrink-0 rounded-[3px] border border-line-strong" />
                <Dot tone={t.tone} />
                <Line w={t.w} h={4} />
              </Card>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[7px] font-semibold uppercase tracking-wider text-ink-3">
              Overview
            </span>
            <Card delay={480} className="flex-1 px-2 py-1.5">
              <div className="nums text-[13px] font-semibold leading-none">87.9%</div>
              <div className="mt-2 space-y-1.5">
                {[93, 88, 78].map((v, i) => (
                  <div key={v} className="flex items-center gap-1">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-panel-2">
                      <span
                        className="grow-x block h-full rounded-full bg-accent"
                        style={
                          { width: `${v}%`, "--d": `${700 + i * 140}ms` } as React.CSSProperties
                        }
                      />
                    </span>
                    <span className="nums text-[7px] text-ink-3">{v}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Tasks and notes                                                         */
/* -------------------------------------------------------------------------- */

export function ArtTasks() {
  const views = ["All", "Today", "Upcoming", "By course"];

  return (
    <Frame label="Task list with views, priorities and an attached note">
      <div className="flex h-full flex-col gap-2">
        <div className="rise flex gap-1" style={{ "--d": "60ms" } as React.CSSProperties}>
          {views.map((v, i) => (
            <span
              key={v}
              className={`rounded-md px-1.5 py-0.5 text-[8px] font-medium ${
                i === 0 ? "bg-accent-soft text-accent-text" : "text-ink-3"
              }`}
            >
              {v}
            </span>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1">
          {[
            { tone: "urgent", label: "Urgent", w: "70%", note: false },
            { tone: "high", label: "High", w: "58%", note: true },
            { tone: "medium", label: "Medium", w: "66%", note: false },
            { tone: "low", label: "Low", w: "48%", note: false },
          ].map((t, i) => (
            <Card key={i} delay={220 + i * 120} className="px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="size-2 shrink-0 rounded-[3px] border border-line-strong" />
                <Dot tone={t.tone} />
                <span className="flex-1">
                  <Line w={t.w} h={4} />
                </span>
                <span className="text-[7px] font-medium" style={{ color: `var(--${t.tone})` }}>
                  {t.label}
                </span>
              </div>
              {t.note && (
                <div
                  className="rise mt-1.5 rounded-md bg-panel-2 px-1.5 py-1"
                  style={{ "--d": `${220 + i * 120 + 260}ms` } as React.CSSProperties}
                >
                  <div className="mb-1 text-[7px] font-medium text-ink-3">Note</div>
                  <Line w="88%" h={3} dim />
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Quick add                                                               */
/* -------------------------------------------------------------------------- */

export function ArtQuickAdd() {
  const fields = [
    { label: "Course", value: "Physics SL" },
    { label: "Deadline", value: "Fri 18 Sep" },
    { label: "Time", value: "17:00" },
    { label: "Priority", value: "High" },
  ];

  return (
    <Frame label="A typed sentence being turned into structured task fields">
      <div className="flex h-full flex-col justify-center gap-3">
        <div>
          <div className="mb-1 text-[7px] font-semibold uppercase tracking-wider text-ink-3">
            You type
          </div>
          {/* nowrap keeps the caret on the same line as the text as it grows. */}
          <Card
            delay={60}
            className="flex items-center overflow-hidden whitespace-nowrap px-2 py-2"
          >
            <span
              className="typing text-[9px] text-ink"
              style={{ "--d": "260ms" } as React.CSSProperties}
            >
              finish physics lab by friday at 5pm, it&apos;s important
            </span>
            <span
              className="caret ml-px inline-block h-3 w-px shrink-0"
              style={{ background: "var(--accent)", "--d": "260ms" } as React.CSSProperties}
            />
          </Card>
        </div>

        <div className="flex justify-center" aria-hidden>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className="pop text-ink-3"
            style={{ "--d": "1850ms" } as React.CSSProperties}
          >
            <path
              d="M8 2.5v11M4 9.5l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div>
          <div className="mb-1 text-[7px] font-semibold uppercase tracking-wider text-ink-3">
            It fills in
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {fields.map((f, i) => (
              <Card key={f.label} delay={2000 + i * 130} anim="pop" className="px-1.5 py-1.5">
                <div className="text-[7px] text-ink-3">{f.label}</div>
                <div className="mt-0.5 truncate text-[8px] font-medium text-accent-text">
                  {f.value}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

/* -------------------------------------------------------------------------- */
/* 5. Grades                                                                  */
/* -------------------------------------------------------------------------- */

export function ArtGrades() {
  return (
    <Frame label="A grade chart drawing itself, with weighted averages and a what-if projection">
      <div className="flex h-full flex-col gap-2">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { k: "Average", v: "87.9%" },
            { k: "Trend", v: "↑ 2.4%" },
            { k: "Predicted", v: "89.2%" },
          ].map((s, i) => (
            <Card key={s.k} delay={80 + i * 110} className="px-1.5 py-1.5">
              <div className="text-[7px] uppercase tracking-wider text-ink-3">{s.k}</div>
              <div
                className="nums mt-0.5 text-[11px] font-semibold"
                style={i === 1 ? { color: "var(--up)" } : undefined}
              >
                {s.v}
              </div>
            </Card>
          ))}
        </div>

        <Card delay={340} className="relative min-h-0 flex-1 px-2 py-2">
          <svg
            viewBox="0 0 200 64"
            className="h-full w-full"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="tour-grade-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {[14, 32, 50].map((y) => (
              <line
                key={y}
                x1="0"
                x2="200"
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth="0.6"
              />
            ))}

            <g className="reveal-up" style={{ "--d": "620ms" } as React.CSSProperties}>
              <path
                d="M4 52 L52 44 L100 30 L148 22 L196 12 L196 62 L4 62 Z"
                fill="url(#tour-grade-fill)"
              />
            </g>

            <path
              d="M4 52 L52 44 L100 30 L148 22 L196 12"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="draw"
              style={{ "--d": "520ms" } as React.CSSProperties}
            />

            {[
              [4, 52],
              [52, 44],
              [100, 30],
              [148, 22],
              [196, 12],
            ].map(([cx, cy], i) => (
              <circle
                key={cx}
                cx={cx}
                cy={cy}
                r="2.6"
                fill="var(--panel)"
                stroke="var(--accent)"
                strokeWidth="1.6"
                className="pop"
                style={{ "--d": `${700 + i * 150}ms` } as React.CSSProperties}
              />
            ))}
          </svg>
        </Card>

        <Card delay={1500} className="flex items-center gap-2 px-2 py-1.5">
          <span className="text-[7px] font-semibold uppercase tracking-wider text-ink-3">
            What if?
          </span>
          <span className="nums text-[8px] text-ink-2">Score 95%</span>
          <span className="text-[8px] text-ink-3" aria-hidden>
            →
          </span>
          <span className="nums text-[9px] font-semibold text-accent-text">89.1%</span>
        </Card>
      </div>
    </Frame>
  );
}

/* -------------------------------------------------------------------------- */
/* 6. Universities                                                            */
/* -------------------------------------------------------------------------- */

export function ArtUniversities() {
  const unis = [
    { name: "NYU Abu Dhabi", flag: "🇦🇪", tag: "Dream", status: "Preparing", tone: "high" },
    { name: "Toronto", flag: "🇨🇦", tag: "Target", status: "Researching", tone: "medium" },
    { name: "TU Delft", flag: "🇳🇱", tag: "Target", status: "Interested", tone: "low" },
    { name: "Nazarbayev", flag: "🇰🇿", tag: "Safety", status: "Applied", tone: "accent" },
  ];

  return (
    <Frame label="University list grouped by dream, target and safety, with the next deadline">
      <div className="flex h-full flex-col gap-2">
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { k: "Dream", v: 3 },
            { k: "Target", v: 5 },
            { k: "Safety", v: 2 },
          ].map((c, i) => (
            <Card
              key={c.k}
              delay={80 + i * 110}
              anim="pop"
              className="px-1.5 py-1.5 text-center"
            >
              <div className="nums text-[13px] font-semibold leading-none">{c.v}</div>
              <div className="mt-0.5 text-[7px] text-ink-3">{c.k}</div>
            </Card>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5">
          {unis.map((u, i) => (
            <Card key={u.name} delay={420 + i * 110} className="flex flex-col px-2 py-1.5">
              <div className="flex items-start justify-between gap-1">
                <span className="truncate text-[8px] font-semibold">
                  {u.flag} {u.name}
                </span>
                <span className="shrink-0 rounded px-1 py-px text-[6px] font-medium text-accent-text bg-accent-soft">
                  {u.tag}
                </span>
              </div>
              <span className="mt-auto flex items-center gap-1 pt-1.5 text-[7px] text-ink-3">
                <Dot tone={u.tone} />
                {u.status}
              </span>
            </Card>
          ))}
        </div>

        <Card delay={900} className="flex items-center justify-between px-2 py-1.5">
          <span className="text-[7px] uppercase tracking-wider text-ink-3">Next deadline</span>
          <span className="nums text-[8px] font-medium">NYU Abu Dhabi · Jan 5</span>
        </Card>
      </div>
    </Frame>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Recommendations — three signals combining into one instruction          */
/* -------------------------------------------------------------------------- */

export function ArtRecommendations() {
  const signals = [
    { k: "Lowest grade", v: "Physics 77%", tone: "down" },
    { k: "Test in", v: "2 days", tone: "high" },
    { k: "Unfinished", v: "3 tasks", tone: "medium" },
  ];

  return (
    <Frame label="Three separate signals combining into a single recommendation">
      <div className="flex h-full flex-col justify-center gap-2.5">
        <div className="grid grid-cols-3 gap-1.5">
          {signals.map((s, i) => (
            <Card key={s.k} delay={100 + i * 160} anim="pop" className="px-1.5 py-1.5">
              <div className="flex items-center gap-1">
                <Dot tone={s.tone} />
                <span className="text-[7px] text-ink-3">{s.k}</span>
              </div>
              <div className="mt-0.5 truncate text-[8px] font-medium">{s.v}</div>
            </Card>
          ))}
        </div>

        <svg viewBox="0 0 200 22" className="w-full" aria-hidden>
          {[33, 100, 167].map((x, i) => (
            <path
              key={x}
              d={`M${x} 1 C${x} 12, 100 8, 100 21`}
              fill="none"
              stroke="var(--border-strong)"
              strokeWidth="1"
              pathLength={1}
              className="draw"
              style={{ "--d": `${620 + i * 110}ms` } as React.CSSProperties}
            />
          ))}
        </svg>

        <Card delay={1100} className="halo flex items-start gap-1.5 px-2.5 py-2">
          <span className="text-[10px]" aria-hidden>
            💡
          </span>
          <span className="text-[8px] leading-relaxed text-ink-2">
            <span className="font-medium text-ink">Prioritize Physics SL today.</span> It is
            your lowest course at 77.7%, &ldquo;Physics test&rdquo; is in 2 days, and you have 3
            unfinished tasks.
          </span>
        </Card>
      </div>
    </Frame>
  );
}

/* -------------------------------------------------------------------------- */
/* 8. Getting started — the setup order                                       */
/* -------------------------------------------------------------------------- */

export function ArtGetStarted() {
  const steps = [
    { n: 1, label: "Add courses", hint: "Your subjects" },
    { n: 2, label: "Add tasks", hint: "With deadlines" },
    { n: 3, label: "Add grades", hint: "As you get them" },
    { n: 4, label: "Add universities", hint: "Where you're applying" },
  ];

  return (
    <Frame label="The setup order: courses, then tasks, then grades, then universities">
      <div className="flex h-full flex-col justify-center gap-1.5">
        {steps.map((s, i) => (
          <Card
            key={s.n}
            delay={120 + i * 170}
            className="flex items-center gap-2.5 px-2.5 py-2"
          >
            <span
              className="pop grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[9px] font-semibold text-accent-text"
              style={{ "--d": `${120 + i * 170 + 120}ms` } as React.CSSProperties}
            >
              {s.n}
            </span>
            <span className="flex-1">
              <span className="block text-[9px] font-medium">{s.label}</span>
              <span className="block text-[7px] text-ink-3">{s.hint}</span>
            </span>
            {i < steps.length - 1 && (
              <span className="text-[8px] text-ink-3" aria-hidden>
                ↓
              </span>
            )}
          </Card>
        ))}
      </div>
    </Frame>
  );
}
