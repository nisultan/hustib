"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { ratePassword } from "@/lib/vault";
import { Button, Input, Panel } from "./ui";

type Mode = "signin" | "signup";

/**
 * The account door, shown instead of the app whenever the hub is running
 * against Supabase and nobody is signed in.
 *
 * Staying on one screen rather than routing to /login keeps the session the
 * only thing that decides what renders — there is no URL a signed-out student
 * can reach that shows an empty hub, and no redirect to get wrong.
 */
export function AuthScreen() {
  const store = useStore();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInbox, setCheckInbox] = useState(false);

  const signup = mode === "signup";
  const strength = ratePassword(password);
  const valid = email.includes("@") && password.length >= (signup ? 8 : 1);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;

    setBusy(true);
    setError(null);
    try {
      if (signup) {
        const needsConfirmation = await store.signUp(email, password, name.trim() || "there");
        // Confirmation on means there is no session yet; the auth listener
        // will never fire, so say so rather than leaving a dead form.
        if (needsConfirmation) setCheckInbox(true);
      } else {
        await store.signIn(email, password);
      }
      // On success the auth subscription swaps this screen for the hub —
      // there is nothing to do here.
    } catch (err) {
      setError(readable(err));
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setPassword("");
  };

  if (checkInbox) {
    return (
      <Shell title="Check your email" subtitle={`We sent a confirmation link to ${email}.`}>
        <p className="text-xs leading-relaxed text-ink-2">
          Open it to activate your account, then come back and sign in. The link can land in
          spam, and it expires after a while — if it does, just sign up again with the same
          address.
        </p>
        <Button
          variant="ghost"
          className="mt-4 w-full"
          onClick={() => {
            setCheckInbox(false);
            switchTo("signin");
          }}
        >
          Back to sign in
        </Button>
      </Shell>
    );
  }

  return (
    <Shell
      title={signup ? "Create your hub" : "Welcome back"}
      subtitle={
        signup
          ? "Your courses, tasks and grades sync to your account, so they follow you to any device."
          : "Sign in to pick up where you left off."
      }
    >
      <form onSubmit={submit}>
        {signup && (
          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-medium text-ink-2">
              First name <span className="text-ink-3">(optional)</span>
            </span>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
              className="w-full"
              placeholder="What should we call you?"
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Email</span>
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            autoFocus={!signup}
            autoComplete="email"
            className="w-full"
            placeholder="you@example.com"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Password</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            autoComplete={signup ? "new-password" : "current-password"}
            className="w-full"
            placeholder={signup ? "At least 8 characters" : "Your password"}
          />
        </label>

        {signup && password.length > 0 && (
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

        {error && <p className="mt-3 text-xs text-[var(--urgent)]">{error}</p>}

        <Button
          type="submit"
          variant="primary"
          className="mt-4 w-full"
          disabled={!valid || busy}
        >
          {busy
            ? signup
              ? "Creating account…"
              : "Signing in…"
            : signup
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>

      <p className="mt-5 border-t border-line pt-4 text-center text-xs text-ink-3">
        {signup ? "Already have an account?" : "New here?"}{" "}
        <button
          onClick={() => switchTo(signup ? "signin" : "signup")}
          className="font-medium text-ink transition-colors hover:text-accent"
        >
          {signup ? "Sign in" : "Create one"}
        </button>
      </p>
    </Shell>
  );
}

/**
 * Supabase auth errors are short but not always aimed at a student, so the
 * two most common ones get rewritten. Anything else passes through — a vague
 * message beats a wrong one.
 */
function readable(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/invalid login credentials/i.test(raw)) {
    return "That email and password do not match an account.";
  }
  if (/email not confirmed/i.test(raw)) {
    return "Confirm your email first — check your inbox for the link.";
  }
  if (/user already registered/i.test(raw)) {
    return "There is already an account with that email. Try signing in.";
  }
  return raw;
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
