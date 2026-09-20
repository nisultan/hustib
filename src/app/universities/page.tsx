"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { UniTable } from "@/components/UniTable";
import { useStore } from "@/lib/store";
import { formatDate, countdownLabel, daysUntil } from "@/lib/dates";
import { DateField } from "@/components/DateField";
import {
  UNI_PRIORITIES,
  UNI_PRIORITY_LABEL,
  UNI_STATUSES,
  UNI_STATUS_LABEL,
  UniPriority,
  UniStatus,
  University,
} from "@/lib/types";
import {
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Panel,
  Select,
  Textarea,
  UniPriorityBadge,
  UniStatusBadge,
  ConfirmDeleteButton,
} from "@/components/ui";

type SortKey = "deadline" | "priority" | "country" | "status" | "name";

export default function UniversitiesPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <UniversitiesInner />
    </Suspense>
  );
}

type View = "gallery" | "table" | "board";

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "gallery", label: "Gallery", hint: "Cards, for browsing" },
  { id: "table", label: "Table", hint: "A sheet, for comparing and editing" },
  { id: "board", label: "Board", hint: "Grouped by how far each application has got" },
];

/** Which view the student left it on. */
const VIEW_KEY = "iblearner.uniView";

function UniversitiesInner() {
  const store = useStore();
  const params = useSearchParams();

  const [editing, setEditing] = useState<University | "new" | null>(null);
  const [view, setView] = useState<View>(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      return saved === "table" || saved === "board" ? saved : "gallery";
    } catch {
      return "gallery";
    }
  });

  const pick = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Private browsing. The choice still holds for this session.
    }
  };
  const [sort, setSort] = useState<SortKey>("deadline");
  const [statusFilter, setStatusFilter] = useState<UniStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<UniPriority | "">("");
  const [countryFilter, setCountryFilter] = useState("");
  const [query, setQuery] = useState(params.get("q") ?? "");

  const countries = useMemo(
    () => Array.from(new Set(store.universities.map((u) => u.country))).sort(),
    [store.universities],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = store.universities.filter(
      (u) =>
        (statusFilter === "" || u.status === statusFilter) &&
        (priorityFilter === "" || u.priority === priorityFilter) &&
        (countryFilter === "" || u.country === countryFilter) &&
        (q.length === 0 ||
          u.name.toLowerCase().includes(q) ||
          u.program.toLowerCase().includes(q) ||
          u.notes.toLowerCase().includes(q)),
    );

    const priorityRank: Record<UniPriority, number> = { dream: 0, target: 1, safety: 2 };

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "priority":
          return (
            priorityRank[a.priority] - priorityRank[b.priority] || a.name.localeCompare(b.name)
          );
        case "country":
          return a.country.localeCompare(b.country) || a.name.localeCompare(b.name);
        case "status":
          return (
            UNI_STATUSES.indexOf(a.status) - UNI_STATUSES.indexOf(b.status) ||
            a.name.localeCompare(b.name)
          );
        case "name":
          return a.name.localeCompare(b.name);
        default:
          // Universities with no deadline sort last rather than first.
          return (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999");
      }
    });
  }, [store.universities, statusFilter, priorityFilter, countryFilter, query, sort]);

  const counts = UNI_PRIORITIES.map((p) => ({
    priority: p,
    count: store.universities.filter((u) => u.priority === p).length,
  }));

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  return (
    <div className="page-in">
      <PageHeader
        title="Universities"
        subtitle="Your application list, with the deadlines that matter."
        action={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <span aria-hidden>+</span>Add university
          </Button>
        }
      />

      {store.universities.length === 0 ? (
        <EmptyState
          title="No universities yet"
          hint="Add the places you are considering — the dashboard will start tracking their deadlines."
          action={
            <Button variant="primary" onClick={() => setEditing("new")}>
              Add your first university
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            {counts.map(({ priority, count }) => (
              <Panel key={priority} className="px-4 py-3">
                <p className="nums text-2xl font-semibold">{count}</p>
                <p className="text-xs text-ink-3">{UNI_PRIORITY_LABEL[priority]}</p>
              </Panel>
            ))}
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-line p-0.5">
              {VIEWS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => pick(option.id)}
                  aria-pressed={view === option.id}
                  title={option.hint}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    view === option.id
                      ? "bg-accent-soft text-accent-text"
                      : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="h-9 w-full sm:w-44"
            />
            <div className="w-[150px]">
              <Select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-9 py-0"
                aria-label="Sort by"
              >
                <option value="deadline">Sort: deadline</option>
                <option value="priority">Sort: priority</option>
                <option value="country">Sort: country</option>
                <option value="status">Sort: status</option>
                <option value="name">Sort: name</option>
              </Select>
            </div>
            <div className="w-[140px]">
              <Select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as UniPriority | "")}
                className="h-9 py-0"
                aria-label="Filter by priority"
              >
                <option value="">All priorities</option>
                {UNI_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {UNI_PRIORITY_LABEL[p]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-[140px]">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as UniStatus | "")}
                className="h-9 py-0"
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {UNI_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {UNI_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-[140px]">
              <Select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="h-9 py-0"
                aria-label="Filter by country"
              >
                <option value="">All countries</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {rows.length === 0 ? (
            <EmptyState title="Nothing matches those filters" />
          ) : view === "table" ? (
            <UniTable universities={rows} onOpen={(u) => setEditing(u)} />
          ) : view === "board" ? (
            <Board rows={rows} onOpen={(u) => setEditing(u)} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((u) => (
                <UniCard key={u.id} uni={u} onEdit={() => setEditing(u)} />
              ))}
            </div>
          )}
        </>
      )}

      <UniDialog
        open={editing != null}
        uni={editing === "new" ? undefined : (editing ?? undefined)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

/**
 * The list grouped by where each application has got to.
 *
 * The status field already exists and was only ever shown as a badge, which
 * makes it a fact rather than a place. As columns it becomes the question the
 * page is really about — what is still to write, what is sent, what came back
 * — and moving between them is a click rather than a form.
 */
function Board({ rows, onOpen }: { rows: University[]; onOpen: (uni: University) => void }) {
  const store = useStore();

  // Only the statuses in use, plus the ones ahead of them. A column for
  // "rejected" on a board with no rejections is a thing to look at every day
  // for no reason.
  const columns = UNI_STATUSES.filter(
    (s) =>
      rows.some((u) => u.status === s) || ["interested", "preparing", "applied"].includes(s),
  );

  return (
    <div className="grid gap-3 overflow-x-auto pb-1 [grid-auto-columns:minmax(230px,1fr)] [grid-auto-flow:column] [scrollbar-width:thin]">
      {columns.map((status) => {
        const inColumn = rows.filter((u) => u.status === status);

        return (
          <section key={status} className="min-w-0">
            <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-ink-3">
                {UNI_STATUS_LABEL[status]}
              </h3>
              <span className="nums text-[11px] text-ink-3">{inColumn.length}</span>
            </div>

            <div className="flex flex-col gap-2">
              {inColumn.map((uni) => (
                <div
                  key={uni.id}
                  className="rounded-xl border border-line bg-panel p-2.5 shadow-[var(--shadow),var(--edge)] transition-colors hover:border-line-strong"
                >
                  <button onClick={() => onOpen(uni)} className="w-full text-left">
                    <p className="truncate text-[13px] font-medium">{uni.name || "Untitled"}</p>
                    {uni.program && (
                      <p className="truncate text-[11px] text-ink-3">{uni.program}</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2">
                      <UniPriorityBadge priority={uni.priority} />
                      {uni.deadline && (
                        <span className="nums text-[11px] text-ink-3">
                          {countdownLabel(uni.deadline)}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Moving a card is the point of a board, and a select is
                      the honest control for it without a drag library. */}
                  <select
                    value={uni.status}
                    onChange={(e) =>
                      store.updateUniversity(uni.id, {
                        status: e.target.value as UniStatus,
                      })
                    }
                    aria-label={`Status of ${uni.name}`}
                    className="mt-2 w-full cursor-pointer rounded-md border border-line bg-bg px-1.5 py-1 text-[11px] text-ink-2 outline-none transition-colors hover:border-line-strong"
                  >
                    {UNI_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {UNI_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              {inColumn.length === 0 && (
                <p className="rounded-xl border border-dashed border-line px-2 py-5 text-center text-[11px] text-ink-3">
                  Empty
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function UniCard({ uni, onEdit }: { uni: University; onEdit: () => void }) {
  const store = useStore();
  const [openNotes, setOpenNotes] = useState(false);
  const days = uni.deadline ? daysUntil(uni.deadline) : null;
  const urgent = days != null && days >= 0 && days <= 14;

  return (
    <Panel className="flex h-full flex-col px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{uni.name}</h2>
          <p className="mt-0.5 truncate text-xs text-ink-3">
            {uni.flag} {uni.city ? `${uni.city}, ` : ""}
            {uni.country}
          </p>
        </div>
        <UniPriorityBadge priority={uni.priority} />
      </div>

      {uni.program && <p className="mt-2.5 text-sm text-ink-2">{uni.program}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-xs">
        <UniStatusBadge status={uni.status} />
        {uni.deadline && (
          <span className="nums text-ink-3">
            Deadline {formatDate(uni.deadline)}
            <span className={urgent ? "ml-1.5 font-medium text-[var(--high)]" : "ml-1.5"}>
              ({countdownLabel(uni.deadline)})
            </span>
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={onEdit}>
          Edit
        </Button>
        {uni.notes.trim().length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setOpenNotes((v) => !v)}>
            {openNotes ? "Hide notes" : "Notes"}
          </Button>
        )}
        {uni.website && (
          <a
            href={uni.website}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-2 py-1 text-[13px] font-medium text-ink-3 hover:text-ink"
          >
            Website ↗
          </a>
        )}
        <ConfirmDeleteButton
          label={`Delete ${uni.name}`}
          onConfirm={() => store.deleteUniversity(uni.id)}
          className="ml-auto"
        />
      </div>

      {openNotes && uni.notes.trim().length > 0 && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-panel-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2">
          {uni.notes}
        </p>
      )}
    </Panel>
  );
}

function UniDialog({
  open,
  uni,
  onClose,
}: {
  open: boolean;
  uni?: University;
  onClose: () => void;
}) {
  const store = useStore();
  const [form, setForm] = useState<Omit<University, "id">>(blank());

  const [seededFor, setSeededFor] = useState<string | null>(null);
  const key = `${open}-${uni?.id ?? "new"}`;
  if (open && seededFor !== key) {
    setSeededFor(key);
    setForm(uni ? { ...uni } : blank());
  }

  const set = <K extends keyof Omit<University, "id">>(k: K, v: Omit<University, "id">[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    const name = form.name.trim();
    if (name.length === 0) return;
    const payload = { ...form, name, deadline: form.deadline || null };
    if (uni) store.updateUniversity(uni.id, payload);
    else store.addUniversity(payload);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={uni ? "Edit university" : "Add university"}
      wide
    >
      <div className="grid gap-4">
        <Field label="University name">
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="NYU Abu Dhabi"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Country">
            <Input
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              placeholder="UAE"
            />
          </Field>
          <Field label="Flag" hint="An emoji, optional.">
            <Input
              value={form.flag}
              onChange={(e) => set("flag", e.target.value)}
              placeholder="🇦🇪"
            />
          </Field>
          <Field label="City">
            <Input
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="Abu Dhabi"
            />
          </Field>
        </div>

        <Field label="Program / Major">
          <Input
            value={form.program}
            onChange={(e) => set("program", e.target.value)}
            placeholder="Computer Science / Economics"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Application deadline">
            <DateField
              value={form.deadline ?? ""}
              onChange={(v) => set("deadline", v || null)}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => set("status", e.target.value as UniStatus)}
            >
              {UNI_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {UNI_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select
              value={form.priority}
              onChange={(e) => set("priority", e.target.value as UniPriority)}
            >
              {UNI_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {UNI_PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Website">
          <Input
            type="url"
            value={form.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://nyuad.nyu.edu"
          />
        </Field>

        <Field
          label="Notes"
          hint="Scholarships, required essays, test requirements, portal logins, contacts, your own thoughts."
        >
          <Textarea
            rows={6}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder={
              "Scholarship: automatic consideration\nEssays: 2 supplemental\nIELTS: 7.0"
            }
          />
        </Field>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        {uni ? (
          <Button
            variant="danger"
            onClick={() => {
              store.deleteUniversity(uni.id);
              onClose();
            }}
          >
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={form.name.trim().length === 0}>
            {uni ? "Save changes" : "Add university"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function blank(): Omit<University, "id"> {
  return {
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
  };
}
