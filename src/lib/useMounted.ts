"use client";

import { useEffect, useState } from "react";

/**
 * False on the server and on the first client render, true afterwards.
 *
 * Overlays are portalled to document.body rather than rendered in place: an
 * ancestor with a filter or transform (the header's backdrop-blur, for one)
 * becomes the containing block for `position: fixed`, which would trap a
 * dialog inside the header's own height. `document` does not exist during the
 * server render, so portals wait for this.
 *
 * It lives outside the component modules so editing a component does not force
 * Fast Refresh into a full page reload.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
