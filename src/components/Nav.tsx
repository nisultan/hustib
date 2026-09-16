"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Logo } from "./Logo";
import { useNavCollapsed } from "@/lib/use-nav";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden className="shrink-0">
      {children}
    </svg>
  );
}

const PRIMARY: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: (
      <Icon>
        <path
          d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3.5v-5h-5v5H4a1 1 0 0 1-1-1z"
          {...stroke}
        />
      </Icon>
    ),
  },
  {
    href: "/plan",
    label: "Plan",
    icon: (
      <Icon>
        <rect x="3" y="4.5" width="14" height="12.5" rx="2" {...stroke} />
        <path d="M3 8h14M7 2.5v3M13 2.5v3" {...stroke} />
        <path d="M6.5 11.5h3M6.5 14h5" {...stroke} />
      </Icon>
    ),
  },
  {
    href: "/school",
    label: "School",
    icon: (
      <Icon>
        <path d="M10 3.5 18 7l-8 3.5L2 7z" {...stroke} />
        <path d="M5.5 8.8V13c0 1.4 2 2.5 4.5 2.5s4.5-1.1 4.5-2.5V8.8" {...stroke} />
      </Icon>
    ),
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: (
      <Icon>
        <path d="M7 5h10M7 10h10M7 15h10" {...stroke} />
        <path d="M3 5h.01M3 10h.01M3 15h.01" {...stroke} />
      </Icon>
    ),
  },
  {
    href: "/courses",
    label: "Courses",
    icon: (
      <Icon>
        <path d="M4 4h5a2 2 0 0 1 2 2v10a1.5 1.5 0 0 0-1.5-1.5H4z" {...stroke} />
        <path d="M16 4h-5a2 2 0 0 0-2 2v10a1.5 1.5 0 0 1 1.5-1.5H16z" {...stroke} />
      </Icon>
    ),
  },
  {
    href: "/grades",
    label: "Grades",
    icon: (
      <Icon>
        <path d="M3 16.5h14" {...stroke} />
        <path d="M5.5 16.5v-5M10 16.5v-9M14.5 16.5v-3" {...stroke} />
      </Icon>
    ),
  },
  {
    href: "/universities",
    label: "Universities",
    icon: (
      <Icon>
        <path d="M10 3.5 18 7l-8 3.5L2 7z" {...stroke} />
        <path d="M5.5 8.8V13c0 1.4 2 2.5 4.5 2.5s4.5-1.1 4.5-2.5V8.8" {...stroke} />
      </Icon>
    ),
  },
];

const SECONDARY: NavItem[] = [
  {
    href: "/weight",
    label: "Weight",
    icon: (
      <Icon>
        <path d="M4.5 6.5h11l1.2 9a1 1 0 0 1-1 1.1H4.3a1 1 0 0 1-1-1.1z" {...stroke} />
        <path
          d="M10 3.2a2.2 2.2 0 0 0-2.2 2.2c0 .4.1.8.3 1.1h3.8c.2-.3.3-.7.3-1.1A2.2 2.2 0 0 0 10 3.2z"
          {...stroke}
        />
        <path d="M10 9.5v2.2M10 11.7l1.8-1.4" {...stroke} />
      </Icon>
    ),
  },
  {
    href: "/reflection",
    label: "Reflection",
    icon: (
      <Icon>
        <path d="M5 3.5h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5z" {...stroke} />
        <path d="M5 3.5a1.5 1.5 0 0 0 0 3h1.5v-3z" {...stroke} />
        <path d="M8.5 8h3.5M8.5 11h3.5" {...stroke} />
      </Icon>
    ),
  },
  {
    href: "/recommendations",
    label: "Recommendations",
    icon: (
      <Icon>
        <path d="M10 2.5a5 5 0 0 0-3 9v1.5h6V11.5a5 5 0 0 0-3-9z" {...stroke} />
        <path d="M8.5 16.5h3" {...stroke} />
      </Icon>
    ),
  },
];

