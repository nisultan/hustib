"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useStore } from "@/lib/store";
import { addDays, formatDate, todayISO } from "@/lib/dates";
import { COURSE_COLORS } from "@/lib/appearance";
import { progressOf } from "@/lib/goals/tracker";
import { daysSince, lastTouched, paceOf, picturesOf, pushStreak } from "@/lib/goals/pulse";
import { extrasOf, Goal, GoalExtras, GoalStatus, Priority, PRIORITIES, PRIORITY_LABEL } from "@/lib/types";
import { Cover, Flame, ImageAdder, PaceBars, Tint } from "@/components/goals/parts";
import { TimeLeft, useNow } from "@/components/ReportTimers";
import { DateField } from "@/components/DateField";
import { GoalDialog } from "@/components/GoalDialog";
import { Celebration } from "@/components/Celebration";

/**
 * One goal, as a page: a cover you can reposition, properties down the side
 * like a database row, your reasons as callouts, a milestone checklist, the
 * days you pushed, and a gallery. Everything edits in place.
 */
export default function GoalPage() {
  const store = useStore();
  const params = useParams<{ id: string }>();
  const goal = store.goals.find((g) => g.id === params.id);

  if (!store.ready) return <div className="h-64" aria-busy="true" />;
  if (!goal) {
    return (
      <div className="page-in py-20 text-center">
        <p className="text-[15px] font-semibold">That goal isn&apos;t here.</p>
        <Link href="/goals" className="mt-3 inline-block text-[13px] font-medium text-accent-text hover:underline">
          ← Back to goals
        </Link>
      </div>
    );
  }
  return <GoalView key={goal.id} goal={goal} />;
}

