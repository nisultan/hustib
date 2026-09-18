"use client";

import { ReactNode } from "react";
import { SOURCES } from "@/lib/activity";
import { Modal } from "./ui";

/**
 * How the Progress page arrives at what it shows.
 *
 * Every number on that page is derived rather than entered — nothing is typed
 * in, it is all counted from what was already done elsewhere in the hub — and
 * a derived number nobody can explain is a number nobody believes. The first
 * question anyone asks a wall chart is "why is Tuesday darker than Monday",
 * and if the answer is not available the chart quietly becomes decoration.
 *
 * Written as prose rather than a legend. A legend says what a colour means; it
 * cannot say why the scale is relative to your own busiest week, or why an
 * empty morning has not broken your streak yet, and those are the parts that
 * make the picture trustworthy rather than merely pretty.
 */
export function ProgressGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="How this page works" wide>
      <div className="grid gap-6 text-sm leading-relaxed text-ink-2">
        <p>
          Nothing here is typed in. Every square, bar and number is counted from
          things you already did on the other pages — so this page can only ever
          show you what actually happened, and it fills itself in as you go.
        </p>

        <Section title="What counts as “something done”">
          <p>Five things, and nothing else:</p>
          <ul className="mt-2 grid gap-1.5">
            {SOURCES.map((source) => (
              <li key={source.key} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-[5px] size-2 shrink-0 rounded-[3px]"
                  style={{ background: source.color }}
                />
                <span>
                  <span className="font-medium text-ink">{source.label}</span> —{" "}
                  {EXPLANATION[source.key]}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5">
            A task counts on the day you <em>ticked</em> it, not the day it was
            due. Finishing three weeks of overdue work on a Sunday shows up as a
            busy Sunday, because that is when you did the work.
          </p>
        </Section>

        <Section title="Why some squares are darker">
          <p>
            The shade is how much you did that day, measured against your own
            ordinary busy days — not against a fixed target and not against
            anybody else.
          </p>
          <p className="mt-2.5">
            The top of the scale is set near your 85th busiest day rather than
            your single busiest one. Otherwise one afternoon of clearing thirty
            tasks would set the bar, and every normal day for the rest of the
            year would look pale by comparison. A day with anything at all on it
            always gets at least the faintest shade, because a day that was not
            empty must never look empty.
          </p>
          <p className="mt-2.5">
            Click any square to open that day in Plan.
          </p>
        </Section>

        <Section title="The streak, and why a quiet morning does not break it">
          <p>
            The streak counts backwards from today for as long as each day has
            something on it. If today is still blank it counts back from
            yesterday instead — an unfinished morning is a streak that has not
            been extended yet, not a streak you have lost.
          </p>
          <p className="mt-2.5">
            <span className="font-medium text-ink">Best run</span> is the longest
            such stretch anywhere in the window you are looking at, which is why
            it changes when you switch between three months and a year.
          </p>
        </Section>

        <Section title="Week by week">
          <p>
            The same days, added up per week, so you can see a term take shape
            rather than a year of individual dots. The current week is marked as
            still running — a Tuesday is not a collapse in productivity, it is a
            week you are three days into.
          </p>
        </Section>

        <Section title="What it was made of, and by subject">
          <p>
            The first breakdown is which of the five kinds of thing your activity
            came from. The second counts only finished tasks, grouped by course
            or, for anything that is not coursework, by category — both in one
            list, because a fortnight that went entirely to one subject is only
            visible if everything is on the same scale.
          </p>
          <p className="mt-2.5">
            Bars are sized against the largest entry in their own group rather
            than against the total, so the small ones stay readable. The number
            beside each bar is the real count.
          </p>
        </Section>

        <Section title="Habits, one row each">
          <p>
            Six weeks, one row per habit, so a single one going wrong is visible
            instead of being averaged away by the four that are fine. Green is
            kept, faded red is missed, and blank means it was not due that day —
            a habit set to weekdays is not failing at the weekend.
          </p>
          <p className="mt-2.5">
            Today and anything later is never counted as a miss. The tally on the
            right reads <span className="whitespace-nowrap">kept / due</span>,
            counting only the days it was actually due.
          </p>
        </Section>

        <Section title="The score at the bottom is a different question">
          <p>
            Everything above is a record: what happened, without judgement. The
            consistency score at the end asks whether you are keeping it up,
            which needs weighting and fairness rules, so the two deliberately
            share no arithmetic.
          </p>
          <p className="mt-2.5">
            Signals you do not use are dropped from the score rather than counted
            as zero. Someone who never logs their weight is not worse at living;
            that signal simply is not part of their system, so its share is
            redistributed across the ones that are.
          </p>
        </Section>

        <Section title="There is no target here">
          <p>
            No goal line, no ideal streak, nothing to hit. A wall chart with a
            target on it stops being a record and becomes one more thing to fail
            at — and the point of this page is that a term of real work leaves a
            trace somewhere, instead of vanishing the moment the tasks are
            ticked.
          </p>
        </Section>
      </div>
    </Modal>
  );
}

/** Said in terms of the action that produces it, not the field it lands in. */
const EXPLANATION: Record<string, string> = {
  tasks: "a task you ticked off",
  plan: "a block on the plan you marked done",
  habits: "each habit you kept that day",
  reflection: "writing anything in the day's reflection",
  weight: "recording a weigh-in",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[13px] font-semibold tracking-tight text-ink">{title}</h3>
      {children}
    </section>
  );
}
