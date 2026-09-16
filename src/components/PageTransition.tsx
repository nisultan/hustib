"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { pageVariants } from "@/lib/motion";

/**
 * Replays the page entrance on navigation, and lets the old page leave.
 *
 * The App Router keeps the layout mounted across routes, so a CSS mount
 * animation would play once on first load and never again — hence the key.
 * `AnimatePresence` adds the half CSS cannot do: the outgoing route stays on
 * screen long enough to fade rather than being cut. `mode="popLayout"` keeps
 * the two pages out of each other's way during the crossover without the
 * blank frame `mode="wait"` would introduce.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname}
        variants={pageVariants}
        initial="hidden"
        animate="show"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
