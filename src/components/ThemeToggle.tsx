"use client";

import { Theme } from "@/lib/appearance";
import { useAppearance } from "@/lib/use-appearance";

const NEXT: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
};

const LABEL: Record<Theme, string> = {
  system: "Match system",
  light: "Light",
  dark: "Dark",
};

/**
 * Cycles system → light → dark. One button rather than three: switching theme
 * is a rare, reversible action, and the header has no room for a segmented
 * control. Settings has the explicit three-way picker.
 */
export function ThemeToggle() {
  const { theme, setTheme, loaded } = useAppearance();

  return (
    <button
      onClick={() => setTheme(NEXT[theme])}
      title={`Theme: ${LABEL[theme]}`}
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[NEXT[theme]]}.`}
      className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
    >
      {/* Until the stored value is read, render the system glyph so the server
          and client markup match and no icon flickers on hydration. */}
      <ThemeIcon theme={loaded ? theme : "system"} />
    </button>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 20 20",
    fill: "none",
    "aria-hidden": true,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (theme === "light") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="3.4" />
        <path d="M10 2.6v1.8M10 15.6v1.8M17.4 10h-1.8M4.4 10H2.6M15.2 4.8l-1.3 1.3M6.1 13.9l-1.3 1.3M15.2 15.2l-1.3-1.3M6.1 6.1 4.8 4.8" />
      </svg>
    );
  }

  if (theme === "dark") {
    return (
      <svg {...common}>
        <path d="M16.3 11.6A6.8 6.8 0 0 1 8.4 3.7a6.8 6.8 0 1 0 7.9 7.9z" />
      </svg>
    );
  }

  // System: a monitor, meaning "whatever the device says".
  return (
    <svg {...common}>
      <rect x="2.8" y="4" width="14.4" height="9.6" rx="1.6" />
      <path d="M7.5 16.8h5" />
    </svg>
  );
}
