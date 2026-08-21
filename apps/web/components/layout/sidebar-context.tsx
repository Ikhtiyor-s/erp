"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Ctx = {
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  toggleMobile: () => void;
};

const SidebarCtx = createContext<Ctx>({
  mobileOpen: false,
  setMobileOpen: () => {},
  toggleMobile: () => {},
});

export const useSidebar = () => useContext(SidebarCtx);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = usePathname();

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [path]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <SidebarCtx.Provider value={{
      mobileOpen,
      setMobileOpen,
      toggleMobile: () => setMobileOpen((v) => !v),
    }}>
      {children}
    </SidebarCtx.Provider>
  );
}
