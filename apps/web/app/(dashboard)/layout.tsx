"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/ui/command-palette";
import { SidebarProvider, useSidebar } from "@/components/layout/sidebar-context";

function DashboardInner({ children }: { children: React.ReactNode }) {
  const { mobileOpen, setMobileOpen } = useSidebar();
  return (
    <div className="flex min-h-screen bg-white dark:bg-ink-950">
      {/* Sidebar — hidden on mobile by default, slide-in drawer when open */}
      <div className={`
        fixed inset-y-0 left-0 z-30 transition-transform duration-200
        md:relative md:translate-x-0 md:z-auto
        ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <Sidebar />
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/40 z-20"
          aria-hidden="true"
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-3 md:p-5 text-ink-900 dark:text-ink-100 overflow-x-hidden">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem("access_token")) router.replace("/login");
  }, [router]);

  return (
    <SidebarProvider>
      <DashboardInner>{children}</DashboardInner>
    </SidebarProvider>
  );
}
