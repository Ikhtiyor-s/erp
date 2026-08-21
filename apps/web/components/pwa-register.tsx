"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // Only register on the mobile shell — full desktop doesn't need to be PWA
    if (!window.location.pathname.startsWith("/m")) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("SW register failed", e));
  }, []);
  return null;
}
