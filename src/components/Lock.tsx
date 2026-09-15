"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { cryptoAvailable, ratePassword } from "@/lib/vault";
import { AuthScreen } from "./Auth";
import { Button, Input, Panel } from "./ui";

/**
 * The door.
 *
 * Which door depends on where the data lives. With Supabase configured the
 * hub is behind an account, so this waits for the session and shows the sign
 * in form; without it the hub is local to the device and the old vault
 * password is the only thing between a shared browser and the data.
 */
export function Lock({ children }: { children: React.ReactNode }) {
  const store = useStore();

  if (store.backend === "cloud") {
    // Blank rather than a spinner: the session is usually restored from
    // storage within a frame or two, and a flashing spinner reads worse than
    // a beat of nothing.
    if (store.authState === "loading") {
      return <div className="min-h-screen" aria-busy="true" />;
    }
    if (store.authState === "signed-out") return <AuthScreen />;
    if (store.lockState !== "ready") {
      return <div className="min-h-screen" aria-busy="true" />;
    }
    return <>{children}</>;
  }

  if (store.lockState === "loading") {
    return <div className="min-h-screen" aria-busy="true" />;
  }

  if (store.lockState === "locked") return <UnlockScreen />;

  // First visit, no decision recorded yet.
  if (!store.passwordAsked && !store.hasPassword) return <CreateScreen />;

  return <>{children}</>;
}

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="fade-up w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 grid size-11 place-items-center rounded-xl bg-accent text-sm font-bold text-white">
            IB
          </span>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 max-w-sm text-sm text-ink-2">{subtitle}</p>
        </div>
        <Panel className="px-5 py-5">{children}</Panel>
      </div>
    </div>
  );
}

function UnlockScreen() {
  const store = useStore();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showErase, setShowErase] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length === 0 || busy) return;

    setBusy(true);
    setError(null);
    const ok = await store.unlock(password);
    setBusy(false);

    if (!ok) {
      setError("That password doesn't match. Try again.");
      setPassword("");
    }
  };

  return (
    <Shell title="Welcome back" subtitle="Your hub is encrypted on this device.">
      <form onSubmit={submit}>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Password</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            autoFocus
            autoComplete="current-password"
            className="w-full"
            placeholder="Your password"
          />
        </label>

        {error && <p className="mt-2 text-xs text-[var(--urgent)]">{error}</p>}

        <Button
          type="submit"
          variant="primary"
          className="mt-4 w-full"
          disabled={password.length === 0 || busy}
        >
          {busy ? "Unlocking…" : "Unlock"}
        </Button>
      </form>

      <div className="mt-5 border-t border-line pt-4">
        {showErase ? (
          <div>
            <p className="text-xs leading-relaxed text-ink-2">
              There is no way to recover the password — the data is encrypted with it and
              nothing else. Starting over erases every course, task, grade and university stored
              on this device, permanently.
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="danger" onClick={() => store.eraseVault()} className="flex-1">
                Erase and start over
              </Button>
              <Button variant="ghost" onClick={() => setShowErase(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowErase(true)}
            className="text-xs text-ink-3 transition-colors hover:text-ink"
          >
            Forgotten your password?
          </button>
        )}
      </div>
    </Shell>
  );
}

function CreateScreen() {
  const store = useStore();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const available = cryptoAvailable();
  const strength = ratePassword(password);
  const mismatch = touched && confirm.length > 0 && password !== confirm;
  const valid = password.length >= 8 && password === confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    await store.setPassword(password);
    setBusy(false);
  };

  if (!available) {
    // crypto.subtle only exists on secure origins. Rather than offer a
    // password that cannot actually encrypt anything, say so and move on.
    return (
      <Shell
        title="Set up your hub"
        subtitle="Password protection needs a secure connection (HTTPS or localhost), which this page does not have."
      >
        <Button variant="primary" className="w-full" onClick={() => store.declinePassword()}>
          Continue without a password
        </Button>
      </Shell>
    );
  }

  return (
    <Shell
      title="Set a password"
      subtitle="Everything you store stays on this device. A password encrypts it, so nobody else using this browser can read it."
    >
      <form onSubmit={submit}>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Password</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="new-password"
            className="w-full"
            placeholder="At least 8 characters"
          />
        </label>

        {password.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="flex flex-1 gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{
                    background:
                      i < strength.score
                        ? strength.score === 3
                          ? "var(--up)"
                          : strength.score === 2
                            ? "var(--medium)"
                            : "var(--high)"
                        : "var(--border)",
                  }}
                />
              ))}
            </span>
            <span className="text-[11px] font-medium text-ink-3">{strength.label}</span>
          </div>
        )}
        {strength.problem && <p className="mt-1 text-xs text-ink-3">{strength.problem}</p>}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Confirm password</span>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setTouched(true);
            }}
            autoComplete="new-password"
            className="w-full"
            placeholder="Type it again"
          />
        </label>
        {mismatch && (
          <p className="mt-1.5 text-xs text-[var(--urgent)]">Those don&apos;t match.</p>
        )}

        <p className="mt-4 rounded-lg bg-panel-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2">
          <span className="font-medium text-ink">There is no recovery.</span> The password is
          never stored anywhere — it is what decrypts your data. If you forget it, the data is
          gone. Export a backup from Settings once you have some.
        </p>

        <Button
          type="submit"
          variant="primary"
          className="mt-4 w-full"
          disabled={!valid || busy}
        >
          {busy ? "Encrypting…" : "Set password"}
        </Button>
      </form>

      <button
        onClick={() => store.declinePassword()}
        className="mt-3 w-full text-center text-xs text-ink-3 transition-colors hover:text-ink"
      >
        Skip for now — I&apos;ll decide later
      </button>
    </Shell>
  );
}
