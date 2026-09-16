"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

/**
 * The page column.
 *
 * Most pages are reading width — a task list or a form gets harder to scan as
 * it gets wider, so they stay near 64rem. The planner is the exception: it is
 * a calendar next to a sidebar, and on a wide screen the grid was squeezed
 * into half of an already-narrow column while the rest of the monitor sat
 * empty.
 */
const WIDE = ["/plan"];

export function Main({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const wide = WIDE.some((p) => pathname === p || pathname.startsWith(`${p}/`));

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
