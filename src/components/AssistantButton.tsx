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
        whileTap={{ scale: 0.96 }}
        transition={springSnappy}
        // A plain, solid button with a word on it — the way Todoist or Linear
        // label a primary action. No gradient, no glow and no sparkle: those
        // are the "AI feature" clichés, and this is just someone to talk to.
        className={`flex h-10 shrink-0 items-center gap-2 rounded-lg bg-accent px-3 text-[13.5px] font-semibold text-white transition-[filter] hover:brightness-[0.93] md:px-3.5 ${
          open ? "brightness-[0.88]" : ""
        }`}
      >
        {/* A speech bubble: it is a conversation. */}
        <svg viewBox="0 0 20 20" aria-hidden className="size-[17px]">
          <path
            d="M4.5 4h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h-1A1.5 1.5 0 0 1 3 12.5v-7A1.5 1.5 0 0 1 4.5 4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
        <span className="hidden sm:inline">Ask {ASSISTANT_NAME}</span>
        {modifier && (
          <kbd className="hidden rounded bg-black/15 px-1.5 py-0.5 font-sans text-[10.5px] font-medium md:inline">
            {modifier} J
          </kbd>
        )}
      </motion.button>

      {everOpened && <Assistant open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
