"use client";

import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/lib/useMounted";
import {
  Priority,
  PRIORITY_LABEL,
  UniPriority,
  UniStatus,
  UNI_STATUS_LABEL,
} from "@/lib/types";

export function Panel({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  return (
    <Tag
      className={`rounded-xl border border-line bg-panel shadow-[var(--shadow)] ${className}`}
    >
      {children}
    </Tag>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-3">
        {children}
      </h2>
      {right}
    </div>
  );
}

type ButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  variant = "secondary",
  size = "md",
  className = "",
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap";
  const sizes = { sm: "h-8 px-2.5 text-[13px]", md: "h-9 px-3.5 text-sm" };
  const variants = {
    primary: "bg-accent text-white hover:opacity-90",
    secondary: "border border-line bg-panel text-ink hover:bg-panel-2",
    ghost: "text-ink-2 hover:bg-panel-2 hover:text-ink",
    danger: "border border-line text-[var(--urgent)] hover:bg-panel-2",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/**
 * No width here on purpose. A `w-full` baked into this string cannot be
 * overridden by a `w-auto` passed in `className` — Tailwind utilities share
 * one specificity, so stylesheet order wins rather than class order, and the
 * filter bars that want compact controls would silently stretch. `Field`
 * stretches its own controls instead, and standalone controls size themselves.
 */
const fieldClass =
  "rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-ink-3 transition-colors focus:border-accent focus:bg-panel focus:outline-none";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block [&>input]:w-full [&>select]:w-full [&>textarea]:w-full">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${fieldClass} resize-y leading-relaxed ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${fieldClass} cursor-pointer ${props.className ?? ""}`}>
      {props.children}
    </select>
  );
}

/** Coloured dot carrying priority. Always paired with a text label elsewhere. */
export function PriorityDot({
  priority,
  className = "",
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`inline-block size-2 shrink-0 rounded-full ${className}`}
      style={{ background: `var(--${priority})` }}
    />
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
      style={{ color: `var(--${priority})`, background: "var(--panel-2)" }}
    >
      <PriorityDot priority={priority} />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "up" | "down";
}) {
  const tones = {
    neutral: "text-ink-2 bg-panel-2 border-line",
    accent: "text-accent-text bg-accent-soft border-transparent",
    up: "text-[var(--up)] bg-panel-2 border-line",
    down: "text-[var(--down)] bg-panel-2 border-line",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const UNI_PRIORITY_STYLE: Record<UniPriority, string> = {
  dream: "text-accent-text bg-accent-soft border-transparent",
  target: "text-ink-2 bg-panel-2 border-line",
  safety: "text-ink-3 bg-panel-2 border-line",
};

export function UniPriorityBadge({ priority }: { priority: UniPriority }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium capitalize ${UNI_PRIORITY_STYLE[priority]}`}
    >
      {priority}
    </span>
  );
}

const UNI_STATUS_COLOR: Record<UniStatus, string> = {
  interested: "var(--low)",
  researching: "var(--medium)",
  preparing: "var(--high)",
  applied: "var(--accent)",
  accepted: "var(--up)",
  rejected: "var(--down)",
  waitlisted: "var(--high)",
};

export function UniStatusBadge({ status }: { status: UniStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-2">
      <span
        aria-hidden
        className="inline-block size-1.5 rounded-full"
        style={{ background: UNI_STATUS_COLOR[status] }}
      />
      {UNI_STATUS_LABEL[status]}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-ink-3">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Lock scroll so the page behind does not move under the dialog.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("input, textarea, select")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/30 p-0 backdrop-blur-[2px] sm:items-start sm:p-6 sm:pt-[8vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fade-up w-full rounded-t-2xl border border-line bg-panel shadow-xl sm:rounded-2xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-md p-1 text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Trend arrow + delta, used on course cards and the grades page. */
export function TrendLabel({
  direction,
  delta,
  suffix = "",
}: {
  direction: "improving" | "declining" | "stable";
  delta: number;
  suffix?: string;
}) {
  const color =
    direction === "improving"
      ? "var(--up)"
      : direction === "declining"
        ? "var(--down)"
        : "var(--flat)";
  const arrow = direction === "improving" ? "↑" : direction === "declining" ? "↓" : "→";
  const value = direction === "stable" ? "Stable" : `${Math.abs(delta).toFixed(1)}%`;
  return (
    <span className="nums inline-flex items-center gap-1 text-xs font-medium" style={{ color }}>
      <span aria-hidden>{arrow}</span>
      {value}
      {suffix && <span className="text-ink-3">{suffix}</span>}
    </span>
  );
}
