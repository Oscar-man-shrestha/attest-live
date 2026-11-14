"use client";

import { useEffect } from "react";
import { logInteraction } from "./campus-api";

/** Logs one view, then the time the page was actually visible when the reader leaves. */
export function useReadTracking(token: string | null, ideaId: string, enabled: boolean) {
  useEffect(() => {
    if (!token || !enabled) return;
    logInteraction(token, ideaId, "view");

    let visibleMs = 0;
    let since = document.visibilityState === "visible" ? Date.now() : 0;
    let sent = false;

    const pause = () => {
      if (since) visibleMs += Date.now() - since;
      since = 0;
    };
    const flush = () => {
      pause();
      if (sent || visibleMs < 3000) return;
      sent = true;
      logInteraction(token, ideaId, "dwell", Math.min(visibleMs, 600_000));
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") since = Date.now();
      else flush();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [token, ideaId, enabled]);
}
