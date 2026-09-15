"use client";

import { useStore } from "@/lib/store";

/**
 * Says so when a change did not reach the server.
 *
 * Mutations are optimistic, so a failed write leaves the screen showing
 * something the database does not have. That is fine for a moment and bad for
 * an hour — the banner exists so the gap is never invisible.
 */
export function SyncBanner() {
  const store = useStore();
  if (store.backend !== "cloud" || !store.syncError) return null;

  return (
    <div className="sticky top-[49px] z-30 border-b border-[var(--urgent)]/30 bg-[var(--urgent)]/10 px-4 py-2 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
        <p className="flex-1 text-xs leading-relaxed text-ink">
          <span className="font-medium">A change did not save.</span> Reload to see what is
          actually stored. ({store.syncError})
        </p>
        <button
          onClick={() => store.clearSyncError()}
          className="shrink-0 text-xs text-ink-3 transition-colors hover:text-ink"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
