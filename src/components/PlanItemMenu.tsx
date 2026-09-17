"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { PlanItem, PRIORITIES, PRIORITY_LABEL } from "@/lib/types";
import { addDays } from "@/lib/dates";
import { useMounted } from "@/lib/useMounted";

/**
 * What to do with one plan block, at the pointer.
 *
 * Right-click is how people expect to reach "delete this" on something drawn
 * on a surface, and reaching for the row list below to remove a block you are
 * already looking at is a trip the interface should not ask for.
 *
 * Portalled and fixed: the grid clips its own overflow, so a menu rendered
 * inside it would be cut off near the edges.
 */
export function PlanItemMenu({
  item,
  x,
  y,
  onClose,
  onRename,
}: {
  item: PlanItem | undefined;
  x: number;
  y: number;
  onClose: () => void;
  /** Omitted where the title is already editable in place, as in the row list. */
  onRename?: () => void;
}) {
  const store = useStore();
  const mounted = useMounted();

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Any press outside dismisses, including the next right-click elsewhere.
    document.addEventListener("pointerdown", close);
    document.addEventListener("contextmenu", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("contextmenu", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted || !item) return null;

  const WIDTH = 176;
  const HEIGHT = 256;

  return createPortal(
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        // Flipped when it would run off the edge, so a block near the right
        // or the bottom still gets a usable menu.
        left: Math.min(x, window.innerWidth - WIDTH - 8),
        top: Math.min(y, window.innerHeight - HEIGHT - 8),
      }}
      className="fade-up fixed z-[70] w-44 rounded-xl border border-line bg-panel p-1 shadow-[var(--shadow-lg),var(--edge)]"
    >
      <p className="truncate px-2 py-1 text-[11px] text-ink-3">{item.title || "Untitled"}</p>

      {onRename && <MenuItem onClick={onRename}>Rename</MenuItem>}
      <MenuItem
        onClick={() => {
          store.togglePlanItem(item.id);
          onClose();
        }}
      >
        {item.done ? "Mark not done" : "Mark done"}
      </MenuItem>

      <div className="my-1 border-t border-line" />
      <p className="px-2 pb-0.5 text-[10px] uppercase tracking-wide text-ink-3">Priority</p>
      {PRIORITIES.map((p) => (
        <MenuItem
          key={p}
          onClick={() => {
            store.updatePlanItem(item.id, { priority: p });
            onClose();
          }}
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: `var(--${p})` }}
            />
            {PRIORITY_LABEL[p]}
            {item.priority === p && <span className="ml-auto text-ink-3">✓</span>}
          </span>
        </MenuItem>
      ))}

      <div className="my-1 border-t border-line" />
      <MenuItem
        onClick={() => {
          store.updatePlanItem(item.id, { date: addDays(item.date, 1) });
          onClose();
        }}
      >
        Move to tomorrow
      </MenuItem>
      <MenuItem
        danger
        onClick={() => {
          store.deletePlanItem(item.id);
          onClose();
        }}
      >
        Delete
      </MenuItem>
    </div>,
    document.body,
  );
}

function MenuItem({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-panel-2 ${
        danger ? "text-[var(--urgent)]" : "text-ink-2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
