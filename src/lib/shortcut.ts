"use client";

import { useEffect, useState } from "react";

/**
 * The modifier key, spelled the way this keyboard spells it.
 *
 * Every shortcut hint in the app said ⌘, which is wrong on the machine most of
 * this is used on — and a hint that names a key the keyboard does not have is
 * worse than no hint, because it reads as "this shortcut is not for you".
 *
 * It returns null until mounted rather than guessing: the server has no
 * keyboard to ask about, and rendering "Ctrl" and then swapping it for "⌘" one
 * frame later is a flicker on exactly the machines that would notice. Callers
 * render nothing while it is null, which is a hint appearing a frame late.
 */
export function useModifierKey(): string | null {
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
        ?.platform ??
      navigator.platform ??
      "";
    setKey(/mac|iphone|ipad|ipod/i.test(platform) ? "⌘" : "Ctrl");
  }, []);

  return key;
}
