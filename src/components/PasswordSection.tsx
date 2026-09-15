"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { cryptoAvailable, ratePassword } from "@/lib/vault";
import { Button, Field, Input, Panel } from "./ui";

type Mode = "idle" | "set" | "change" | "remove";

/**
 * Password management, for a hub that already exists. The first-run version of
 * this lives in Lock.tsx; this one always has data to protect, so every path
 * that could destroy it asks for the current password first.
 */
export function PasswordSection() {
  const store = useStore();
  const [mode, setMode] = useState<Mode>("idle");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const reset = () => {
    setMode("idle");
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };

  const strength = ratePassword(next);
  const newPasswordValid = next.length >= 8 && next === confirm;

  if (!cryptoAvailable()) {
    return (
      <Panel className="px-4 py-4 text-sm text-ink-2">
        Password protection needs a secure connection (HTTPS or localhost). This page is served
        over plain HTTP, so encryption is unavailable here.
      </Panel>
    );
  }

  const run = async (fn: () => Promise<boolean | void>, success: string) => {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (result === false) {
      setError("That password doesn't match your current one.");
      setCurrent("");
      return;
    }
    setDone(success);
    reset();
    setTimeout(() => setDone(null), 4000);
  };

  return (
    <Panel className="px-4 py-4">
      <p className="text-sm text-ink-2">
        {store.hasPassword
          ? "Your data is encrypted on this device. You'll be asked for the password each time you open the hub."
          : "Your data is stored unencrypted in this browser. A password encrypts it, so nobody else using this browser can read it."}
      </p>

      {done && <p className="mt-2 text-xs font-medium text-[var(--up)]">{done}</p>}

      {mode === "idle" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {store.hasPassword ? (
            <>
              <Button onClick={() => setMode("change")}>Change password</Button>
              <Button onClick={() => store.lock()}>Lock now</Button>
              <Button variant="danger" onClick={() => setMode("remove")}>
                Remove password
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setMode("set")}>
              Set a password
            </Button>
          )}
        </div>
      )}

      {mode !== "idle" && (
        <div className="mt-4 grid gap-3">
          {(mode === "change" || mode === "remove") && (
            <Field label="Current password">
              <Input
                type="password"
                value={current}
                autoComplete="current-password"
                onChange={(e) => {
                  setCurrent(e.target.value);
                  setError(null);
                }}
              />
            </Field>
          )}

          {(mode === "set" || mode === "change") && (
            <>
              <Field label="New password" hint="At least 8 characters.">
                <Input
                  type="password"
                  value={next}
                  autoComplete="new-password"
                  onChange={(e) => setNext(e.target.value)}
                />
              </Field>
              {next.length > 0 && (
                <p className="-mt-1 text-xs text-ink-3">
                  Strength: <span className="font-medium">{strength.label}</span>
                  {strength.problem ? ` — ${strength.problem}` : ""}
                </p>
              )}
              <Field label="Confirm new password">
                <Input
                  type="password"
                  value={confirm}
                  autoComplete="new-password"
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
              {confirm.length > 0 && next !== confirm && (
                <p className="-mt-1 text-xs text-[var(--urgent)]">Those don&apos;t match.</p>
              )}
              <p className="rounded-lg bg-panel-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2">
                <span className="font-medium text-ink">There is no recovery.</span> The password
                is never stored — it is what decrypts your data. Export a backup before you rely
                on it.
              </p>
            </>
          )}

          {mode === "remove" && (
            <p className="rounded-lg bg-panel-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2">
              Removing the password decrypts your data and leaves it readable by anything with
              access to this browser.
            </p>
          )}

          {error && <p className="text-xs text-[var(--urgent)]">{error}</p>}

          <div className="flex gap-2">
            {mode === "set" && (
              <Button
                variant="primary"
                disabled={!newPasswordValid || busy}
                onClick={() => run(() => store.setPassword(next), "Password set.")}
              >
                {busy ? "Encrypting…" : "Set password"}
              </Button>
            )}
            {mode === "change" && (
              <Button
                variant="primary"
                disabled={!newPasswordValid || current.length === 0 || busy}
                onClick={() =>
                  run(() => store.changePassword(current, next), "Password changed.")
                }
              >
                {busy ? "Re-encrypting…" : "Change password"}
              </Button>
            )}
            {mode === "remove" && (
              <Button
                variant="danger"
                disabled={current.length === 0 || busy}
                onClick={() => run(() => store.removePassword(current), "Password removed.")}
              >
                {busy ? "Decrypting…" : "Remove password"}
              </Button>
            )}
            <Button variant="ghost" onClick={reset} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
