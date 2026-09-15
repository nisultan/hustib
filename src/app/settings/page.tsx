"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Button, Field, Input, PageHeader, Panel, SectionTitle } from "@/components/ui";
import { ACCENTS, DENSITIES, THEMES, Theme } from "@/lib/appearance";
import { useAppearance } from "@/lib/use-appearance";
import { openTour } from "@/components/Tour";
import { PasswordSection } from "@/components/PasswordSection";

export default function SettingsPage() {
  const store = useStore();
  const [name, setName] = useState("");
  const { theme, setTheme, accent, setAccent, density, setDensity } = useAppearance();
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (store.ready) setName(store.profile.name);
  }, [store.ready, store.profile.name]);

  const download = () => {
    const blob = new Blob([store.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iblearner-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!store.ready) return <div className="h-64" aria-busy="true" />;

  return (
    <div className="fade-up max-w-2xl">
      <PageHeader title="Settings" />

      <section className="mb-8">
        <SectionTitle>Profile</SectionTitle>
        <Panel className="px-4 py-4">
          <Field label="Your name" hint="Used in the dashboard greeting.">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => store.updateProfile({ name: name.trim() || "there" })}
              placeholder="Sultan"
            />
          </Field>
        </Panel>
      </section>

      <section className="mb-8">
        <SectionTitle>Appearance</SectionTitle>
        <Panel className="grid gap-5 px-4 py-4">
          <div>
            <p className="mb-2 text-xs font-medium text-ink-2">Theme</p>
            <div className="flex gap-2">
              {THEMES.map((t: Theme) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  aria-pressed={theme === t}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    theme === t
                      ? "border-accent bg-accent-soft text-accent-text"
                      : "border-line text-ink-2 hover:bg-panel-2"
                  }`}
                >
                  {t === "system" ? "Match system" : t}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink-3">
              &ldquo;Match system&rdquo; follows your device. The header has a quick toggle too.
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-ink-2">Accent colour</p>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccent(a.id)}
                  aria-pressed={accent === a.id}
                  title={a.label}
                  aria-label={a.label}
                  className={`grid size-9 place-items-center rounded-lg border transition-colors ${
                    accent === a.id ? "border-accent" : "border-line hover:bg-panel-2"
                  }`}
                >
                  <span
                    className="block size-5 rounded-full"
                    style={{ background: a.light[0] }}
                  />
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink-3">
              Only the accent changes. Priority, trend and status keep their own colours,
              because those carry meaning.
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-ink-2">Block size</p>
            <div className="flex gap-2">
              {DENSITIES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDensity(d.id)}
                  aria-pressed={density === d.id}
                  className={`flex-1 rounded-lg border px-3 py-2 text-left transition-colors ${
                    density === d.id
                      ? "border-accent bg-accent-soft"
                      : "border-line hover:bg-panel-2"
                  }`}
                >
                  <span
                    className={`block text-sm font-medium ${
                      density === d.id ? "text-accent-text" : "text-ink-2"
                    }`}
                  >
                    {d.label}
                  </span>
                  <span className="block text-xs text-ink-3">{d.hint}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink-3">
              Resizes every card, row and gutter in the app at once.
            </p>
          </div>
        </Panel>
      </section>

      <section className="mb-8">
        <SectionTitle>Tour</SectionTitle>
        <Panel className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <p className="text-sm text-ink-2">
            A walkthrough of what each page is for and how the pieces fit together.
          </p>
          <Button onClick={openTour}>Replay the tour</Button>
        </Panel>
      </section>

      <section className="mb-8">
        <SectionTitle>Password</SectionTitle>
        <PasswordSection />
      </section>

      <section className="mb-8">
        <SectionTitle>Your data</SectionTitle>
        <Panel className="px-4 py-4">
          <p className="text-sm text-ink-2">
            Everything lives in this browser — nothing is uploaded. That means it is private,
            but it also means clearing site data removes it, so export a copy if it matters.
          </p>
          <p className="nums mt-3 text-xs text-ink-3">
            {store.courses.length} courses · {store.tasks.length} tasks · {store.grades.length}{" "}
            grades · {store.universities.length} universities
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={download}>Export JSON</Button>
            <Button onClick={() => store.resetToSample()}>Load sample data</Button>
            {confirmClear ? (
              <>
                <Button
                  variant="danger"
                  onClick={() => {
                    store.clearAll();
                    setConfirmClear(false);
                  }}
                >
                  Yes, delete everything
                </Button>
                <Button variant="ghost" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="danger" onClick={() => setConfirmClear(true)}>
                Clear all data
              </Button>
            )}
          </div>

          {confirmClear && (
            <p className="mt-3 text-xs text-[var(--urgent)]">
              This removes every course, task, grade and university. It cannot be undone.
            </p>
          )}
        </Panel>
      </section>

      <section>
        <SectionTitle>Syncing across devices</SectionTitle>
        <Panel className="px-4 py-4 text-sm leading-relaxed text-ink-2">
          <p>
            This version stores data locally. The Postgres schema for multi-device sync —
            tables, relationships and row-level security so every record belongs to its own user
            — is in{" "}
            <code className="rounded bg-panel-2 px-1 py-0.5 text-xs">supabase/schema.sql</code>.
            Running it against a Supabase project and swapping the mutators in{" "}
            <code className="rounded bg-panel-2 px-1 py-0.5 text-xs">src/lib/store.tsx</code>{" "}
            for queries is the only change the rest of the app needs.
          </p>
        </Panel>
      </section>
    </div>
  );
}
