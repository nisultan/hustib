"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  UNI_FIELD_TYPES,
  UNI_PRIORITIES,
  UNI_PRIORITY_LABEL,
  UNI_STATUSES,
  UNI_STATUS_LABEL,
  UniColumn,
  University,
} from "@/lib/types";
import { Popover } from "./Popover";

/**
 * The application list as a sheet.
 *
 * A card grid is right for browsing and wrong for comparing, which is what
 * this list is mostly for — nobody asks "what is NYU like", they ask "which of
 * these is due first and which still needs an essay". Columns put those side
 * by side, and a cell you can type into means a fact learned on a university's
 * website lands here in one keystroke rather than through a dialog.
 *
 * Built-in and custom columns are rendered by the same code. The built-ins are
 * given ids that read like field names and the custom ones carry uuids, so the
 * table never needs to know which kind it is holding except when writing.
 */

interface Column {
  id: string;
  label: string;
  type: UniColumn["type"] | "status" | "priority";
  options?: string[];
  /** Built-in columns cannot be renamed or removed. */
  fixed: boolean;
  width: number;
}

const BUILT_IN: Column[] = [
  { id: "name", label: "University", type: "text", fixed: true, width: 200 },
  { id: "program", label: "Programme", type: "text", fixed: true, width: 170 },
  { id: "country", label: "Country", type: "text", fixed: true, width: 120 },
  { id: "city", label: "City", type: "text", fixed: true, width: 120 },
  { id: "deadline", label: "Deadline", type: "date", fixed: true, width: 130 },
  { id: "status", label: "Status", type: "status", fixed: true, width: 130 },
  { id: "priority", label: "Priority", type: "priority", fixed: true, width: 110 },
  { id: "website", label: "Website", type: "url", fixed: true, width: 160 },
];

export function UniTable({
  universities,
  onOpen,
}: {
  universities: University[];
  onOpen: (uni: University) => void;
}) {
  const store = useStore();
  const [adding, setAdding] = useState(false);

  const columns: Column[] = [
    ...BUILT_IN,
    ...store.uniColumns.map((c) => ({
      id: c.id,
      label: c.label,
      type: c.type,
      options: c.options,
      fixed: false,
      width: 150,
    })),
  ];

  const read = (uni: University, column: Column): string => {
    if (!column.fixed) return uni.fields[column.id] ?? "";
    const value = (uni as unknown as Record<string, unknown>)[column.id];
    return value == null ? "" : String(value);
  };

  const write = (uni: University, column: Column, value: string) => {
    if (!column.fixed) {
      store.updateUniversity(uni.id, { fields: { ...uni.fields, [column.id]: value } });
      return;
    }
    // A date cleared in the sheet means "no deadline", not the empty string.
    const patch =
      column.id === "deadline" ? { deadline: value || null } : { [column.id]: value };
    store.updateUniversity(uni.id, patch as Partial<University>);
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-[var(--shadow),var(--edge)] [scrollbar-width:thin]">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line">
              {columns.map((column) => (
                <th
                  key={column.id}
                  style={{ minWidth: column.width }}
                  className="border-r border-line px-2.5 py-2 text-left align-middle text-[11px] font-medium uppercase tracking-wide text-ink-3 last:border-r-0"
                >
                  {column.fixed ? column.label : <ColumnMenu column={column} />}
                </th>
              ))}
              <th className="w-10 px-1 py-2">
                <button
                  onClick={() => setAdding(true)}
                  aria-label="Add a column"
                  title="Add a column"
                  className="grid size-6 place-items-center rounded text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
                >
                  <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
                    <path
                      d="M8 3.5v9M3.5 8h9"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            {universities.map((uni) => (
              <tr key={uni.id} className="group border-b border-line last:border-b-0">
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className="border-r border-line p-0 align-top last:border-r-0"
                  >
                    <Cell
                      column={column}
                      value={read(uni, column)}
                      onChange={(v) => write(uni, column, v)}
                      onOpenRow={column.id === "name" ? () => onOpen(uni) : undefined}
                    />
                  </td>
                ))}
                <td className="px-1 text-center align-middle">
                  <button
                    onClick={() => store.deleteUniversity(uni.id)}
                    aria-label={`Remove ${uni.name || "row"}`}
                    title="Remove this row"
                    className="grid size-6 place-items-center rounded text-ink-3 opacity-0 transition-opacity hover:text-[var(--urgent)] focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <svg viewBox="0 0 16 16" aria-hidden className="size-3">
                      <path
                        d="m4 4 8 8M12 4l-8 8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}

            <tr>
              <td colSpan={columns.length + 1} className="p-0">
                <button
                  onClick={() =>
                    store.addUniversity({
                      name: "",
                      country: "",
                      flag: "",
                      city: "",
                      program: "",
                      deadline: null,
                      status: "interested",
                      priority: "target",
                      notes: "",
                      website: "",
                      fields: {},
                    })
                  }
                  className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-[13px] text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
                >
                  <span aria-hidden className="text-base leading-none">
                    +
                  </span>
                  New row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {adding && <NewColumn onClose={() => setAdding(false)} />}
    </div>
  );
}

/**
 * One cell.
 *
 * Text and dates are inputs that look like text until focused, which is what
 * makes a sheet feel like a sheet — a grid of visible boxes is a form, and a
 * form is what this is replacing.
 */
