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
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.95 }}
        transition={springSnappy}
        // A labelled pill in the accent colour rather than a grey outline icon:
        // the assistant is a main feature, and a faint glyph in the corner read
        // as decoration that nobody clicked.
        className={`flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-[13.5px] font-semibold text-white shadow-[0_4px_14px_-4px_color-mix(in_srgb,var(--accent)_70%,transparent)] transition-[filter] hover:brightness-110 md:px-3.5 ${
          open ? "ring-2 ring-accent/40 ring-offset-2 ring-offset-[var(--bg)]" : ""
        }`}
        style={{ background: "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #ff7ad9))" }}
      >
        <svg viewBox="0 0 20 20" aria-hidden className="size-[18px]">
          <path d="M10 2.5 11.9 8.1 17.5 10 11.9 11.9 10 17.5 8.1 11.9 2.5 10 8.1 8.1z" fill="currentColor" />
          <path d="M16 2.5l.6 1.6 1.6.6-1.6.6L16 6.9l-.6-1.6-1.6-.6 1.6-.6z" fill="currentColor" opacity="0.8" />
        </svg>
        <span className="hidden sm:inline">Ask {ASSISTANT_NAME}</span>
        {modifier && (
          <kbd className="hidden rounded-md bg-white/20 px-1.5 py-0.5 font-sans text-[10.5px] font-medium md:inline">
            {modifier} J
          </kbd>
        )}
      </motion.button>

      {everOpened && <Assistant open={open} onClose={() => setOpen(false)} />}
    </>
  );
}