const TERTIARY: NavItem[] = [
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <Icon>
        <circle cx="10" cy="10" r="2.5" {...stroke} />
        <path
          d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7"
          {...stroke}
        />
      </Icon>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed] = useNavCollapsed();

  const link = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        // The label stays in the DOM when collapsed rather than being removed:
        // it is what screen readers announce, and animating its width is what
        // makes the collapse a movement instead of a jump.
        title={collapsed ? item.label : undefined}
        className={`relative flex items-center gap-2.5 rounded-lg py-[7px] text-[13px] font-medium transition-[background-color,color,padding,gap] duration-[var(--nav-dur)] ease-[var(--nav-ease)] ${
          collapsed ? "justify-center gap-0 px-0" : "px-2.5"
        } ${
          active
            ? "bg-accent-soft text-accent-text before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-accent"
            : "text-ink-2 hover:bg-panel-2 hover:text-ink"
        }`}
      >
        {item.icon}
        <span
          className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-[var(--nav-dur)] ease-[var(--nav-ease)] ${
            collapsed ? "max-w-0 opacity-0 duration-150" : "max-w-[140px] opacity-100"
          }`}
        >
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden w-[var(--nav-w)] flex-col overflow-hidden border-r border-line bg-panel py-4 shadow-[var(--shadow)] transition-[padding] duration-[var(--nav-dur)] ease-[var(--nav-ease)] md:flex ${
        collapsed ? "px-2" : "px-3"
      }`}
    >
      <Link
        href="/"
        className={`mb-6 flex items-center gap-2 transition-[padding,gap] duration-[var(--nav-dur)] ease-[var(--nav-ease)] ${
          collapsed ? "justify-center gap-0" : "px-2.5"
        }`}
      >
        <Logo />
        <span
          className={`overflow-hidden whitespace-nowrap text-[13px] font-semibold tracking-tight transition-[max-width,opacity] duration-[var(--nav-dur)] ease-[var(--nav-ease)] ${
            collapsed ? "max-w-0 opacity-0 duration-150" : "max-w-[140px] opacity-100"
          }`}
        >
          LifeOS
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5">{PRIMARY.map(link)}</nav>

      <div className="my-3 border-t border-line" />
      <nav className="flex flex-col gap-0.5">{SECONDARY.map(link)}</nav>

      <div className="mt-auto border-t border-line pt-3">
        <nav className="flex flex-col gap-0.5">{TERTIARY.map(link)}</nav>
      </div>
    </aside>
  );
}

/**
 * Collapses the sidebar, from the header.
 *
 * It sits at the top rather than at the foot of the sidebar because a control
 * that hides its own container is easier to find above the thing it acts on —
 * and when collapsed, a button pinned to the bottom of a 60px rail is the
 * last place anyone looks for the way back.
 *
 * Desktop only: on mobile the nav is the bottom bar, which does not collapse.
 */
export function NavToggle() {
  const [collapsed, toggle] = useNavCollapsed();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      className="hidden size-9 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink md:grid"
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-[17px]">
        <rect
          x="1.75"
          y="2.75"
          width="12.5"
          height="10.5"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        {/* The rail, filled so the icon reads as a sidebar at a glance. */}
        <path d="M6 2.75v10.5" stroke="currentColor" strokeWidth="1.5" />
        {/* Rotating one chevron beats swapping two glyphs: the button never
            changes shape, it just turns. */}
        <path
          d="M11 6.25 9.25 8 11 9.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`origin-[10px_8px] transition-transform duration-[var(--nav-dur)] ease-[var(--nav-ease)] ${
            collapsed ? "rotate-180" : ""
          }`}
        />
      </svg>
    </button>
  );
}

/**
 * The five that earn a slot on a phone.
 *
 * The sidebar can hold everything; a bottom bar cannot, and cramming eight
 * items into it makes all eight unreadable. These are the ones a student opens
 * during a day rather than during a planning session — the rest stay one tap
 * away in the header.
 */
const MOBILE_PRIMARY = ["/", "/plan", "/tasks", "/school", "/grades"];

export function MobileNav() {
  const pathname = usePathname();
  const items = MOBILE_PRIMARY.map((href) => PRIMARY.find((p) => p.href === href)).filter(
    (item): item is NavItem => item != null,
  );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.18)] backdrop-blur-md md:hidden"
      aria-label="Main"
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
              active ? "text-accent-text" : "text-ink-3"
            }`}
          >
            {item.icon}
            {item.label === "Universities" ? "Unis" : item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Recommendations and Settings do not fit in a five-slot bottom bar, so on
 * mobile they live in the header instead. Hidden on desktop, where the
 * sidebar already carries them.
 */
export function MobileHeaderLinks() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-0.5 md:hidden">
      {[
        ...PRIMARY.filter((p) => !MOBILE_PRIMARY.includes(p.href)),
        ...SECONDARY,
        ...TERTIARY,
      ].map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={`grid size-9 place-items-center rounded-lg transition-colors ${
              active ? "bg-accent-soft text-accent-text" : "text-ink-3 hover:bg-panel-2"
            }`}
          >
            {item.icon}
          </Link>
        );
      })}
    </div>
  );
}
