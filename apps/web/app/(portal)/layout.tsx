"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, ShoppingBag, Receipt, LogOut, User } from "lucide-react";
import {
  clearPortalAuth,
  getPortalCustomer,
  getPortalToken,
} from "./portal-auth";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);

  useEffect(() => {
    const tok = getPortalToken();
    const cust = getPortalCustomer();
    if (path !== "/portal/login" && !tok) {
      router.push("/portal/login");
    }
    setCustomer(cust);
  }, [path, router]);

  const isLogin = path === "/portal/login";

  function logout() {
    clearPortalAuth();
    router.push("/portal/login");
  }

  if (isLogin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white font-bold text-xs">
            A
          </div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            Aniq — Mijoz kabineti
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {customer && (
            <span className="hidden sm:flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <User size={14} />
              {customer.name}
            </span>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-red-600"
            title="Chiqish"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main content with side padding */}
      <main className="flex-1 px-4 py-4 max-w-3xl w-full mx-auto pb-20">{children}</main>

      {/* Bottom navigation — mobile-friendly */}
      <nav className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 sticky bottom-0 z-10">
        <div className="max-w-3xl mx-auto grid grid-cols-3 h-14">
          <NavTab href="/portal/dashboard" path={path} icon={<Home size={18} />} label="Asosiy" />
          <NavTab href="/portal/sales" path={path} icon={<Receipt size={18} />} label="Sotuvlar" />
          <NavTab href="/portal/products" path={path} icon={<ShoppingBag size={18} />} label="Buyurtma" />
        </div>
      </nav>
    </div>
  );
}

function NavTab({ href, path, icon, label }: any) {
  const active = path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-0.5 text-xs ${
        active
          ? "text-brand-600 dark:text-brand-400 font-medium"
          : "text-slate-500 dark:text-slate-400"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
