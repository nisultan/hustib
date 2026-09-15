"use client";

import { usePathname } from "next/navigation";

/**
 * Replays the page entrance on navigation.
 *
 * A CSS animation runs when an element mounts, and the App Router keeps the
 * layout mounted across routes — so without a key that changes, the stagger
 * would play once on first load and never again. `display: contents` keeps
 * this wrapper out of the layout entirely; it exists only to be remounted.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="contents">
      {children}
    </div>
  );
}
