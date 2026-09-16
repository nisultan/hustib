"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Assistant, ASSISTANT_NAME } from "./Assistant";
import { springSnappy } from "@/lib/motion";
import { useModifierKey } from "@/lib/shortcut";

/**
 * Owns whether the assistant is open, and the two ways to open it.
 *
 * The panel stays mounted once opened so the conversation survives closing it
 * — a student who shuts it to look at a grade and reopens it has not lost
 * what they were in the middle of asking.
 */
export function AssistantButton() {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const modifier = useModifierKey();

  const show = useCallback(() => {
    setEverOpened(true);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+J, or ⌘J on a Mac. Search already owns K, and J is next to it.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setEverOpened(true);
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <motion.button
        type="button"
        onClick={show}
        aria-label={`Open ${ASSISTANT_NAME}`}
        title={modifier ? `${ASSISTANT_NAME}  ${modifier} J` : ASSISTANT_NAME}
        // The spark turns a little as you reach for it: the one control in the
        // header that opens something with an opinion should look awake.
        whileHover={{ rotate: 12, scale: 1.08 }}
        whileTap={{ scale: 0.9, rotate: 0 }}
        transition={springSnappy}
        className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors hover:bg-panel-2 hover:text-ink ${
          open ? "bg-accent-soft text-accent-text" : "text-ink-3"
        }`}
      >
        <svg viewBox="0 0 20 20" aria-hidden className="size-[18px]">
          <path
            d="M10 2.5 11.9 8.1 17.5 10 11.9 11.9 10 17.5 8.1 11.9 2.5 10 8.1 8.1z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </motion.button>

      {everOpened && <Assistant open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
