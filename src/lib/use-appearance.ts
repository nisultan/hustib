"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AccentId,
  Density,
  Theme,
  ACCENT_KEY,
  DENSITY_KEY,
  THEME_KEY,
  applyAccent,
  applyDensity,
  applyTheme,
  readAccent,
  readDensity,
  readTheme,
} from "./appearance";

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked; the choice still applies for this session.
  }
}

export function useAppearance() {
  const [theme, setThemeState] = useState<Theme>("system");
  const [accent, setAccentState] = useState<AccentId>("indigo");
  const [density, setDensityState] = useState<Density>("comfortable");
  // Stored values are only readable on the client, so the first render uses
  // the defaults and this corrects them immediately after mount.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = readTheme();
    const a = readAccent();
    const d = readDensity();
    setThemeState(t);
    setAccentState(a);
    setDensityState(d);
    // The inline head script has already applied these; re-applying is a
    // no-op that also covers a browser where the script was blocked.
    applyTheme(t);
    applyAccent(a);
    applyDensity(d);
    setLoaded(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    store(THEME_KEY, next);
  }, []);

  const setAccent = useCallback((next: AccentId) => {
    setAccentState(next);
    applyAccent(next);
    store(ACCENT_KEY, next);
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    applyDensity(next);
    store(DENSITY_KEY, next);
  }, []);

  return { theme, setTheme, accent, setAccent, density, setDensity, loaded };
}