function GoalView({ goal }: { goal: Goal }) {
  const store = useStore();
  const router = useRouter();
  const now = useNow();
  const today = todayISO();
  const ex = extrasOf(goal);
  const pics = picturesOf(goal, ex);
  const { value: progress, tracked } = progressOf(goal, store);
  const pace = paceOf(goal, progress, now);
  const streak = pushStreak(ex.pushes, today);
  const quiet = daysSince(lastTouched(goal, ex), today);
  const pushed = ex.pushes.includes(today);
  const locked = goal.status === "missed";

  const [settings, setSettings] = useState(false);
  const [adding, setAdding] = useState(false);
  const [reposition, setReposition] = useState(false);
  const [celebrate, setCelebrate] = useState<string | null>(null);

  const setEx = (patch: Partial<GoalExtras>) => store.updateGoal(goal.id, { extras: { ...ex, ...patch } });
  const togglePush = () =>
    setEx({ pushes: pushed ? ex.pushes.filter((d) => d !== today) : [...ex.pushes, today].slice(-400) });

  const setStatus = (s: GoalStatus) => {
    if (s === goal.status) return;
    store.setGoalStatus(goal.id, s);
    if (s === "achieved") setCelebrate(goal.title);
  };

  return (
    <div className="page-in -mt-2">
      {/* ------------------------------- Cover ------------------------------- */}
      <div className="group/cover relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-3xl">
        {pics.length > 0 ? (
          <Cover pictures={pics} y={ex.coverY} interval={reposition ? 10 ** 9 : 7000} className="h-[260px] w-full sm:h-[300px]">
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
          </Cover>
        ) : (
          <Tint color={ex.color} className="h-[200px] w-full" />
        )}
        {reposition && pics.length > 0 && <RepositionLayer y={ex.coverY} onChange={(y) => setEx({ coverY: y })} onDone={() => setReposition(false)} />}

        <div className="absolute left-4 top-4 z-[3]">
          <Link
            href="/goals"
            className="rounded-lg bg-black/40 px-2.5 py-1.5 text-[12px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-black/60"
          >
            ← Goals
          </Link>
        </div>
        {!locked && !reposition && (
          <div className="absolute right-4 top-4 z-[3] flex gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/cover:opacity-100">
            <CoverButton onClick={() => setAdding((a) => !a)}>{adding ? "Close" : "Add images"}</CoverButton>
            {pics.length > 0 && <CoverButton onClick={() => setReposition(true)}>Reposition</CoverButton>}
          </div>
        )}
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <ImageAdder
                onAdd={(src) => {
                  if (!goal.image) store.updateGoal(goal.id, { image: src });
                  else setEx({ gallery: [...ex.gallery, src].slice(0, 12) });
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------- Title ------------------------------- */}
      <div className="mx-auto mt-6 max-w-[860px]">
        <TitleInput value={goal.title} disabled={locked} onSave={(t) => store.updateGoal(goal.id, { title: t })} />

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
          {streak > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,#f59e0b_15%,transparent)] px-2.5 py-1 font-semibold text-[#f59e0b]">
              <Flame className="size-3" /> {streak}-day push streak
            </span>
          )}
          {goal.status === "active" && quiet >= 5 && (
            <span className="rounded-full bg-[color-mix(in_srgb,var(--urgent)_14%,transparent)] px-2.5 py-1 font-semibold text-[var(--urgent)]">
              Untouched for {quiet} days
            </span>
          )}
          {pace?.verdict && (
            <span className="rounded-full bg-panel-2 px-2.5 py-1 font-semibold text-ink-2">
              {Math.round(pace.time * 100)}% of the time gone · {Math.round((pace.done ?? 0) * 100)}% done
            </span>
          )}
        </div>

        {/* ---------------------------- Properties --------------------------- */}
        <div className="mt-6 grid gap-0.5 border-y border-line py-3">
          <Prop icon="M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM7 10.2l2 2 4-4.2" label="Status">
            {locked ? (
              <span className="text-[13px] font-semibold text-[var(--urgent)]">Missed — closed</span>
            ) : (
              <Chips
                value={goal.status}
                options={[
                  { id: "active", label: "Working on it", color: "var(--accent)" },
                  { id: "paused", label: "On hold", color: "var(--text-3)" },
                  { id: "achieved", label: "Achieved", color: "var(--up)" },
                ]}
                onChange={(s) => setStatus(s as GoalStatus)}
              />
            )}
          </Prop>
          <Prop icon="M4 16V4M4 4h10l-2 3.5 2 3.5H4" label="Priority">
            <Chips
              value={goal.priority}
              options={PRIORITIES.map((p) => ({ id: p, label: PRIORITY_LABEL[p], color: `var(--${p})` }))}
              onChange={(p) => !locked && store.updateGoal(goal.id, { priority: p as Priority })}
            />
          </Prop>
          <Prop icon="M3.5 5h13v11h-13zM3.5 8.5h13M7 3v3M13 3v3" label="Deadline">
            {goal.deadline ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[13px] font-medium">{formatDate(goal.deadline)}</span>
                {goal.status !== "achieved" && !locked && <TimeLeft ms={new Date(`${goal.deadline}T23:59:59`).getTime() - now} />}
              </div>
            ) : (
              <div className="w-[220px]">
                <DateField value="" onChange={(d) => d && store.updateGoal(goal.id, { deadline: d })} placeholder="Set once — it's a promise" />
              </div>
            )}
          </Prop>
          <Prop icon="M3 14 8 9l3 3 6-6M12.5 6H17v4.5" label="Progress">
            <div className="max-w-md flex-1">
              {pace ? (
                <PaceBars time={pace.time} done={pace.done} verdict={pace.verdict} />
              ) : progress != null ? (
                <PaceBars time={0} done={progress / 100} verdict={null} hideTime />
              ) : (
                <span className="text-[13px] text-ink-3">Not measured</span>
              )}
              {!goal.tracker && !locked && (
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={goal.progress ?? 0}
                  onChange={(e) => store.updateGoal(goal.id, { progress: Number(e.target.value) })}
                  className="mt-2 w-full accent-[var(--accent)]"
                  aria-label="Progress"
                />
              )}
              {tracked && <p className="mt-1 text-[11px] text-ink-3">{tracked.summary}</p>}
            </div>
          </Prop>
          <Prop icon="M4 6h12M4 10h12M4 14h7" label="Category">
            <select
              value={goal.categoryId ?? ""}
              disabled={locked}
              onChange={(e) => store.updateGoal(goal.id, { categoryId: e.target.value || null })}
              className="rounded-md bg-panel-2 px-2 py-1 text-[13px]"
            >
              <option value="">None</option>
              {store.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Prop>
          <Prop icon="M10 17a7 7 0 1 1 0-14c3.9 0 7 2.7 7 6 0 2-1.6 3-3.5 3H12a1.5 1.5 0 0 0-1 2.6c.4.4.5 1 .3 1.5-.2.5-.7.9-1.3.9z" label="Colour">
            <div className="flex flex-wrap gap-1.5">
              <Swatch active={ex.color == null} color="var(--panel-2)" onClick={() => setEx({ color: null })} label="None" />
              {COURSE_COLORS.map((c) => (
                <Swatch key={c.id} active={ex.color === c.id} color={c.value} onClick={() => setEx({ color: c.id })} label={c.label} />
              ))}
            </div>
          </Prop>
          <Prop icon="M10 3v2M10 15v2M3 10h2M15 10h2" label="Created">
            <span className="text-[13px] text-ink-2">{formatDate(goal.createdAt)}</span>
          </Prop>
        </div>

        {/* ----------------------------- Reasons ----------------------------- */}
        <SectionLabel>Your reasons</SectionLabel>
        <p className="-mt-1 mb-3 text-[12.5px] text-ink-3">
          These rotate on the goal&apos;s card and in Today&apos;s push — write them for the day you want to quit.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <Callout
            color="var(--accent)"
            label="Why it matters"
            placeholder="The real reason. Not the polite one."
            value={goal.note}
            disabled={locked}
            onSave={(v) => store.updateGoal(goal.id, { note: v })}
          />
          <Callout
            color="var(--up)"
            label="When I get there"
            placeholder="Picture the day it's done. What changes?"
            value={ex.reward}
            disabled={locked}
            onSave={(v) => setEx({ reward: v })}
          />
          <Callout
            color="var(--urgent)"
            label="If I let it go"
            placeholder="What it costs you to quit. Be honest."
            value={ex.cost}
            disabled={locked}
            onSave={(v) => setEx({ cost: v })}
          />
          <Callout
            color="var(--high)"
            label="My line"
            placeholder="One sentence to read when it gets hard."
            value={ex.mantra}
            disabled={locked}
            onSave={(v) => setEx({ mantra: v })}
          />
        </div>

        {/* ---------------------------- Milestones --------------------------- */}
        <Milestones ex={ex} disabled={locked} onChange={(milestones) => setEx({ milestones })} />

        {/* ----------------------------- Pushes ------------------------------ */}
        <SectionLabel>Days you pushed</SectionLabel>
        <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-line bg-panel p-4">
          <PushGrid pushes={ex.pushes} today={today} />
          <div className="ml-auto flex flex-col items-end gap-1">
            {!locked && goal.status !== "achieved" && (
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={togglePush}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13.5px] font-bold transition-colors ${
                  pushed ? "bg-[var(--up)] text-white" : "bg-accent text-white hover:opacity-90"
                }`}
              >
                <Flame />
                {pushed ? "Pushed today" : "I pushed today"}
              </motion.button>
            )}
            <span className="text-[11.5px] text-ink-3">
              {ex.pushes.filter((d) => d > addDays(today, -30)).length} of the last 30 days
            </span>
          </div>
        </div>

        {/* ----------------------------- Gallery ----------------------------- */}
        <SectionLabel>Gallery</SectionLabel>
        <Gallery
          goal={goal}
          ex={ex}
          disabled={locked}
          onCover={(src) => {
            const rest = pics.filter((p) => p !== src);
            store.updateGoal(goal.id, { image: src, extras: { ...ex, gallery: rest } });
          }}
          onRemove={(src) => {
            if (src === goal.image) {
              const [next, ...rest] = ex.gallery;
              store.updateGoal(goal.id, { image: next ?? null, extras: { ...ex, gallery: rest } });
            } else setEx({ gallery: ex.gallery.filter((g) => g !== src) });
          }}
          onAdd={(src) => {
            if (!goal.image) store.updateGoal(goal.id, { image: src });
            else setEx({ gallery: [...ex.gallery, src].slice(0, 12) });
          }}
        />

        {/* ------------------------------ Footer ----------------------------- */}
        <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-line pt-5 pb-10">
          {!locked && (
            <button
              onClick={() => setSettings(true)}
              className="rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              Tracking &amp; settings
            </button>
          )}
          <button
            onClick={() => {
              if (!window.confirm(`Delete “${goal.title}”? This can't be undone.`)) return;
              store.deleteGoal(goal.id);
              router.push("/goals");
            }}
            className="ml-auto rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-3 transition-colors hover:bg-[color-mix(in_srgb,var(--urgent)_12%,transparent)] hover:text-[var(--urgent)]"
          >
            Delete goal
          </button>
        </div>
      </div>

      <GoalDialog open={settings} goal={goal} onClose={() => setSettings(false)} />
      {celebrate && <Celebration title={celebrate} onDone={() => setCelebrate(null)} />}
    </div>
  );
}

