"use client";

import { useCallback, useSyncExternalStore } from "react";
import { NAV_KEY } from "./appearance";

/**
 * Whether the sidebar is collapsed to icons.
 *
 * The attribute on <html> is the source of truth rather than React state,
 * because the pre-paint script in the document head sets it from storage
 * before React exists — the sidebar must not render wide and then snap
 * narrow.
 *
 * Every caller therefore *subscribes* to that attribute instead of keeping
 * its own copy. The sidebar and the button that collapses it are different
 * components; with a `useState` each, only the one that was clicked knew, and
 * the sidebar kept its labels until the next navigation happened to remount
 * it — a rail of centred icons at full width.
 */

const listeners = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function read(): boolean {
  return document.documentElement.getAttribute("data-nav") === "collapsed";
}

export function useNavCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);

  const toggle = useCallback(() => {
    // The write happens here rather than inside a state updater. An updater
    // must be pure: under StrictMode React calls it twice, which toggled the
    // attribute back to where it started while the state flipped once.
    const next = !read();
    const root = document.documentElement;
    if (next) root.setAttribute("data-nav", "collapsed");
    else root.removeAttribute("data-nav");
    try {
      localStorage.setItem(NAV_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked. The choice still applies for this session.
    }
    for (const fn of listeners) fn();
  }, []);

  return [collapsed, toggle];
}
