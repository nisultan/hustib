"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

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

  const link = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors ${
          active
            ? "bg-accent-soft text-accent-text"
            : "text-ink-2 hover:bg-panel-2 hover:text-ink"
        }`}
      >
        {item.icon}
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[232px] flex-col border-r border-line bg-panel px-3 py-4 md:flex">
      <Link href="/" className="mb-6 flex items-center gap-2 px-2.5">
        <span className="grid size-7 place-items-center rounded-lg bg-accent text-[13px] font-bold text-white">
          IB
        </span>
        <span className="text-[13px] font-semibold tracking-tight">IB Learner</span>
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

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Main"
    >
      {PRIMARY.map((item) => {
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
      {[...SECONDARY, ...TERTIARY].map((item) => {
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
