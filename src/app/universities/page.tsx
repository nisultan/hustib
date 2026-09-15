"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { formatDate, countdownLabel, daysUntil } from "@/lib/dates";
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

function UniversitiesInner() {
  const store = useStore();
  const params = useSearchParams();

  const [editing, setEditing] = useState<University | "new" | null>(null);
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
    <div className="fade-up">
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

          <div className="mb-5 flex flex-wrap gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="h-9 w-full sm:w-44"
            />
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 w-auto py-0"
              aria-label="Sort by"
            >
              <option value="deadline">Sort: deadline</option>
              <option value="priority">Sort: priority</option>
              <option value="country">Sort: country</option>
              <option value="status">Sort: status</option>
              <option value="name">Sort: name</option>
            </Select>
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as UniPriority | "")}
              className="h-9 w-auto py-0"
              aria-label="Filter by priority"
            >
              <option value="">All priorities</option>
              {UNI_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {UNI_PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UniStatus | "")}
              className="h-9 w-auto py-0"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {UNI_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {UNI_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
            <Select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="h-9 w-auto py-0"
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

          {rows.length === 0 ? (
            <EmptyState title="Nothing matches those filters" />
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
            <Input
              type="date"
              value={form.deadline ?? ""}
              onChange={(e) => set("deadline", e.target.value || null)}
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
  };
}
