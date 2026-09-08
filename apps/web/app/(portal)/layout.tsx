"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, ShoppingBag, Receipt, LogOut, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "@/i18n/locale-provider";
import {
  clearPortalAuth,
  getPortalCustomer,
  getPortalToken,
} from "./portal-auth";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("portal");
  const { locale, setLocale } = useLocale();
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
      <div className="min-h-screen bg-ink-100 dark:bg-ink-950">
        {children}
      </div>
    );
  }

  const navItems = [
    { href: "/portal/dashboard", icon: Home, label: t("nav_dashboard") },
    { href: "/portal/sales", icon: Receipt, label: t("nav_sales") },
    { href: "/portal/products", icon: ShoppingBag, label: t("nav_products") },
  ];

  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-56 lg:flex-col lg:fixed lg:inset-y-0 bg-white dark:bg-ink-900 border-r border-ink-200 dark:border-ink-800">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-ink-200 dark:border-ink-800">
          <div className="w-7 h-7 shrink-0 rounded-md bg-brand-600 flex items-center justify-center text-white font-bold text-xs">
            A
          </div>
          <span className="font-semibold text-ink-900 dark:text-ink-100 truncate">
            {t("app_name")}
          </span>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => (
            <SidebarLink key={item.href} href={item.href} path={path} icon={item.icon} label={item.label} />
          ))}
        </nav>
        <div className="p-2 border-t border-ink-200 dark:border-ink-800">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-[13px] text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-danger-600 dark:hover:text-danger-500 transition-colors"
          >
            <LogOut size={16} />
            {t("logout")}
          </button>
        </div>
      </aside>

      <div className="lg:pl-56 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800 px-4 h-14 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 shrink-0 rounded-md bg-brand-600 flex items-center justify-center text-white font-bold text-xs">
              A
            </div>
            <span className="font-semibold text-ink-900 dark:text-ink-100 truncate">
              {t("app_name")}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm ml-auto">
            {customer && (
              <span className="hidden sm:flex items-center gap-1.5 text-ink-700 dark:text-ink-300">
                <User size={14} />
                {customer.name}
              </span>
            )}
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as any)}
              className="text-[12.5px] border border-ink-300 dark:border-ink-600 rounded-md px-2 py-1 bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200"
              aria-label="Language"
            >
              <option value="uz">UZ</option>
              <option value="ru">RU</option>
              <option value="en">EN</option>
              <option value="kaa">KAA</option>
            </select>
            <button
              onClick={logout}
              className="lg:hidden flex items-center gap-1 text-ink-500 dark:text-ink-400 hover:text-danger-600 dark:hover:text-danger-500"
              title={t("logout")}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 px-4 py-4 max-w-3xl lg:max-w-5xl w-full mx-auto pb-20 lg:pb-6">
          {children}
        </main>

        {/* Bottom navigation — mobile only */}
        <nav className="lg:hidden bg-white dark:bg-ink-900 border-t border-ink-200 dark:border-ink-800 sticky bottom-0 z-10">
          <div className="max-w-3xl mx-auto grid grid-cols-3 h-14">
            {navItems.map((item) => (
              <NavTab key={item.href} href={item.href} path={path} icon={<item.icon size={18} />} label={item.label} />
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

function SidebarLink({ href, path, icon: Icon, label }: any) {
  const active = path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
        active
          ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium"
          : "text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800"
      }`}
    >
      <Icon size={16} />
      <span>{label}</span>
    </Link>
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
          : "text-ink-500 dark:text-ink-400"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
