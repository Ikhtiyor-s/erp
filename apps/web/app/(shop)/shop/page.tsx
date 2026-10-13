"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, ImageOff, Minus, Plus, Search, Store } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { input } from "@/components/ui/modal";
import {
  fetchShopCategories,
  fetchShopProducts,
  ShopApiError,
  type ShopCategory,
  type ShopProduct,
  type ShopStockStatus,
} from "@/lib/shop-api";
import { appendOrgParam, useShopOrgCode } from "@/lib/shop-org";
import { useCart } from "./_components/cart";

const fmt = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 0 });

const STOCK_TONE: Record<ShopStockStatus, "success" | "warning" | "danger"> = {
  in_stock: "success",
  low: "warning",
  out_of_stock: "danger",
};

function ProductImage({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className="w-full h-32 rounded-md bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
        <ImageOff size={22} className="text-ink-400" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      width={240}
      height={128}
      className="w-full h-32 rounded-md object-cover bg-ink-100 dark:bg-ink-800"
      onError={() => setFailed(true)}
    />
  );
}

export default function ShopCatalogPage() {
  const t = useTranslations("shop");
  const orgCode = useShopOrgCode();
  const cart = useCart();

  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [configured, setConfigured] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchShopCategories(orgCode)
      .then((data) => {
        if (active) setCategories(data.items);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, [orgCode]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const timer = setTimeout(
      () => {
        fetchShopProducts(orgCode, { categoryId: selectedCategory, q: query || undefined, limit: 50 })
          .then((data) => {
            if (!active) return;
            setConfigured(data.configured);
            setProducts(data.items);
          })
          .catch((e) => {
            if (!active) return;
            setError(e instanceof ShopApiError ? e.message : t("error"));
            setProducts([]);
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      },
      query ? 300 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [orgCode, selectedCategory, query, t]);

  function handleAdd(p: ShopProduct) {
    if (p.stock_status === "out_of_stock") return;
    cart.addItem(p, 1);
    toast.success(t("added_to_cart"));
  }

  return (
    <div className="space-y-4 pb-10">
      <h1 className="text-[clamp(16px,2.2vw,18px)] font-semibold text-ink-900 dark:text-ink-50 tracking-tight">
        {t("catalog_title")}
      </h1>

      <Card padding="sm">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            placeholder={t("search_placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${input} pl-9`}
          />
        </div>
      </Card>

      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${
              selectedCategory === null
                ? "bg-brand-600 text-white"
                : "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-700"
            }`}
          >
            {t("category_all")}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${
                selectedCategory === c.id
                  ? "bg-brand-600 text-white"
                  : "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-ink-700"
              }`}
            >
              {c.name} ({c.product_count})
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-danger-50 dark:bg-danger-500/15 text-danger-700 dark:text-danger-500 text-sm">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-ink-400">{t("loading")}</div>
      ) : !configured ? (
        <div className="py-16 text-center space-y-2">
          <Store className="mx-auto text-ink-400" size={28} />
          <p className="text-sm text-ink-500 dark:text-ink-400">{t("shop_closed")}</p>
        </div>
      ) : products.length === 0 ? (
        <div className="py-16 text-center text-sm text-ink-400">{t("no_products_found")}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((p) => {
            const inCart = cart.items.find((it) => it.product_id === p.id);
            const outOfStock = p.stock_status === "out_of_stock";
            return (
              <Card key={p.id} padding="sm" className="flex flex-col gap-2">
                <Link href={appendOrgParam(`/shop/${p.id}`, orgCode)} className="space-y-2">
                  <ProductImage url={p.image_url} name={p.name} />
                  <div className="text-sm font-medium text-ink-900 dark:text-ink-100 line-clamp-2 min-h-[2.5em]">
                    {p.name}
                  </div>
                </Link>
                <div className="text-sm font-mono font-semibold text-brand-600 dark:text-brand-400">
                  {fmt(p.price)} {p.currency_code}
                </div>
                <Badge tone={STOCK_TONE[p.stock_status]}>{t(p.stock_status)}</Badge>
                {inCart ? (
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      icon={Minus}
                      onClick={() => cart.decrement(p.id)}
                      aria-label={t("decrease_qty")}
                    />
                    <span className="font-mono text-sm font-semibold">{inCart.quantity}</span>
                    <Button
                      type="button"
                      variant="primary"
                      size="xs"
                      icon={Plus}
                      disabled={outOfStock}
                      onClick={() => cart.increment(p.id)}
                      aria-label={t("increase_qty")}
                    />
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    fullWidth
                    disabled={outOfStock}
                    onClick={() => handleAdd(p)}
                  >
                    {outOfStock ? t("out_of_stock") : t("add_to_cart")}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {cart.totalQty > 0 && (
        <Link
          href={appendOrgParam("/shop/cart", orgCode)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-2 rounded-full shadow-lg px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors"
        >
          {t("cart")} · {cart.totalQty} · {fmt(cart.totalAmount)}
        </Link>
      )}
    </div>
  );
}
