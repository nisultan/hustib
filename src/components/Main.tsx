"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

/**
 * The page column.
 *
 * Most pages are reading width — a task list or a form gets harder to scan as
 * it gets wider, so they stay near 64rem. Two are not: the planner is a
 * calendar beside a sidebar, and the dashboard is a board of cards. Both were
 * squeezed into half an already-narrow column with the rest of the monitor
 * sitting empty, which is a different failure from a paragraph being too long.
 *
 * The dashboard earns it only because nothing on it is prose. Its own layout
 * splits into columns at that width, so no line of text actually runs the full
 * 1680px.
 */
const WIDE = ["/plan", "/"];

export function Main({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const wide = WIDE.some(
    // `startsWith` on "/" would match every page in the app, so the root is
    // only ever an exact match.
    (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
  );

  // Reading pages keep a generous gutter; the planner gives that space to the
  // calendar instead, where 32px of margin is a visible amount of a day.
  return (
    <main
      className={`mx-auto w-full pb-24 pt-6 md:pb-16 md:pt-8 ${
        wide ? "max-w-[1680px] px-3 md:px-4" : "max-w-5xl px-4 md:px-8"
      }`}
    >
      {children}
    </main>
  );
}
