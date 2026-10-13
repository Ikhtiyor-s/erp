"use client";

// Public B2C storefront layout — deliberately separate from (dashboard)/(portal):
// no JWT, no organization-switcher, no auth guard. Anyone can land on /shop/*
// without logging in.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShoppingCart, Store } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { CartProvider, useCart } from "./shop/_components/cart";

function ShopHeader() {
  const t = useTranslations("shop");
  const { locale, setLocale } = useLocale();
  const cart = useCart();
  const pathname = usePathname();
  const cartActive = pathname === "/shop/cart";

  return (
    <header className="bg-white dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800 px-4 h-14 flex items-center justify-between sticky top-0 z-10">
      <Link href="/shop" className="flex items-center gap-2 min-w-0">
        <div className="w-7 h-7 shrink-0 rounded-md bg-brand-600 flex items-center justify-center text-white">
          <Store size={16} />
        </div>
        <span className="font-semibold text-ink-900 dark:text-ink-100 truncate">
          {t("app_name")}
        </span>
      </Link>
      <div className="flex items-center gap-2 sm:gap-3">
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
        <Link
          href="/shop/cart"
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
            cartActive
              ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400"
              : "text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800"
          }`}
        >
          <ShoppingCart size={16} />
          <span className="hidden sm:inline">{t("cart")}</span>
          {cart.totalQty > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger-500 text-white text-[10px] font-bold flex items-center justify-center">
              {cart.totalQty}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-ink-50 dark:bg-ink-950 flex flex-col">
        <ShopHeader />
        <main className="flex-1 px-4 py-4 max-w-5xl w-full mx-auto pb-16">{children}</main>
      </div>
    </CartProvider>
  );
}
