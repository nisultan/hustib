"use client";

import { Children, ReactElement, isValidElement, useMemo, useRef, useState } from "react";
import { Popover } from "./Popover";

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Reads the `<option>` children a native select would have taken.
 *
 * Keeping that API is deliberate: thirteen call sites already write options
 * this way, and a component that swaps the rendering without touching them is
 * a much smaller thing to get wrong than thirteen migrations.
 */
function readOptions(children: React.ReactNode): Option[] {
  const out: Option[] = [];
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child) || child.type !== "option") continue;
    const props = (child as ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>).props;
    const label =
      typeof props.children === "string"
        ? props.children
        : Array.isArray(props.children)
          ? props.children.filter((c) => typeof c === "string").join("")
          : String(props.value ?? "");
    out.push({ value: String(props.value ?? ""), label, disabled: props.disabled });
  }
  return out;
}

/**
 * The app's dropdown.
 *
 * This replaces the native select because the menu a native one opens is
 * drawn by the operating system: on Windows it is a cramped list with a hard
 * blue highlight that ignores the app's palette entirely. The cost is having
 * to reimplement the keyboard behaviour, which is what the handler below is.
 */
export function Choice({
  value,
  onChange,
  children,
  className = "",
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const options = useMemo(() => readOptions(children), [children]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const openMenu = () => {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const commit = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const step = (from: number, delta: number) => {
    // Skip disabled entries rather than landing on one and stalling.
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = (i + delta + options.length) % options.length;
      if (!options[i]?.disabled) return i;
    }
    return from;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => step(i, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => step(i, -1));
        break;
      case "Home":
        e.preventDefault();
        setActive(step(-1, 1));
        break;
      case "End":
        e.preventDefault();
        setActive(step(0, -1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(active);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        // Type-ahead: jumping to "Completed" by pressing c is the one native
        // behaviour people genuinely rely on.
        if (e.key.length === 1) {
          const q = e.key.toLowerCase();
          const from = active + 1;
          const found = options.findIndex(
            (o, i) => i >= from && !o.disabled && o.label.toLowerCase().startsWith(q),
          );
          const wrapped =
            found >= 0
              ? found
              : options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(q));
          if (wrapped >= 0) setActive(wrapped);
        }
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-left text-sm text-ink transition-[background-color,border-color,box-shadow] duration-150 hover:border-line-strong focus:border-accent focus:bg-panel focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:outline-none disabled:pointer-events-none disabled:opacity-40 ${
          open ? "border-accent bg-panel shadow-[0_0_0_3px_var(--accent-soft)]" : ""
        } ${className}`}
      >
        <span className={`truncate ${selected ? "" : "text-ink-3"}`}>
          {selected?.label ?? "Select…"}
        </span>
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className={`size-3.5 shrink-0 text-ink-3 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            d="M4 6.5 L8 10.5 L12 6.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Popover anchorRef={triggerRef} open={open} onClose={() => setOpen(false)}>
        <ul role="listbox" aria-label={ariaLabel}>
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li key={o.value || `i${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={o.disabled}
                  // Keeping focus on the trigger means the keyboard handler
                  // above stays in charge while the mouse moves around.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(i)}
                  ref={(el) => {
                    if (el && open && i === active) {
                      el.scrollIntoView({ block: "nearest" });
                    }
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors disabled:opacity-40 ${
                    i === active ? "bg-accent-soft text-accent-text" : "text-ink"
                  }`}
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {isSelected && (
                    <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 shrink-0">
                      <path
                        d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    </>
  );
}
