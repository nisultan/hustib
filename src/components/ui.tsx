"use client";

import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { backdrop, dialogPanel, spring, springSnappy } from "@/lib/motion";
import { useMounted } from "@/lib/useMounted";
import { Choice } from "./Choice";
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
  interactive = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
  /** Lifts on hover. For cards that are themselves a link or a button. */
  interactive?: boolean;
  /** For values a class cannot carry, such as a per-course tint. */
  style?: CSSProperties;
}) {
  const base = `rounded-xl border border-line bg-panel ${className}`;

  if (!interactive) {
    return (
      <Tag style={style} className={base}>
        {children}
      </Tag>
    );
  }

  // A card that responds to the pointer has to come back down as convincingly
  // as it went up; a CSS hover lift snaps back the instant the cursor leaves.
  // The spring means the card settles either way, and the press gives the
  // click somewhere to land.
  const Motion = Tag === "section" ? motion.section : motion.div;
  return (
    <Motion
      style={style}
      className={`${base} transition-[background-color,border-color] duration-150 hover:border-line-strong hover:bg-panel-2/40`}
      whileTap={{ scale: 0.995 }}
      transition={spring}
    >
      {children}
    </Motion>
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {/* Big and bold, the way a page in a notebook is headed. A 24px
            semibold title over a grey subtitle was the voice of a settings
            screen; the page name is the one thing on it that should be loud. */}
        <h1 className="text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    /*
      Plain bold words, not a label.

      Every section used to open with eleven-pixel capitals spaced apart —
      CLOSEST DEADLINES, WHAT I NOTICED — the typographic voice of a monitoring
      dashboard, and on a page that is half headers it was most of why the app
      read as generated. A heading in the same type as the content, just
      heavier, reads as somebody's own list.
    */
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-bold tracking-tight text-ink">{children}</h2>
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
  // The press is what makes a button feel like an object rather than a
  // rectangle that changes colour: it moves under the finger, then settles.
  /*
    Flat, and still. The old buttons rose a pixel on hover and carried a
    highlight along their top edge — small flourishes, but on every button they
    added up to an interface performing for you. A solid accent button that
    darkens a touch, and a quiet grey one, is all a button needs to be. The
    press still gives slightly, because that is feedback rather than ornament.
  */
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-[7px] font-medium whitespace-nowrap transition-[background-color,border-color,color,filter] duration-150 disabled:opacity-40 disabled:pointer-events-none";
  const sizes = { sm: "h-8 px-2.5 text-[13px]", md: "h-9 px-3.5 text-sm" };
  const variants = {
    primary: "bg-accent text-white hover:brightness-[0.93] active:brightness-[0.88]",
    secondary: "bg-panel-2 text-ink hover:bg-[var(--border)]",
    ghost: "text-ink-2 hover:bg-panel-2 hover:text-ink",
    danger: "text-[var(--urgent)] hover:bg-[color-mix(in_srgb,var(--urgent)_10%,transparent)]",
  };
  return (
    <motion.button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      whileTap={rest.disabled ? undefined : { scale: 0.98 }}
      transition={springSnappy}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
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
  "rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-ink-3 transition-[background-color,border-color,box-shadow] duration-150 hover:border-line-strong focus:border-accent focus:bg-panel focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none";

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

/**
 * Dropdown.
 *
 * Keeps the props a native select took — `value`, `onChange` with an event,
 * `<option>` children — while rendering the app's own listbox, so the
 * thirteen existing call sites did not have to change. See Choice.tsx for why
 * the native one had to go.
 */
export function Select({
  value,
  onChange,
  children,
  className = "",
  disabled,
  "aria-label": ariaLabel,
}: {
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Choice
      value={value ?? ""}
      onChange={(v) => onChange?.({ target: { value: v } })}
      className={className}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </Choice>
  );
}

/**
 * Segmented control.
 *
 * The selected segment is a raised solid surface rather than a tint, because a
 * tint at these sizes reads as "slightly different text" — which was the
 * complaint about the old filter bar. A real fill and a shadow make the
 * selection the first thing the eye lands on.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      /* `isolate` keeps the sliding thumb's negative z-index inside this
         control, instead of dropping it behind the page. */
      className="isolate inline-flex flex-wrap gap-0.5 rounded-xl border border-line bg-panel-2 p-1"
    >
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.id)}
            className={`relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
              selected ? "text-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            {/* The raised segment slides to the option you picked, so the
                control reads as one thumb moving in a track rather than two
                buttons swapping appearance. */}
            {selected && (
              <motion.span
                layoutId={`segmented-${label}`}
                transition={springSnappy}
                aria-hidden
                className="absolute inset-0 -z-10 rounded-lg bg-panel shadow-[var(--shadow),var(--edge)]"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
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

/**
 * Nothing here yet — said kindly.
 *
 * A small drawing, a line in plain words, and the one action that fixes it.
 * The old one was a logo in a dashed box, which is how a system reports an
 * absence; a picture of an empty tray with a little sparkle is how a person
 * would show you there is room to put something.
 */
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
    <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
      <EmptyArt className="mb-3 h-[92px] w-[124px]" />
      <p className="text-[15px] font-bold tracking-tight text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-[13.5px] leading-relaxed text-ink-2">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * An open tray, two leaves and a few sparkles.
 *
 * Fixed warm colours rather than the accent, so it looks the same whatever the
 * student picked — an illustration that changes colour with a setting stops
 * looking drawn.
 */
export function EmptyArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden className={className}>
      <ellipse cx="80" cy="104" rx="46" ry="6" fill="currentColor" className="text-ink-3" opacity="0.14" />
      {/* leaves */}
      <path d="M44 92c-14-6-18-22-12-34 9 6 16 20 12 34Z" fill="#5f8f5a" opacity="0.75" />
      <path d="M116 92c13-8 15-25 7-36-8 8-13 23-7 36Z" fill="#4f7d4b" opacity="0.7" />
      {/* tray */}
      <rect x="46" y="50" width="68" height="44" rx="9" fill="#f2a72a" />
      <rect x="51" y="50" width="58" height="16" rx="6" fill="#ffd27a" />
      <path
        d="M46 70h19c1.6 0 3 .8 3.9 2.1l3 4.3c.9 1.3 2.3 2.1 3.9 2.1h8.4c1.6 0 3-.8 3.9-2.1l3-4.3c.9-1.3 2.3-2.1 3.9-2.1H114v15a9 9 0 0 1-9 9H55a9 9 0 0 1-9-9V70Z"
        fill="#ffbe45"
      />
      {/* sparkles */}
      <path d="M124 30l2.6 7.4L134 40l-7.4 2.6L124 50l-2.6-7.4L114 40l7.4-2.6L124 30Z" fill="#f2a72a" />
      <path d="M36 52l1.4 4L41.4 57.4 37.4 58.8 36 62.8l-1.4-4-4-1.4 4-1.4L36 52Z" fill="#f2a72a" opacity="0.85" />
      <path d="M134 66l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1 1-2.8Z" fill="#f2a72a" opacity="0.7" />
    </svg>
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

  if (!mounted) return null;

  // Rendered inside AnimatePresence rather than behind an early return, so
  // the dialog gets to leave: closing used to cut the panel and its backdrop
  // out of the page in a single frame, which is the one moment a dialog most
  // needs to look deliberate.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          variants={backdrop}
          initial="hidden"
          animate="show"
          exit="exit"
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-0 backdrop-blur-[3px] sm:items-start sm:p-6 sm:pt-[8vh]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={dialogPanel}
            className={`w-full rounded-t-2xl border border-line bg-panel shadow-[var(--shadow-lg),var(--edge)] sm:rounded-2xl ${
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Delete control that asks once before acting.
 *
 * Two clicks rather than a modal: deleting a single row is cheap to redo and a
 * dialog for each one would be heavier than the action deserves. The armed
 * state resets on blur and after a few seconds, so a stray first click cannot
 * leave a live delete button sitting under the cursor.
 */
export function ConfirmDeleteButton({
  onConfirm,
  label,
  className = "",
  size = "sm",
}: {
  onConfirm: () => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), 3500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [armed]);

  const dimension = size === "sm" ? "size-7" : "size-9";

  if (armed) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onConfirm();
        }}
        onBlur={() => setArmed(false)}
        aria-label={`Confirm: ${label}`}
        className={`shrink-0 self-start rounded-md px-2 py-1 text-[11px] font-medium text-white ${className}`}
        style={{ background: "var(--urgent)" }}
      >
        Delete?
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setArmed(true);
      }}
      aria-label={label}
      title={label}
      className={`grid ${dimension} shrink-0 self-start place-items-center rounded-md text-ink-3 transition-colors hover:bg-panel-2 hover:text-[var(--urgent)] ${className}`}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M2.8 4.3h10.4M6.4 4.3V3.1a.8.8 0 0 1 .8-.8h1.6a.8.8 0 0 1 .8.8v1.2M12.2 4.3l-.5 8.4a1 1 0 0 1-1 .95H5.3a1 1 0 0 1-1-.95l-.5-8.4"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
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