function Cell({
  column,
  value,
  onChange,
  onOpenRow,
}: {
  column: Column;
  value: string;
  onChange: (value: string) => void;
  onOpenRow?: () => void;
}) {
  const base =
    "w-full border-0 bg-transparent px-2.5 py-1.5 text-[13px] outline-none transition-colors focus:bg-panel-2 focus:ring-1 focus:ring-inset focus:ring-accent";

  if (column.type === "status" || column.type === "priority") {
    const options =
      column.type === "status"
        ? UNI_STATUSES.map((s) => ({ value: s, label: UNI_STATUS_LABEL[s] }))
        : UNI_PRIORITIES.map((p) => ({ value: p, label: UNI_PRIORITY_LABEL[p] }));

    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${base} cursor-pointer appearance-none`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (column.type === "select") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${base} cursor-pointer appearance-none`}
      >
        <option value="">—</option>
        {(column.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (column.type === "url") {
    return (
      <div className="flex items-center">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            // A bare host typed into a link column is a link, and returning a
            // relative path is never what anyone meant.
            const v = e.target.value.trim();
            if (v !== "" && !/^https?:\/\//i.test(v)) onChange(`https://${v}`);
          }}
          placeholder="—"
          className={`${base} min-w-0 flex-1 truncate`}
        />
        {value && (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${value}`}
            aria-label="Open in a new tab"
            className="mr-1.5 grid size-6 shrink-0 place-items-center rounded text-ink-3 transition-colors hover:bg-panel-2 hover:text-accent-text"
          >
            <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
              <path
                d="M6.5 3.5h-3v9h9v-3M9.5 3.5h3v3M12.5 3.5 7 9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        )}
      </div>
    );
  }

  if (column.type === "date") {
    return (
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} nums`}
        />
      </div>
    );
  }

  if (column.id === "name") {
    return (
      <div className="flex items-center">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Name"
          className={`${base} min-w-0 flex-1 font-medium`}
        />
        <button
          onClick={onOpenRow}
          aria-label="Open the full record"
          title="Open the full record"
          className="mr-1.5 grid size-6 shrink-0 place-items-center rounded text-ink-3 opacity-0 transition-opacity hover:bg-panel-2 hover:text-ink group-hover:opacity-100"
        >
          <svg viewBox="0 0 16 16" aria-hidden className="size-3.5">
            <path
              d="M6 3.5 10.5 8 6 12.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      inputMode={column.type === "number" ? "decimal" : undefined}
      placeholder="—"
      className={`${base} ${column.type === "number" ? "nums" : ""}`}
    />
  );
}

/** Renaming, retyping or removing a column the student added. */
function ColumnMenu({ column }: { column: Column }) {
  const store = useStore();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        ref={anchor}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 text-left uppercase tracking-wide text-ink-3 transition-colors hover:text-ink"
      >
        <span className="truncate">{column.label}</span>
        <svg viewBox="0 0 16 16" aria-hidden className="size-2.5 shrink-0">
          <path
            d="M4 6.5 8 10.5 12 6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Popover anchorRef={anchor} open={open} onClose={() => setOpen(false)} maxHeight={260}>
        <div className="flex w-56 flex-col gap-2 p-1.5">
          <input
            defaultValue={column.label}
            onChange={(e) => store.updateUniColumn(column.id, { label: e.target.value })}
            placeholder="Column name"
            className="w-full rounded-md border border-line bg-bg px-2 py-1 text-[13px] normal-case tracking-normal outline-none focus:border-accent"
          />

          <select
            value={column.type}
            onChange={(e) =>
              store.updateUniColumn(column.id, {
                type: e.target.value as UniColumn["type"],
              })
            }
            className="w-full rounded-md border border-line bg-bg px-2 py-1 text-[13px] normal-case tracking-normal outline-none"
          >
            {UNI_FIELD_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          {column.type === "select" && (
            <input
              defaultValue={(column.options ?? []).join(", ")}
              onChange={(e) =>
                store.updateUniColumn(column.id, {
                  options: e.target.value
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean),
                })
              }
              placeholder="Choices, comma separated"
              className="w-full rounded-md border border-line bg-bg px-2 py-1 text-[12px] normal-case tracking-normal outline-none"
            />
          )}

          <button
            onClick={() => {
              store.deleteUniColumn(column.id);
              setOpen(false);
            }}
            className="rounded-md px-2 py-1 text-left text-[12px] normal-case tracking-normal text-[var(--urgent)] transition-colors hover:bg-panel-2"
          >
            Delete column
          </button>
        </div>
      </Popover>
    </>
  );
}

function NewColumn({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<UniColumn["type"]>("text");

  const add = () => {
    const clean = label.trim();
    if (clean === "") return;
    store.addUniColumn({ label: clean, type, options: [] });
    onClose();
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel-2 px-3 py-2">
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
          if (e.key === "Escape") onClose();
        }}
        placeholder="Column name — tuition, IELTS, portal…"
        className="min-w-[200px] flex-1 rounded-md border border-line bg-bg px-2 py-1 text-[13px] outline-none focus:border-accent"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as UniColumn["type"])}
        className="rounded-md border border-line bg-bg px-2 py-1 text-[13px] outline-none"
      >
        {UNI_FIELD_TYPES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <button
        onClick={add}
        disabled={label.trim() === ""}
        className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-40"
      >
        Add
      </button>
      <button
        onClick={onClose}
        className="rounded-md px-2 py-1 text-[12px] text-ink-3 transition-colors hover:text-ink"
      >
        Cancel
      </button>
    </div>
  );
}
