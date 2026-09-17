"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  ImportantDay,
  ImportantKind,
  IMPORTANT_KINDS,
  IMPORTANT_KIND_GLYPH,
  IMPORTANT_KIND_LABEL,
} from "@/lib/types";
import { Button, ConfirmDeleteButton, Field, Input, Modal, Textarea } from "./ui";
import { DateField } from "./DateField";

/**
 * Putting a date on the calendar that is not work.
 *
 * The kind is picked as a row of buttons rather than a dropdown because there
 * are five of them and the choice changes what the rest of the form means —
 * a birthday is almost always yearly and an exam almost never is, so choosing
 * one sets the repeat and saves the second decision most of the time. It is
 * still a checkbox underneath: the guess is a default, not a rule.
 *
 * There is nothing to tick and no status to set. A day like this is not
 * completed; it happens.
 */
export function ImportantDayDialog({
  open,
  day,
  date,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Present when editing. Absent when adding. */
  day?: ImportantDay;
  /** The day the calendar was showing, used as the default date. */
  date?: string;
  onClose: () => void;
  /**
   * The date that was just saved.
   *
   * The calendar follows it. Adding something for March while looking at
   * September otherwise saves it correctly and shows nothing, which is
   * indistinguishable from losing it.
   */
  onSaved?: (date: string) => void;
}) {
  const store = useStore();

  const [title, setTitle] = useState("");
  const [on, setOn] = useState("");
  const [kind, setKind] = useState<ImportantKind>("exam");
  const [note, setNote] = useState("");
  const [repeatsYearly, setRepeatsYearly] = useState(false);

  /*
    Seeded when the dialog opens rather than in an effect, so the fields are
    right on the first render instead of flashing the previous day's values.

    The seed is cleared on close rather than compared against the day being
    edited. Keying it on the content meant that opening "new day" twice on the
    same date produced the same key both times, so the second open kept
    whatever was left in the form — including the previous entry's date. The
    day was then written to that old date, and never appeared on the one being
    looked at.
  */
  const [seeded, setSeeded] = useState(false);
  if (!open && seeded) setSeeded(false);
  if (open && !seeded) {
    setSeeded(true);
    setTitle(day?.title ?? "");
    setOn(day?.date ?? date ?? "");
    setKind(day?.kind ?? "exam");
    setNote(day?.note ?? "");
    setRepeatsYearly(day?.repeatsYearly ?? false);
  }

  const pickKind = (next: ImportantKind) => {
    setKind(next);
    // Only while adding. Changing the kind of a day that already exists must
    // not quietly rewrite a choice the student made about it.
    if (!day) setRepeatsYearly(next === "birthday" || next === "holiday");
  };

  const save = () => {
    const clean = title.trim();
    if (clean === "" || on === "") return;

    const payload = { title: clean, date: on, kind, note: note.trim(), repeatsYearly };
    if (day) store.updateImportantDay(day.id, payload);
    else store.addImportantDay(payload);
    onSaved?.(on);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={day ? "Edit day" : "New important day"}>
      <div className="grid gap-4">
        <Field label="What is it">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            placeholder="SAT, Mum's birthday, flight home…"
          />
        </Field>

        <Field label="Kind">
          <div className="flex flex-wrap gap-1.5">
            {IMPORTANT_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => pickKind(k)}
                aria-pressed={kind === k}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  kind === k
                    ? "border-accent bg-accent-soft text-accent-text"
                    : "border-line text-ink-2 hover:text-ink"
                }`}
              >
                <span aria-hidden>{IMPORTANT_KIND_GLYPH[k]}</span>
                {IMPORTANT_KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Date"
          hint={repeatsYearly ? "The first one. It returns every year after that." : undefined}
        >
          <DateField value={on} onChange={setOn} />
        </Field>

        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-2">
          <input
            type="checkbox"
            checked={repeatsYearly}
            onChange={(e) => setRepeatsYearly(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
          />
          <span>
            Every year
            <span className="block text-xs text-ink-3">
              Same month and day, without another entry each January.
            </span>
          </span>
        </label>

        <Field label="Note" hint="Optional.">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Where, what to bring, who to call…"
          />
        </Field>

        <div className="flex items-center justify-between gap-3 pt-1">
          {day ? (
            <ConfirmDeleteButton
              label="Delete day"
              onConfirm={() => {
                store.deleteImportantDay(day.id);
                onClose();
              }}
            />
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={title.trim() === "" || on === ""}>
              {day ? "Save" : "Add day"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
