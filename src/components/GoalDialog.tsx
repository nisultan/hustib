"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  Goal,
  GOAL_STATUSES,
  GOAL_STATUS_LABEL,
  GoalStatus,
  Priority,
  PRIORITIES,
  PRIORITY_LABEL,
} from "@/lib/types";
import { prepareImage } from "@/lib/image";
import { GoalTracker } from "@/lib/types";
import { describe as describeTracker, sourceLabel } from "@/lib/goals/tracker";
import { suggestTracker } from "@/lib/goals/suggest";
import { COURSE_COLORS, courseColor } from "@/lib/appearance";
import { Button, ConfirmDeleteButton, Field, Input, Modal, Select, Textarea } from "./ui";
import { DateField } from "./DateField";

/**
 * Writing down a goal, or changing one.
 *
 * The picture comes first in the form because it is the part that makes the
 * card worth looking at later, and asking for it after four fields is asking
 * for it after someone has already decided they are finished.
 */
export function GoalDialog({
  open,
  goal,
  onClose,
}: {
  open: boolean;
  goal?: Goal;
  onClose: () => void;
}) {
  const store = useStore();

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<GoalStatus>("active");
  const [categoryId, setCategoryId] = useState("");
  /*
    Three ways a goal can carry a number, not two.

    "off" is still the default — most goals are not the kind of thing you can
    put a percentage on, and a bar sitting at 0% on one of those reads as
    failure. The new one is "auto": the hub works the number out from what it
    already records, which is the only version that stays true untouched.
  */
  const [mode, setMode] = useState<"off" | "manual" | "auto">("off");
  const [progress, setProgress] = useState(0);
  const [tracker, setTracker] = useState<GoalTracker | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  /*
    Seeded when the dialog opens rather than in an effect, so the fields are
    right on the first render instead of flashing the previous goal's values.

    Cleared on close rather than keyed on the goal: "new goal" produced the
    same key every time, so opening it a second time kept the last goal's
    half-finished form.
  */
  const [seeded, setSeeded] = useState(false);
  if (!open && seeded) setSeeded(false);
  if (open && !seeded) {
    setSeeded(true);
    setTitle(goal?.title ?? "");
    setNote(goal?.note ?? "");
    setImage(goal?.image ?? null);
    setDeadline(goal?.deadline ?? "");
    setPriority(goal?.priority ?? "medium");
    setStatus(goal?.status ?? "active");
    setCategoryId(goal?.categoryId ?? "");
    setMode(goal?.tracker ? "auto" : goal?.progress != null ? "manual" : "off");
    setProgress(goal?.progress ?? 0);
    setTracker(goal?.tracker ?? null);
    setLinkError(null);
    setLinking(false);
  }

  /*
    The one AI call a goal ever costs, and it is on a button.

    Running it on save would spend tokens on every goal whether or not it can
    be measured, including the ones typed and then deleted. Asking costs a tap
    and makes the spend legible, which is the trade worth making.
  */
  const link = async () => {
    const clean = title.trim();
    if (clean === "") return;
    setLinking(true);
    setLinkError(null);
    try {
      const { tracker: found, declined } = await suggestTracker(
        { title: clean, note, deadline: deadline || null },
        store,
      );
      if (declined || found == null) {
        setLinkError(
          "Nothing in the hub measures this one honestly. Set the bar by hand, or leave it off.",
        );
        setMode("manual");
        return;
      }
      setTracker(found);
      setMode("auto");
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Could not read that goal.");
    } finally {
      setLinking(false);
    }
  };

  const save = () => {
    const clean = title.trim();
    if (clean === "") return;

    const payload = {
      title: clean,
      note: note.trim(),
      image,
      deadline: deadline || null,
      priority,
      status,
      // A tracked goal keeps no hand-set number. Leaving one behind would sit
      // in the data contradicting the computed bar, and whichever the next
      // reader reached for would be wrong half the time.
      progress: mode === "manual" ? Math.min(100, Math.max(0, progress)) : null,
      tracker: mode === "auto" ? tracker : null,
      categoryId: categoryId || null,
    };

    if (goal) {
      store.updateGoal(goal.id, {
        ...payload,
        // Changing the status here has to stamp the date the same way the
        // buttons on the card do, or "achieved" loses its when.
        achievedAt:
          status === "achieved"
            ? (goal.achievedAt ?? new Date().toISOString().slice(0, 10))
            : null,
      });
    } else {
      store.addGoal(payload);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={goal ? "Edit goal" : "New goal"}>
      <div className="grid gap-4">
        <Picture value={image} onChange={setImage} />

        <Field label="Goal">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What are you aiming at?"
          />
        </Field>

        <Field
          label="Why it matters"
          hint="Optional. The thing you will want to read in March."
        >
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What it would mean, what it needs…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Deadline" hint="Optional.">
            <DateField value={deadline} onChange={setDeadline} />
          </Field>

          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as GoalStatus)}>
              {GOAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {GOAL_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Category" hint="Optional.">
            <CategoryChoice value={categoryId} onChange={setCategoryId} />
          </Field>
        </div>

        <Field
          label="Progress"
          hint="Plenty of goals cannot honestly be put on a scale. Off is a fine answer."
        >
          <div className="grid gap-2.5">
            <div className="flex gap-1">
              {(
                [
                  ["off", "Off"],
                  ["manual", "By hand"],
                  ["auto", "From my data"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    setLinkError(null);
                    // Choosing "from my data" with no spec yet is the whole
                    // gesture; it should not then require a second button.
                    if (value === "auto" && tracker == null && title.trim() !== "") void link();
                  }}
                  aria-pressed={mode === value}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors ${
                    mode === value
                      ? "border-accent bg-accent-soft text-accent-text"
                      : "border-line text-ink-2 hover:border-line-strong hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "manual" && (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-panel-2 accent-[var(--accent)]"
                />
                <span className="nums w-9 shrink-0 text-right text-[13px] text-ink-2">
                  {progress}%
                </span>
              </div>
            )}

            {mode === "auto" && (
              <div className="rounded-lg border border-line bg-panel-2 p-2.5">
                {linking ? (
                  <p className="text-[12px] text-ink-2">Reading the goal…</p>
                ) : tracker ? (
                  <>
                    <p className="text-[12px] leading-relaxed text-ink">
                      {tracker.basis || `Counts ${sourceLabel(tracker.source)}.`}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-3">
                      {describeTracker(tracker, store)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Button size="sm" onClick={() => void link()}>
                        Read it again
                      </Button>
                      <span className="text-[10px] text-ink-3">
                        Counted from your own data after this — the AI does not run again.
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => void link()} disabled={title.trim() === ""}>
                      Work it out
                    </Button>
                    <span className="text-[11px] text-ink-3">
                      {title.trim() === "" ? "Name the goal first." : "One read, then it is yours."}
                    </span>
                  </div>
                )}

                {linkError && (
                  <p className="mt-2 text-[11px] leading-relaxed text-[var(--urgent)]">
                    {linkError}
                  </p>
                )}
              </div>
            )}
          </div>
        </Field>

        <div className="flex items-center gap-2 pt-1">
          <Button variant="primary" onClick={save} disabled={title.trim() === ""}>
            {goal ? "Save" : "Add goal"}
          </Button>
          <Button onClick={onClose}>Cancel</Button>

          {goal && (
            <div className="ml-auto">
              <ConfirmDeleteButton
                label="Delete"
                onConfirm={() => {
                  store.deleteGoal(goal.id);
                  onClose();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}


/**
 * Pick a category, or make one without leaving the form.
 *
 * Categories were reachable only from Settings, which meant that deciding a
 * goal belongs to "Applications" mid-form cost a trip to another page and the
 * half-filled form along with it. The categories themselves are shared with
 * tasks and plan blocks — this creates a real one, not a goals-only label.
 */
function CategoryChoice({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const store = useStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  // The first colour nothing else is using, so two categories made a minute
  // apart do not come out the same shade.
  const free =
    COURSE_COLORS.find((c) => !store.categories.some((x) => x.color === c.id)) ??
    COURSE_COLORS[0];
  const [color, setColor] = useState<string>(free.id);

  const taken = store.categories.some(
    (c) => c.name.toLowerCase() === name.trim().toLowerCase(),
  );

  /*
    Select the new category once it exists.

    addCategory returns nothing, and in cloud mode the id is minted by the
    database a round trip later, so there is no id to select at the moment of
    creating it. Watching for the name to appear works for both backends.
  */
  useEffect(() => {
    if (pending == null) return;
    const made = store.categories.find(
      (c) => c.name.toLowerCase() === pending.toLowerCase(),
    );
    if (made) {
      onChange(made.id);
      setPending(null);
    }
  }, [pending, store.categories, onChange]);

  const create = () => {
    const clean = name.trim();
    if (clean === "" || taken) return;
    store.addCategory({ name: clean, color });
    setPending(clean);
    setName("");
    setCreating(false);
  };

  if (creating) {
    return (
      <div className="grid gap-2 rounded-lg border border-line bg-panel-2 p-2.5">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              create();
            }
            // Escape backs out of the sub-form without closing the dialog
            // behind it, which is what the modal would otherwise do with it.
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setCreating(false);
            }
          }}
          placeholder="Applications, training, family…"
        />

        <div className="flex items-center gap-1.5">
          {COURSE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setColor(c.id)}
              aria-label={c.label}
              aria-pressed={color === c.id}
              className={`size-4 rounded-full transition-transform hover:scale-110 ${
                color === c.id ? "ring-2 ring-offset-2 ring-offset-[var(--panel-2)]" : ""
              }`}
              style={{ background: c.value, boxShadow: color === c.id ? `0 0 0 2px ${c.value}` : undefined }}
            />
          ))}
        </div>

        {taken && name.trim() !== "" && (
          <p className="text-[11px] text-[var(--urgent)]">You already have that one.</p>
        )}

        <div className="flex gap-1.5">
          <Button variant="primary" onClick={create} disabled={name.trim() === "" || taken}>
            Add
          </Button>
          <Button onClick={() => setCreating(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="min-w-0 flex-1">
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">None</option>
          {store.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {value !== "" && (
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{
            background: courseColor(
              store.categories.find((c) => c.id === value)?.color ?? "",
            ),
          }}
        />
      )}

      <button
        type="button"
        onClick={() => setCreating(true)}
        title="New category"
        aria-label="New category"
        className="shrink-0 rounded-lg border border-line px-2 py-1.5 text-[13px] leading-none text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
      >
        +
      </button>
    </div>
  );
}

/**
 * The picture, or the invitation to add one.
 *
 * Same pipeline as the journal: downscaled and re-encoded on the way in, so a
 * phone photo does not put four megabytes of base64 into a row that also has
 * to sync.
 */
function Picture({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (src: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const { src } = await prepareImage(file);
      onChange(src);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {value ? (
        <div className="group relative overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="aspect-[16/9] w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-2">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void take(e.dataTransfer.files[0]);
          }}
          onPaste={(e) => void take(e.clipboardData.files[0])}
          className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-ink-3 transition-colors hover:border-line-strong hover:bg-panel-2 hover:text-ink-2"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-6">
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
            <path
              d="M4 17l4.5-4.5 3 3L15 12l5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[13px] font-medium">{busy ? "Adding…" : "Add a picture"}</span>
          <span className="text-[11px]">Click, drop or paste — optional</span>
        </button>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void take(e.target.files?.[0])}
      />
      {error && <p className="mt-1.5 text-xs text-[var(--urgent)]">{error}</p>}
    </div>
  );
}
