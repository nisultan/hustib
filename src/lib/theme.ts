// Deliberately hook-free and not marked "use client": the server layout
// imports THEME_INIT_SCRIPT to inline it into <head>. A module containing
// React hooks cannot be imported from a server component at all, and a
// "use client" module would hand the layout a client-reference proxy rather
// than the script string. The hook lives in ./use-theme.

export type Theme = "system" | "light" | "dark";

export const THEMES: Theme[] = ["system", "light", "dark"];

export const THEME_KEY = "iblearner.theme";

/**
 * Applies the choice to the document root. "system" removes the attribute so
 * the `prefers-color-scheme` rules in globals.css take over; the other two
 * stamp an attribute that wins over those rules in both directions.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  // Keeps form controls, scrollbars and the like in step with the page.
  root.style.colorScheme = theme === "system" ? "" : theme;
}

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  } catch {
    return "system";
  }
}

/**
 * Runs before first paint (see the inline script in layout.tsx) so a student
 * who chose light never sees a dark flash while the bundle loads. Kept as a
 * string because it has to be inlined into the document head.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem("${THEME_KEY}");
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
      document.documentElement.style.colorScheme = t;
    }
  } catch (e) {}
})();
`;
