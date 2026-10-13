"use client";

// Device identification for the (kiosk) route group — the frontend-side half
// of the fourth auth model in DESIGN-self-checkout-auth.md. No login form
// anywhere in this file: a missing token is treated exactly like a revoked
// one (same "qurilma faol emas" state, no network call attempted), and a
// 401 from GET /kiosk/session halts here — no retry loop.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { KioskApiError, fetchKioskSession, readKioskDeviceToken, type KioskSession } from "@/lib/kiosk-api";

type KioskSessionState =
  | { status: "loading" }
  | { status: "device_inactive" }
  | { status: "error"; message: string }
  | { status: "ready"; session: KioskSession };

type Ctx = {
  state: KioskSessionState;
  reload: () => void;
};

const KioskSessionContext = createContext<Ctx | null>(null);

export function useKioskSession(): Ctx {
  const ctx = useContext(KioskSessionContext);
  if (!ctx) throw new Error("useKioskSession must be used within KioskSessionProvider");
  return ctx;
}

export function KioskSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<KioskSessionState>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    const token = readKioskDeviceToken();
    if (!token) {
      setState({ status: "device_inactive" });
      return;
    }
    fetchKioskSession()
      .then((session) => setState({ status: "ready", session }))
      .catch((e: unknown) => {
        if (e instanceof KioskApiError && e.status === 401) {
          setState({ status: "device_inactive" });
          return;
        }
        setState({ status: "error", message: e instanceof Error ? e.message : "Kutilmagan xato" });
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return <KioskSessionContext.Provider value={{ state, reload: load }}>{children}</KioskSessionContext.Provider>;
}
