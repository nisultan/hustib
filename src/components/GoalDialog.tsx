"use client";

import { useRef, useState } from "react";
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
  const [tracking, setTracking] = useState(false);
  const [progress, setProgress] = useState(0);

  // Seeded when the dialog opens rather than in an effect, so the fields are
  // right on the first render instead of flashing the previous goal's values.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const key = `${open}-${goal?.id ?? "new"}`;
  if (open && seededFor !== key) {
    setSeededFor(key);
    setTitle(goal?.title ?? "");
    setNote(goal?.note ?? "");
    setImage(goal?.image ?? null);
    setDeadline(goal?.deadline ?? "");
    setPriority(goal?.priority ?? "medium");
    setStatus(goal?.status ?? "active");
    setCategoryId(goal?.categoryId ?? "");
    setTracking(goal?.progress != null);
    setProgress(goal?.progress ?? 0);
  }

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
      progress: tracking ? Math.min(100, Math.max(0, progress)) : null,
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
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">None</option>
              {store.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Progress"
          hint="Off by default — plenty of goals are not the kind of thing you can put a number on."
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={tracking}
              onClick={() => setTracking((v) => !v)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                tracking ? "bg-accent" : "bg-[var(--border-strong)]"
              }`}
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full bg-white transition-[left] ${
                  tracking ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>

            {tracking && (
              <>
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
              </>
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
