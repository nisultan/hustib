"use client";

import { ReactNode, RefObject, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A panel anchored under a trigger, rendered into the body.
 *
 * The portal is the whole point: these open inside dialogs and inside panels
 * that scroll, and a panel positioned within either gets clipped by it. Fixed
 * coordinates measured from the trigger escape both, at the cost of having to
 * re-measure on scroll and resize.
 */
export function Popover({
  anchorRef,
  open,
  onClose,
  children,
  align = "start",
  maxHeight = 280,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: "start" | "end";
  maxHeight?: number;
}) {
  const [box, setBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  // Layout effect, so the panel is placed in the same frame it appears in
  // rather than flashing at the top left corner first.
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 8;
      const above = r.top - 8;
      // Flip up when there is more room there, which is what stops a select
      // near the bottom of a dialog opening into nothing.
      const flip = below < Math.min(maxHeight, 160) && above > below;
      const height = Math.min(maxHeight, flip ? above : below);

      setBox({
        left: align === "end" ? r.right : r.left,
        top: flip ? r.top - 6 - height : r.bottom + 6,
        width: r.width,
        height,
      });
    };

    place();
    window.addEventListener("resize", place);
    // Capture phase, so scrolling any ancestor repositions it, not just window.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef, align, maxHeight]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.("[data-popover]")) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !box) return null;

  return createPortal(
    <div
      data-popover
      style={{
        position: "fixed",
        left: align === "end" ? undefined : box.left,
        right: align === "end" ? window.innerWidth - box.left : undefined,
        top: box.top,
        minWidth: box.width,
        maxHeight: box.height,
      }}
      className="fade-up z-[60] overflow-auto overscroll-contain rounded-xl border border-line bg-panel p-1 shadow-[var(--shadow-lg),var(--edge)]"
    >
      {children}
    </div>,
    document.body,
  );
}