/* --------------------------------- Pieces --------------------------------- */

/** Fits a textarea to its text, again whenever its width changes. */
function useAutoGrow(ref: React.RefObject<HTMLTextAreaElement | null>, text: string, min: number) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "0px";
      el.style.height = `${Math.max(min, el.scrollHeight)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    return () => ro.disconnect();
  }, [ref, text, min]);
}

function CoverButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-black/40 px-2.5 py-1.5 text-[12px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-black/60"
    >
      {children}
    </button>
  );
}

/** Drag the picture up or down to choose which part shows. */
function RepositionLayer({ y, onChange, onDone }: { y: number; onChange: (y: number) => void; onDone: () => void }) {
  const [value, setValue] = useState(y);
  const drag = useRef<{ start: number; from: number } | null>(null);
  return (
    <div
      className="absolute inset-0 z-[4] cursor-grab touch-none active:cursor-grabbing"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { start: e.clientY, from: value };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const next = Math.min(100, Math.max(0, drag.current.from - (e.clientY - drag.current.start) / 3));
        setValue(next);
        const img = (e.currentTarget.parentElement?.querySelectorAll("img") ?? []) as NodeListOf<HTMLImageElement>;
        img.forEach((el) => (el.style.objectPosition = `50% ${next}%`));
      }}
      onPointerUp={() => (drag.current = null)}
    >
      <div className="absolute inset-0 grid place-items-center">
        <span className="rounded-full bg-black/55 px-3 py-1.5 text-[12.5px] font-semibold text-white backdrop-blur-md">
          Drag to reposition
        </span>
      </div>
      <div className="absolute right-4 top-4 flex gap-1.5">
        <CoverButton
          onClick={() => {
            onChange(Math.round(value));
            onDone();
          }}
        >
          Save position
        </CoverButton>
        <CoverButton onClick={onDone}>Cancel</CoverButton>
      </div>
    </div>
  );
}

function TitleInput({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (t: string) => void }) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDraft(value), [value]);
  useAutoGrow(ref, draft, 0);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, ""))}
      onBlur={() => {
        const t = draft.trim();
        if (t && t !== value) onSave(t);
        else setDraft(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLTextAreaElement).blur();
      }}
      className="bare w-full resize-none overflow-hidden bg-transparent text-[34px] font-extrabold leading-tight tracking-tight sm:text-[40px]"
    />
  );
}

function Prop({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[40px] flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-panel-2/50">
      <span className="flex w-28 shrink-0 items-center gap-2 text-[13px] text-ink-3">
        <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
          <path d={icon} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

function Chips({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string; color: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`rounded-md px-2 py-1 text-[12px] font-semibold transition-colors ${on ? "" : "text-ink-3 hover:bg-panel-2 hover:text-ink"}`}
            style={on ? { color: o.color, background: `color-mix(in srgb, ${o.color} 15%, transparent)` } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Swatch({ active, color, onClick, label }: { active: boolean; color: string; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`size-6 rounded-full border border-line transition-transform hover:scale-110 ${active ? "ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--panel)]" : ""}`}
      style={{ background: color }}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 mt-10 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-3">{children}</h2>;
}

function Callout({
  color,
  label,
  placeholder,
  value,
  disabled,
  onSave,
}: {
  color: string;
  label: string;
  placeholder: string;
  value: string;
  disabled: boolean;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDraft(value), [value]);
  useAutoGrow(ref, draft, 44);
  return (
    <div
      className="rounded-xl border border-line px-4 py-3 transition-colors focus-within:border-line-strong"
      style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${color} 9%, var(--panel)), var(--panel) 70%)` }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color }}>
        {label}
      </p>
      <textarea
        ref={ref}
        rows={2}
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onSave(draft.trim())}
        className="bare mt-1 w-full resize-none overflow-hidden bg-transparent text-[14px] leading-relaxed placeholder:text-ink-3"
      />
    </div>
  );
}

