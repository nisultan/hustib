"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { motion } from "motion/react";
import { Logo } from "./Logo";
import { useNavCollapsed } from "@/lib/use-nav";
import { springNav, springSnappy } from "@/lib/motion";
import { useStore } from "@/lib/store";
import { courseColor } from "@/lib/appearance";
import { openSearch } from "./Search";
import { TaskDialog } from "./TaskDialog";

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
    href: "/goals",
    label: "Goals",
    icon: (
      <Icon>
        <circle cx="10" cy="10" r="7" {...stroke} />
        <circle cx="10" cy="10" r="3.4" {...stroke} />
        <circle cx="10" cy="10" r="0.9" fill="currentColor" stroke="none" />
      </Icon>
    ),
  },
];

const SECONDARY: NavItem[] = [
  {
    href: "/progress",
    label: "Progress",
    icon: (
      <Icon>
        <path d="M3 16.5h14" {...stroke} />
        <rect x="4" y="10" width="3.2" height="5" rx="1" {...stroke} />
        <rect x="8.4" y="6.5" width="3.2" height="8.5" rx="1" {...stroke} />
        <rect x="12.8" y="3.5" width="3.2" height="11.5" rx="1" {...stroke} />
      </Icon>
    ),
  },
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
  const store = useStore();
  const [adding, setAdding] = useState(false);
  // Which link the pointer (or keyboard focus) is on, so the hover highlight
  // can be one shared element that moves rather than one per link.
  const [hover, setHover] = useState<string | null>(null);

  /** Labels fold away when collapsed; one class string so every row agrees. */
  const label = `overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-[var(--nav-dur)] ease-[var(--nav-ease)] ${
    collapsed ? "max-w-0 opacity-0 duration-150" : "max-w-[170px] opacity-100"
  }`;
  const row = `relative isolate flex w-full items-center rounded-[7px] py-[6px] text-[14px] transition-[color,padding,gap] duration-[var(--nav-dur)] ease-[var(--nav-ease)] ${
    collapsed ? "justify-center gap-0 px-0" : "gap-2.5 px-2"
  }`;

  const link = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    const hovered = hover === item.href && !active;

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        // The label stays in the DOM when collapsed rather than being removed:
        // it is what screen readers announce, and animating its width is what
        // makes the collapse a movement instead of a jump.
        title={collapsed ? item.label : undefined}
        onMouseEnter={() => setHover(item.href)}
        onMouseLeave={() => setHover((h) => (h === item.href ? null : h))}
        onFocus={() => setHover(item.href)}
        onBlur={() => setHover((h) => (h === item.href ? null : h))}
        className={`${row} ${active ? "font-medium text-accent-text" : "text-ink"}`}
      >
        {/*
          Two travelling highlights, not eight fading ones: the pill marks where
          you are and the softer one follows the pointer, each a single element
          handed between links by `layoutId`, so moving down the list reads as
          one object going somewhere rather than two effects agreeing.
        */}
        {hovered && (
          <motion.span
            layoutId="sidebar-hover"
            transition={springNav}
            aria-hidden
            className="absolute inset-0 -z-10 rounded-[7px] bg-[color-mix(in_srgb,var(--text)_5%,transparent)]"
          />
        )}
        {active && (
          <motion.span
            layoutId="sidebar-active"
            transition={springNav}
            aria-hidden
            className="absolute inset-0 -z-10 rounded-[7px] bg-accent-soft"
          />
        )}

        {/* Grey icons, dark words — the icon is a landmark, the word is what
            you read. On the current page both take the accent. */}
        <span
          className={`grid shrink-0 place-items-center ${active ? "text-accent" : "text-ink-3"}`}
        >
          {item.icon}
        </span>

        <span className={label}>{item.label}</span>
      </Link>
    );
  };

  const name = store.profile.name && store.profile.name !== "there" ? store.profile.name : "You";

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden w-[var(--nav-w)] flex-col overflow-hidden bg-sidebar py-3 transition-[padding] duration-[var(--nav-dur)] ease-[var(--nav-ease)] md:flex ${
        collapsed ? "px-2" : "px-3"
      }`}
    >
      {/*
        The top row is the app and the switch that hides it. The sidebar is
        told apart from the page by a warmer tint alone — no border, no shadow —
        the way a desk is told apart from the paper on it.
      */}
      <div
        className={`mb-3 flex items-center ${collapsed ? "flex-col gap-2" : "justify-between pl-1.5"}`}
      >
        <Link href="/" className="flex min-w-0 items-center gap-2" title="Locked In">
          <Logo size="sm" />
          <span className={`text-[14px] font-bold tracking-tight ${label}`}>Locked In</span>
        </Link>
        <NavToggle />
      </div>

      {/*
        Adding a task is the first thing in the sidebar and the only thing in
        colour. It is the action the app exists for, and putting it at the top
        of the list you already scan — rather than in a header button across
        the screen — is what makes capturing something a reflex.
      */}
      <button
        type="button"
        onClick={() => setAdding(true)}
        title={collapsed ? "Add task" : undefined}
        className={`${row} group font-semibold text-accent-text hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]`}
      >
        <span className="grid size-[20px] shrink-0 place-items-center rounded-full bg-accent text-white transition-transform group-hover:scale-110">
          <svg viewBox="0 0 16 16" aria-hidden className="size-3">
            <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <span className={label}>Add task</span>
      </button>

      <button
        type="button"
        onClick={() => openSearch()}
        title={collapsed ? "Search" : undefined}
        className={`${row} text-ink hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]`}
      >
        <span className="grid shrink-0 place-items-center text-ink-3">
          <Icon>
            <circle cx="9" cy="9" r="5.25" {...stroke} />
            <path d="m13 13 3.5 3.5" {...stroke} />
          </Icon>
        </span>
        <span className={`${label} flex-1 text-left`}>Search</span>
      </button>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none]">
        <nav className="flex flex-col gap-px">{PRIMARY.map(link)}</nav>
        <div className="my-2" />
        <nav className="flex flex-col gap-px">{SECONDARY.map(link)}</nav>

        {/*
          Categories, the way a task app lists projects: a coloured # and a
          name, each opening the task list filtered to it. They were reachable
          only as chips at the top of the tasks page, so the parts of your life
          you sort work into never appeared anywhere you could see at a glance.
        */}
        {store.categories.length > 0 && (
          <div className={`mt-5 ${collapsed ? "hidden" : ""}`}>
            <p className="mb-1 px-2 text-[13px] font-bold text-ink-2">My categories</p>
            <nav className="flex flex-col gap-px">
              {store.categories.map((c) => {
                const href = `/tasks?category=${c.id}`;
                const open = store.tasks.filter(
                  (t) => t.categoryId === c.id && t.status !== "completed",
                ).length;
                return (
                  <Link
                    key={c.id}
                    href={href}
                    className={`${row} group text-ink hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]`}
                  >
                    <span
                      aria-hidden
                      className="grid w-[17px] shrink-0 place-items-center text-[16px] font-semibold leading-none"
                      style={{ color: courseColor(c.color) }}
                    >
                      #
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {open > 0 && <span className="nums text-[12px] text-ink-3">{open}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/*
        You, at the foot: your initial and your name, opening Settings. A
        sidebar that ends in a cog is a tool's sidebar; one that ends in the
        person using it is theirs.
      */}
      <Link
        href="/settings"
        title={collapsed ? "Settings" : undefined}
        aria-current={isActive(pathname, "/settings") ? "page" : undefined}
        className={`${row} mt-2 group text-ink hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)] ${
          isActive(pathname, "/settings") ? "bg-accent-soft" : ""
        }`}
      >
        <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold uppercase text-white">
          {name.slice(0, 1)}
        </span>
        <span className={`${label} flex-1 truncate font-medium`}>{name}</span>
        <span className={`${collapsed ? "hidden" : ""} text-ink-3 transition-colors group-hover:text-ink`}>
          {TERTIARY[0].icon}
        </span>
      </Link>

      <TaskDialog open={adding} onClose={() => setAdding(false)} />
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
const MOBILE_PRIMARY = ["/", "/plan", "/tasks", "/goals", "/reflection"];

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
            className={`relative flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
              active ? "text-accent-text" : "text-ink-3"
            }`}
          >
            {/* The same travelling highlight as the sidebar, reduced to the
                one line a 10px-tall bar has room for. */}
            {active && (
              <motion.span
                layoutId="mobile-nav-active"
                transition={springSnappy}
                aria-hidden
                className="absolute inset-x-5 top-0 h-[2px] rounded-full bg-accent"
              />
            )}
            <motion.span whileTap={{ scale: 0.88 }} transition={springSnappy}>
              {item.icon}
            </motion.span>
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
