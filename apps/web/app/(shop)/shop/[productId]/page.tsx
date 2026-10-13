"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ImageOff, Minus, Plus, ShoppingCart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchShopProduct, ShopApiError, type ShopProduct, type ShopStockStatus } from "@/lib/shop-api";
import { appendOrgParam, useShopOrgCode } from "@/lib/shop-org";
import { useCart } from "../_components/cart";

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
      <div className="w-full sm:w-48 h-48 shrink-0 rounded-lg bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
        <ImageOff size={28} className="text-ink-400" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      width={192}
      height={192}
      className="w-full sm:w-48 h-48 shrink-0 rounded-lg object-cover bg-ink-100 dark:bg-ink-800"
      onError={() => setFailed(true)}
    />
  );
}

export default function ShopProductDetailPage() {
  const t = useTranslations("shop");
  const router = useRouter();
  const params = useParams<{ productId: string }>();
  const productId = (params?.productId as string) || "";
  const orgCode = useShopOrgCode();
  const cart = useCart();

  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchShopProduct(orgCode, productId)
      .then((data) => {
        if (!active) return;
        setProduct(data);
      })
      .catch((e) => {
        if (!active) return;
        setProduct(null);
        if (e instanceof ShopApiError && e.status === 404) {
          setError(t("product_not_found"));
        } else {
          setError(e instanceof ShopApiError ? e.message : t("error"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orgCode, productId, t]);

  const inCart = cart.items.find((it) => it.product_id === productId);

  function handleAdd() {
    if (!product || product.stock_status === "out_of_stock") return;
    cart.addItem(product, qty);
    toast.success(t("added_to_cart"));
  }

  if (loading) {
    return <div className="py-20 text-center text-sm text-ink-400">{t("loading")}</div>;
  }

  if (error || !product) {
    return (
      <div className="py-16 text-center space-y-3">
        <AlertTriangle className="mx-auto text-ink-400" size={28} />
        <p className="text-sm text-ink-500 dark:text-ink-400">{error || t("product_not_found")}</p>
        <Button
          variant="secondary"
          icon={ArrowLeft}
          onClick={() => router.push(appendOrgParam("/shop", orgCode))}
        >
          {t("back_to_catalog")}
        </Button>
      </div>
    );
  }

  const outOfStock = product.stock_status === "out_of_stock";

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Button
        variant="ghost"
        size="sm"
        icon={ArrowLeft}
        onClick={() => router.push(appendOrgParam("/shop", orgCode))}
      >
        {t("back_to_catalog")}
      </Button>
      <Card padding="lg">
        <div className="flex flex-col sm:flex-row gap-5">
          <ProductImage url={product.image_url} name={product.name} />
          <div className="flex-1 min-w-0 space-y-2">
            {product.category_name && (
              <div className="text-xs text-ink-400 uppercase tracking-wide">{product.category_name}</div>
            )}
            <h1 className="text-lg font-semibold text-ink-900 dark:text-ink-50">{product.name}</h1>
            <div className="text-xl font-mono font-bold text-brand-600 dark:text-brand-400">
              {fmt(product.price)} {product.currency_code}
            </div>
            <Badge tone={STOCK_TONE[product.stock_status]}>{t(product.stock_status)}</Badge>

            <div className="pt-3 flex items-center gap-3">
              <div className="flex items-center border border-ink-200 dark:border-ink-800 rounded-md">
                <button
                  type="button"
                  className="p-2 text-ink-600 dark:text-ink-300 disabled:opacity-40"
                  disabled={outOfStock}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label={t("decrease_qty")}
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center font-mono text-sm">{qty}</span>
                <button
                  type="button"
                  className="p-2 text-ink-600 dark:text-ink-300 disabled:opacity-40"
                  disabled={outOfStock}
                  onClick={() => setQty((q) => q + 1)}
                  aria-label={t("increase_qty")}
                >
                  <Plus size={14} />
                </button>
              </div>
              <Button variant="primary" icon={ShoppingCart} disabled={outOfStock} onClick={handleAdd}>
                {outOfStock ? t("out_of_stock") : inCart ? t("add_more") : t("add_to_cart")}
              </Button>
            </div>
            {inCart && (
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {t("already_in_cart", { qty: inCart.quantity })}
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
