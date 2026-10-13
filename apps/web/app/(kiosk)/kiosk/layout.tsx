"use client";

// Self-checkout kiosk — standalone, physically-bookmarked customer-facing
// route group (SPEC-self-checkout.md). Deliberately independent of
// (dashboard)'s sidebar/topbar chrome and of (shop)'s checkout logic: no
// staff login, no org-switcher, no cart/business logic imported from
// elsewhere (DESIGN-self-checkout-auth.md — kiosk is its own, fourth auth
// model with a different risk profile).
//
// Fullscreen is the browser Fullscreen API only — best-effort, silently
// ignored if the browser blocks the auto-request (most require a user
// gesture). This is NOT an OS-level kiosk lock; nothing in this UI claims
// otherwise.

import { useCallback, useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { KioskSessionProvider } from "./_components/kiosk-session";
import { KioskCartProvider } from "./_components/kiosk-cart";

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  return (
    <KioskSessionProvider>
      <KioskCartProvider>
        <div className="min-h-screen bg-ink-50 dark:bg-ink-950 flex flex-col select-none">
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "To'liq ekrandan chiqish" : "To'liq ekran"}
            className="fixed top-2 right-2 z-50 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-ink-900/10 dark:bg-white/10 text-ink-500 dark:text-ink-400"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 py-6">{children}</main>
        </div>
      </KioskCartProvider>
    </KioskSessionProvider>
  );
}
