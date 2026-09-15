"use client";

import { useCallback, useEffect, useState } from "react";
import { NAV_KEY } from "./appearance";

/**
 * Whether the sidebar is collapsed to icons.
 *
 * The attribute on <html> is the source of truth rather than this state,
 * because the pre-paint script in the document head sets it from storage
 * before React exists — the sidebar must not render wide and then snap
 * narrow. This hook reads that attribute on mount and writes both on change.
 */
export function useNavCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(document.documentElement.getAttribute("data-nav") === "collapsed");
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      const root = document.documentElement;
      if (next) root.setAttribute("data-nav", "collapsed");
      else root.removeAttribute("data-nav");
      try {
        localStorage.setItem(NAV_KEY, next ? "1" : "0");
      } catch {
        // Storage blocked. The choice still applies for this session.
      }
      return next;
    });
  }, []);

  return [collapsed, toggle];
}
