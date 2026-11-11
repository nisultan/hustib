"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "./Logo";
import { useNavCollapsed } from "@/lib/use-nav";
import { springNav, springSnappy } from "@/lib/motion";
import { useStore } from "@/lib/store";
import { courseColor, NAV_DEFAULT, NAV_MAX, NAV_MIN, NAV_WIDTH_KEY } from "@/lib/appearance";
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

/** The soft, tinted fill under each outline — what makes the set duotone. */
const soft = { fill: "currentColor", fillOpacity: 0.22, stroke: "none" };
const dot = { fill: "currentColor", stroke: "none" };

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden className="shrink-0 overflow-visible">
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
        <path d="M3.5 9 10 3.8 16.5 9v6.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" {...soft} />
        <path d="M3.5 9 10 3.8 16.5 9v6.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" {...stroke} />
        <path d="M8 17v-3.5a2 2 0 0 1 4 0V17" {...stroke} />
      </Icon>
    ),
  },
  {
    href: "/plan",
    label: "Plan",
    icon: (
      <Icon>
        <path d="M3 7.5V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1.5z" {...soft} />
        <rect x="3" y="4" width="14" height="13" rx="2.5" {...stroke} />
        <path d="M3 7.5h14M7 2.5v3M13 2.5v3" {...stroke} />
        <circle cx="7" cy="11" r="1" {...dot} />
        <circle cx="10" cy="11" r="1" {...dot} />
        <circle cx="13" cy="11" r="1" {...dot} opacity="0.45" />
        <circle cx="7" cy="14" r="1" {...dot} opacity="0.45" />
        <circle cx="10" cy="14" r="1" {...dot} opacity="0.45" />
      </Icon>
    ),
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: (
      <Icon>
        <rect x="2.8" y="3.2" width="6" height="6" rx="2" {...soft} />
        <rect x="2.8" y="3.2" width="6" height="6" rx="2" {...stroke} />
        <path d="m4.4 6.3 1.2 1.2 2-2.3" {...stroke} />
        <rect x="2.8" y="10.8" width="6" height="6" rx="2" {...stroke} />
        <path d="M11.5 5h5.5M11.5 7.6h3.2M11.5 12.6h5.5M11.5 15.2h3.2" {...stroke} />
      </Icon>
    ),
  },
  {
    href: "/courses",
    label: "Courses",
    icon: (
      <Icon>
        <path d="M10 3.5 2.5 7.5 10 11.5l7.5-4z" {...soft} />
        <path d="M10 3.5 2.5 7.5 10 11.5l7.5-4z" {...stroke} />
        <path d="M5.5 9.2V13c0 1.4 2 2.7 4.5 2.7s4.5-1.3 4.5-2.7V9.2M17.5 7.5v4.2" {...stroke} />
      </Icon>
    ),
  },
  {
    href: "/goals",
    label: "Goals",
    icon: (
      <Icon>
        <circle cx="9.5" cy="10.5" r="7" {...soft} />
        <circle cx="9.5" cy="10.5" r="7" {...stroke} />
        <circle cx="9.5" cy="10.5" r="3.3" {...stroke} />
        <path d="m9.5 10.5 6.3-6.3M13.6 3.6l2.3.1.1 2.3" {...stroke} />
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
        <path d="M3 16.5V12l4-3.5 3 2.5 6.5-6v11.5z" {...soft} />
        <path d="m3 12 4-3.5 3 2.5 6.5-6" {...stroke} />
        <path d="M3 16.5h14" {...stroke} />
        <circle cx="16.5" cy="5" r="1.6" {...dot} />
      </Icon>
    ),
  },
  {
    href: "/report",
    label: "Report",
    icon: (
      <Icon>
        <path d="M6 2.8h5.5l3.7 3.7v9.5a1.2 1.2 0 0 1-1.2 1.2H6A1.2 1.2 0 0 1 4.8 16V4A1.2 1.2 0 0 1 6 2.8z" {...soft} />
        <path d="M6 2.8h5.5l3.7 3.7v9.5a1.2 1.2 0 0 1-1.2 1.2H6A1.2 1.2 0 0 1 4.8 16V4A1.2 1.2 0 0 1 6 2.8z" {...stroke} />
        <path d="M11.5 2.8v3.7h3.7" {...stroke} />
        <path d="m10 9 .9 1.9 1.9.9-1.9.9-.9 1.9-.9-1.9-1.9-.9 1.9-.9z" {...dot} />
      </Icon>
    ),
  },
  {
    href: "/gym",
    label: "Gym",
    icon: (
      <Icon>
        <rect x="2.4" y="6.5" width="3" height="7" rx="1" {...soft} />
        <rect x="14.6" y="6.5" width="3" height="7" rx="1" {...soft} />
        <rect x="2.4" y="6.5" width="3" height="7" rx="1" {...stroke} />
        <rect x="14.6" y="6.5" width="3" height="7" rx="1" {...stroke} />
        <path d="M5.4 8.2v3.6M14.6 8.2v3.6M5.4 10h9.2" {...stroke} />
      </Icon>
    ),
  },
  {
    href: "/reflection",
    label: "Reflection",
    icon: (
      <Icon>
        <path d="M15.8 12.6A6.6 6.6 0 0 1 7.4 4.2a6.6 6.6 0 1 0 8.4 8.4z" {...soft} />
        <path d="M15.8 12.6A6.6 6.6 0 0 1 7.4 4.2a6.6 6.6 0 1 0 8.4 8.4z" {...stroke} />
        <path d="m14.5 2.8.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" {...dot} />
      </Icon>
    ),
  },
  {
    href: "/recommendations",
    label: "Advice",
    icon: (
      <Icon>
        <circle cx="10" cy="10" r="7" {...soft} />
        <circle cx="10" cy="10" r="7" {...stroke} />
        <path d="m13.2 6.8-1.8 4.6-4.6 1.8 1.8-4.6z" {...stroke} />
        <circle cx="10" cy="10" r="0.9" {...dot} />
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
        <path d="M3.5 6.5h6.5M15 6.5h1.5M3.5 13.5h1.5M10 13.5h6.5" {...stroke} />
        <circle cx="12.5" cy="6.5" r="2.4" {...soft} />
        <circle cx="12.5" cy="6.5" r="2.4" {...stroke} />
        <circle cx="7.5" cy="13.5" r="2.4" {...soft} />
        <circle cx="7.5" cy="13.5" r="2.4" {...stroke} />
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
    collapsed ? "max-w-0 opacity-0 duration-150" : "max-w-[340px] opacity-100"
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
        <motion.span
          className={`grid shrink-0 place-items-center transition-colors duration-150 ${
            active ? "text-accent" : hovered ? "text-ink-2" : "text-ink-3"
          }`}
          animate={{ scale: hovered ? 1.12 : 1 }}
          transition={springSnappy}
        >
          {item.icon}
        </motion.span>

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
        <Link href="/" className="flex min-w-0 items-center gap-2" title="Lock In">
          <Logo size="sm" />
          <span className={`text-[14px] font-bold tracking-tight ${label}`}>Lock In</span>
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
      {!collapsed && <ResizeHandle />}
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
const MOBILE_PRIMARY = ["/", "/plan", "/tasks", "/gym", "/reflection"];

const ALL_ITEMS = (): NavItem[] => [...PRIMARY, ...SECONDARY, ...TERTIARY];

export function MobileNav() {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const all = ALL_ITEMS();
  const items = MOBILE_PRIMARY.map((href) => all.find((p) => p.href === href)).filter(
    (item): item is NavItem => item != null,
  );
  const rest = all.filter((p) => !MOBILE_PRIMARY.includes(p.href));
  const inMore = rest.some((p) => isActive(pathname, p.href));

  // Navigating closes the sheet.
  useEffect(() => setMore(false), [pathname]);
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [more]);

  const tab = "relative flex flex-col items-center justify-center gap-1 pb-1.5 pt-2 text-[10px] font-medium transition-colors";

  return (
    <>
      <AnimatePresence>
        {more && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMore(false)}
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] md:hidden"
            />
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 500) setMore(false);
              }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-line bg-panel px-4 pb-[calc(env(safe-area-inset-bottom)+76px)] pt-2.5 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.4)] md:hidden"
              role="dialog"
              aria-label="More pages"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)]" />
              <div className="grid grid-cols-4 gap-2">
                {rest.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMore(false)}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-[11.5px] font-medium transition-colors active:scale-95 ${
                        active ? "bg-accent-soft text-accent-text" : "bg-panel-2 text-ink-2"
                      }`}
                    >
                      {item.icon}
                      <span className="truncate">{item.label === "Recommendations" ? "Advice" : item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav
        className="fixed inset-x-0 bottom-0 z-[55] grid grid-cols-6 border-t border-line bg-panel/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.18)] backdrop-blur-md md:hidden"
        aria-label="Main"
      >
        {items.map((item) => {
          const active = isActive(pathname, item.href) && !more;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`${tab} ${active ? "text-accent-text" : "text-ink-3"}`}
            >
              {active && (
                <motion.span
                  layoutId="mobile-nav-active"
                  transition={springSnappy}
                  aria-hidden
                  className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-accent"
                />
              )}
              <motion.span whileTap={{ scale: 0.85 }} transition={springSnappy}>
                {item.icon}
              </motion.span>
              {item.label === "Reflection" ? "Journal" : item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
          className={`${tab} ${more || inMore ? "text-accent-text" : "text-ink-3"}`}
        >
          {(more || inMore) && (
            <motion.span
              layoutId="mobile-nav-active"
              transition={springSnappy}
              aria-hidden
              className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-accent"
            />
          )}
          <motion.span whileTap={{ scale: 0.85 }} animate={{ rotate: more ? 45 : 0 }} transition={springSnappy}>
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
              <path d="M10 4.5v11M4.5 10h11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </motion.span>
          More
        </button>
      </nav>
    </>
  );
}

/** Kept for the layout's import; the pages it used to list live in More now. */
export function MobileHeaderLinks() {
  return null;
}

/**
 * The sidebar's right edge: drag to resize, double-click to reset. Dropping
 * it narrower than the minimum folds the sidebar to icons instead.
 */
function ResizeHandle() {
  const [, toggle] = useNavCollapsed();
  const [active, setActive] = useState(false);

  const start = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const root = document.documentElement;
    root.setAttribute("data-nav-drag", "");
    setActive(true);
    let width = Math.round(e.currentTarget.parentElement?.getBoundingClientRect().width ?? NAV_DEFAULT);

    const move = (ev: PointerEvent) => {
      width = Math.round(ev.clientX);
      root.style.setProperty("--nav-open", `${Math.min(NAV_MAX, Math.max(NAV_MIN, width))}px`);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      root.removeAttribute("data-nav-drag");
      setActive(false);
      const kept = Math.min(NAV_MAX, Math.max(NAV_MIN, width));
      try {
        localStorage.setItem(NAV_WIDTH_KEY, String(kept));
      } catch {
        // Storage blocked: the width holds for this session.
      }
      if (width < NAV_MIN - 60) toggle();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const reset = () => {
    document.documentElement.style.setProperty("--nav-open", `${NAV_DEFAULT}px`);
    try {
      localStorage.setItem(NAV_WIDTH_KEY, String(NAV_DEFAULT));
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      title="Drag to resize · double-click to reset"
      onPointerDown={start}
      onDoubleClick={reset}
      className="group absolute inset-y-0 right-0 z-10 w-2 cursor-col-resize"
    >
      <span
        className={`absolute inset-y-0 right-0 w-[2px] transition-colors duration-150 ${
          active ? "bg-accent" : "bg-transparent group-hover:bg-[var(--border-strong)]"
        }`}
      />
    </div>
  );
}
