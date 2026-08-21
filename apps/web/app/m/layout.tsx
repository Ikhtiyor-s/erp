"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, ShoppingCart, Box, Users, BarChart3, Menu, X,
  Settings, LogOut, Package, Wallet, UserCog, Truck, Boxes, Coffee, ListChecks,
} from "lucide-react";
import { PWARegister } from "@/components/pwa-register";
import { Toaster } from "sonner";

const BOTTOM = [
  { href: "/m", label: "Asosiy", icon: Home, exact: true },
  { href: "/m/pos", label: "POS", icon: ShoppingCart },
  { href: "/m/sales", label: "Sotuv", icon: BarChart3 },
  { href: "/m/customers", label: "Mijoz", icon: Users },
  { href: "/m/menu", label: "Menyu", icon: Menu },
];

const DRAWER = [
  { href: "/m", label: "Asosiy", icon: Home },
  { href: "/m/pos", label: "POS-kassa", icon: ShoppingCart },
  { href: "/m/pos/tickets", label: "Ochiq ticketlar", icon: Coffee },
  { href: "/m/sales", label: "Sotuvlar", icon: BarChart3 },
  { href: "/m/customers", label: "Mijozlar", icon: Users },
  { href: "/m/warehouse", label: "Sklad", icon: Box },
  { href: "/m/products", label: "Mahsulotlar", icon: Package },
  { href: "/m/finance", label: "Moliya", icon: Wallet },
  { href: "/m/cashbox", label: "Kassa smenasi", icon: Boxes },
  { href: "/m/hr", label: "Xodimlar", icon: UserCog },
  { href: "/m/courier", label: "Kuryerlar", icon: Truck },
  { href: "/m/visits", label: "Vizitlar", icon: ListChecks },
  { href: "/m/settings", label: "Sozlamalar", icon: Settings },
];

function isActive(path: string, href: string, exact?: boolean) {
  if (exact) return path === href;
  return path === href || path.startsWith(href + "/");
}

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) try { setUser(JSON.parse(u)); } catch {}
  }, []);

  // Don't show bottom nav on login or scanner/fullscreen pages
  const hideChrome = path === "/m/login" || path.startsWith("/m/scan");

  useEffect(() => { setDrawerOpen(false); }, [path]);

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    localStorage.removeItem("organization_id");
    router.push("/m/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <PWARegister />
      <Toaster position="top-center" richColors />

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="font-bold text-lg text-brand-600">Aniq ERP</div>
                {user && <div className="text-xs text-slate-500">{user.full_name || user.email}</div>}
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-slate-400 p-1">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {DRAWER.map((item) => {
                const Icon = item.icon;
                const active = isActive(path, item.href, item.href === "/m");
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                      active ? "bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 font-medium" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}>
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <button onClick={logout}
              className="m-4 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800">
              <LogOut size={16} /> Chiqish
            </button>
          </aside>
        </div>
      )}

      {/* Topbar (only on non-fullscreen pages) */}
      {!hideChrome && (
        <header className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-3 py-2.5 flex items-center justify-between">
          <button onClick={() => setDrawerOpen(true)} className="p-1 text-slate-700 dark:text-slate-300">
            <Menu size={22} />
          </button>
          <span className="font-semibold text-brand-600">Aniq</span>
          <div className="w-7" />
        </header>
      )}

      {/* Content */}
      <main className={`${hideChrome ? "" : "pb-20"} min-h-[calc(100vh-49px)]`}>
        {children}
      </main>

      {/* Bottom nav */}
      {!hideChrome && (
        <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 grid grid-cols-5">
          {BOTTOM.map((item) => {
            const Icon = item.icon;
            const active = isActive(path, item.href, item.exact);
            if (item.href === "/m/menu") {
              return (
                <button key={item.href} onClick={() => setDrawerOpen(true)}
                  className={`flex flex-col items-center justify-center py-2 text-[11px] ${
                    drawerOpen ? "text-brand-600" : "text-slate-500 dark:text-slate-400"
                  }`}>
                  <Icon size={20} />
                  <span className="mt-0.5">{item.label}</span>
                </button>
              );
            }
            return (
              <Link key={item.href} href={item.href}
                className={`flex flex-col items-center justify-center py-2 text-[11px] ${
                  active ? "text-brand-600" : "text-slate-500 dark:text-slate-400"
                }`}>
                <Icon size={20} />
                <span className="mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
