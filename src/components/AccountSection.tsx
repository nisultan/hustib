"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button, Panel } from "./ui";

/**
 * Who you are signed in as, and the way out.
 *
 * Only rendered in cloud mode — the local build has no account to show, and
 * its equivalent control is the vault password section next to this one.
 */
export function AccountSection() {
  const store = useStore();
  const [busy, setBusy] = useState(false);

  return (
    <Panel className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{store.user?.email ?? "Signed in"}</p>
        <p className="mt-0.5 text-xs text-ink-3">
          Your hub syncs to this account. Signing in on another device brings it all with you.
        </p>
      </div>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await store.signOut();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </Button>
    </Panel>
  );
}
