"use client";

import { useCallback, useEffect, useState } from "react";
import { Theme, applyTheme, readTheme, THEME_KEY } from "./theme";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  // The stored value is only readable on the client, so the first render uses
  // the default and this corrects it immediately after mount.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = readTheme();
    setThemeState(stored);
    applyTheme(stored);
    setLoaded(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage blocked; the choice still applies for this session.
    }
  }, []);

  /** Whether the page is currently dark, resolving "system" against the OS. */
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return { theme, setTheme, isDark, loaded };
}
