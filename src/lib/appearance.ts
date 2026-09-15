// Theme, accent colour and block size.
//
// Deliberately hook-free and without a "use client" directive: the server
// layout imports APPEARANCE_INIT_SCRIPT to inline into <head>, and a module
// containing React hooks cannot be imported from a server component at all.
// The hook lives in ./use-appearance.

export type Theme = "system" | "light" | "dark";
export const THEMES: Theme[] = ["system", "light", "dark"];

export type AccentId =
  "indigo" | "blue" | "teal" | "green" | "amber" | "rose" | "violet" | "slate";

export interface Accent {
  id: AccentId;
  label: string;
  /** [base, soft background, text-on-soft] for each scheme. */
  light: [string, string, string];
  dark: [string, string, string];
}

/**
 * Each accent is specified separately for light and dark rather than being
 * derived: a hue that reads well on white is usually too dark on near-black,
 * and the "soft" background has to stay subtle in both.
 */
export const ACCENTS: Accent[] = [
  {
    id: "indigo",
    label: "Indigo",
    light: ["#5b5bd6", "#eeeefc", "#4a4ac4"],
    dark: ["#7b7bf0", "#1e1e35", "#a5a5f7"],
  },
  {
    id: "blue",
    label: "Blue",
    light: ["#2563eb", "#e8f0fe", "#1d4ed8"],
    dark: ["#5b9cf8", "#152435", "#8fc0fb"],
  },
  {
    id: "teal",
    label: "Teal",
    light: ["#0d9488", "#e0f5f2", "#0b7a70"],
    dark: ["#2dd4bf", "#0f2b28", "#7de8db"],
  },
  {
    id: "green",
    label: "Green",
    light: ["#16a34a", "#e6f6ec", "#15803d"],
    dark: ["#4ade80", "#122a1b", "#8ef0ae"],
  },
  {
    id: "amber",
    label: "Amber",
    light: ["#c2740a", "#fdf1dd", "#a35f06"],
    dark: ["#f0a23c", "#2e2210", "#f7c680"],
  },
  {
    id: "rose",
    label: "Rose",
    light: ["#e11d48", "#fdeaee", "#be123c"],
    dark: ["#fb7185", "#33161d", "#fda4af"],
  },
  {
    id: "violet",
    label: "Violet",
    light: ["#9333ea", "#f4e9fd", "#7e22ce"],
    dark: ["#c084fc", "#2a1838", "#d8b4fe"],
  },
  {
    id: "slate",
    label: "Graphite",
    light: ["#475569", "#eef1f5", "#334155"],
    dark: ["#94a3b8", "#1e242c", "#cbd5e1"],
  },
];

export type Density = "compact" | "comfortable" | "spacious";

export interface DensityOption {
  id: Density;
  label: string;
  hint: string;
}

export const DENSITIES: DensityOption[] = [
  { id: "compact", label: "Small", hint: "More on screen" },
  { id: "comfortable", label: "Medium", hint: "The default" },
  { id: "spacious", label: "Large", hint: "Roomier, easier to read" },
];

export const THEME_KEY = "iblearner.theme";
export const ACCENT_KEY = "iblearner.accent";
export const DENSITY_KEY = "iblearner.density";

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  // Keeps native controls and scrollbars in step with the page.
  root.style.colorScheme = theme === "system" ? "" : theme;
}

export function applyAccent(id: AccentId): void {
  document.documentElement.setAttribute("data-accent", id);
}

export function applyDensity(d: Density): void {
  document.documentElement.setAttribute("data-density", d);
}

export function readTheme(): Theme {
  return read(THEME_KEY, THEMES, "system");
}

export function readAccent(): AccentId {
  return read(
    ACCENT_KEY,
    ACCENTS.map((a) => a.id),
    "indigo",
  );
}

export function readDensity(): Density {
  return read(
    DENSITY_KEY,
    DENSITIES.map((d) => d.id),
    "comfortable",
  );
}

function read<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v != null && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Runs before first paint, inlined into <head>. Without it a student who chose
 * light, a green accent or large blocks would see the defaults flash first
 * while the bundle loads. Kept as a string because it has to be inlined.
 */
export const APPEARANCE_INIT_SCRIPT = `
(function () {
  try {
    var d = document.documentElement;
    var t = localStorage.getItem("${THEME_KEY}");
    if (t === "light" || t === "dark") {
      d.setAttribute("data-theme", t);
      d.style.colorScheme = t;
    }
    var a = localStorage.getItem("${ACCENT_KEY}");
    if (a) d.setAttribute("data-accent", a);
    var s = localStorage.getItem("${DENSITY_KEY}");
    if (s) d.setAttribute("data-density", s);
  } catch (e) {}
})();
`;

/** Colour swatch for a course, independent of the app accent. */
export const COURSE_COLORS = [
  { id: "violet", label: "Violet", value: "#7c6bf0" },
  { id: "blue", label: "Blue", value: "#3b82f6" },
  { id: "teal", label: "Teal", value: "#14b8a6" },
  { id: "green", label: "Green", value: "#22c55e" },
  { id: "amber", label: "Amber", value: "#f59e0b" },
  { id: "rose", label: "Rose", value: "#f43f5e" },
  { id: "sky", label: "Sky", value: "#0ea5e9" },
  { id: "slate", label: "Graphite", value: "#64748b" },
] as const;

export type CourseColorId = (typeof COURSE_COLORS)[number]["id"];

export function courseColor(id: string): string {
  return COURSE_COLORS.find((c) => c.id === id)?.value ?? COURSE_COLORS[0].value;
}