function Milestones({ ex, disabled, onChange }: { ex: GoalExtras; disabled: boolean; onChange: (m: GoalExtras["milestones"]) => void }) {
  const [draft, setDraft] = useState("");
  const list = ex.milestones;
  const done = list.filter((m) => m.done).length;
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...list, { id: `m-${Date.now().toString(36)}`, text: t, done: false, doneAt: null }]);
    setDraft("");
  };
  return (
    <>
      <div className="mb-3 mt-10 flex items-baseline justify-between">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-3">Milestones</h2>
        {list.length > 0 && (
          <span className="nums text-[12px] font-semibold text-ink-2">
            {done}/{list.length} · {Math.round((done / list.length) * 100)}%
          </span>
        )}
      </div>
      {list.length > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-panel-2">
          <motion.div
            className="h-full rounded-full bg-[var(--up)]"
            animate={{ width: `${(done / list.length) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      )}
      <ul className="grid gap-0.5">
        <AnimatePresence initial={false}>
          {list.map((m) => (
            <motion.li
              key={m.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-panel-2/50"
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(list.map((x) => (x.id === m.id ? { ...x, done: !x.done, doneAt: !x.done ? todayISO() : null } : x)))
                }
                aria-label={m.done ? "Mark not done" : "Mark done"}
                className={`grid size-5 shrink-0 place-items-center rounded-md border-[1.5px] transition-colors ${
                  m.done ? "border-[var(--up)] bg-[var(--up)] text-white" : "border-[var(--border-strong)] hover:border-[var(--up)]"
                }`}
              >
                {m.done && (
                  <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} viewBox="0 0 20 20" className="size-3.5">
                    <path d="m5 10.5 3 3 7-7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </motion.svg>
                )}
              </button>
              <input
                defaultValue={m.text}
                disabled={disabled}
                onBlur={(e) => {
                  const t = e.target.value.trim();
                  if (!t) onChange(list.filter((x) => x.id !== m.id));
                  else if (t !== m.text) onChange(list.map((x) => (x.id === m.id ? { ...x, text: t } : x)));
                }}
                className={`bare min-w-0 flex-1 bg-transparent text-[14px] ${m.done ? "text-ink-3 line-through" : ""}`}
              />
              {m.doneAt && <span className="text-[11px] text-ink-3">{formatDate(m.doneAt)}</span>}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(list.filter((x) => x.id !== m.id))}
                  aria-label="Delete milestone"
                  className="grid size-6 place-items-center rounded-md text-ink-3 opacity-0 transition-opacity hover:text-[var(--urgent)] group-hover:opacity-100"
                >
                  ×
                </button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {!disabled && (
        <div className="mt-1 flex items-center gap-3 px-2 py-1.5">
          <span className="grid size-5 place-items-center text-ink-3">+</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            onBlur={add}
            placeholder={list.length === 0 ? "Break it down — the first milestone…" : "Add a milestone"}
            className="bare min-w-0 flex-1 bg-transparent text-[14px] placeholder:text-ink-3"
          />
        </div>
      )}
    </>
  );
}

/** The last 10 weeks, a square per day, lit where you pushed. */
function PushGrid({ pushes, today }: { pushes: string[]; today: string }) {
  const set = new Set(pushes);
  const days = Array.from({ length: 70 }, (_, i) => addDays(today, i - 69));
  const weeks = Array.from({ length: 10 }, (_, w) => days.slice(w * 7, w * 7 + 7));
  return (
    <div className="flex gap-[3px]">
      {weeks.map((col, w) => (
        <div key={w} className="flex flex-col gap-[3px]">
          {col.map((d, i) => (
            <motion.span
              key={d}
              title={formatDate(d)}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: (w * 7 + i) * 0.006 }}
              className={`size-3 rounded-[3px] ${d === today ? "ring-1 ring-[var(--text-3)]" : ""}`}
              style={{ background: set.has(d) ? "#f59e0b" : "var(--panel-2)" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Gallery({
  goal,
  ex,
  disabled,
  onCover,
  onRemove,
  onAdd,
}: {
  goal: Goal;
  ex: GoalExtras;
  disabled: boolean;
  onCover: (src: string) => void;
  onRemove: (src: string) => void;
  onAdd: (src: string) => void;
}) {
  const pics = picturesOf(goal, ex);
  return (
    <div>
      {pics.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {pics.map((src, i) => (
            <motion.div
              key={src.slice(0, 80) + i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-panel-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" referrerPolicy="no-referrer" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
              {i === 0 && (
                <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-md">
                  Cover
                </span>
              )}
              {!disabled && (
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  {i !== 0 && <CoverButton onClick={() => onCover(src)}>Make cover</CoverButton>}
                  <CoverButton onClick={() => onRemove(src)}>Remove</CoverButton>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
      {!disabled && pics.length < 13 && <ImageAdder onAdd={onAdd} />}
      {pics.length > 1 && <p className="mt-2 text-[11.5px] text-ink-3">Covers rotate through every picture here.</p>}
    </div>
  );
}
