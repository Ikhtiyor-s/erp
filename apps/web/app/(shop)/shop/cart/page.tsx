"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImageOff, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { input } from "@/components/ui/modal";
import { appendOrgParam, useShopOrgCode } from "@/lib/shop-org";
import { useCart } from "../_components/cart";

const fmt = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 0 });

function CartImage({ url, name }: { url: string | null; name: string }) {
  if (!url) {
    return (
      <div className="w-14 h-14 shrink-0 rounded-md bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
        <ImageOff size={18} className="text-ink-400" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      width={56}
      height={56}
      className="w-14 h-14 shrink-0 rounded-md object-cover bg-ink-100 dark:bg-ink-800"
    />
  );
}

export default function ShopCartPage() {
  const t = useTranslations("shop");
  const router = useRouter();
  const orgCode = useShopOrgCode();
  const cart = useCart();

  if (cart.items.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <ShoppingBag className="mx-auto text-ink-400" size={28} />
        <p className="text-sm text-ink-400">{t("cart_empty")}</p>
        <Link href={appendOrgParam("/shop", orgCode)}>
          <Button variant="secondary">{t("back_to_catalog")}</Button>
        </Link>
      </div>
    );
  }

  const currency = cart.items[0]?.currency_code ?? "";

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-[clamp(16px,2.2vw,18px)] font-semibold text-ink-900 dark:text-ink-50 tracking-tight">
        {t("cart")} ({cart.items.length})
      </h1>

      <div className="space-y-2">
        {cart.items.map((it) => (
          <Card key={it.product_id} padding="sm">
            <div className="flex items-center gap-3">
              <CartImage url={it.image_url} name={it.name} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">
                  {it.name}
                </div>
                <div className="text-xs text-ink-500 dark:text-ink-400 font-mono">
                  {fmt(it.price)} {it.currency_code}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  icon={Minus}
                  onClick={() => cart.decrement(it.product_id)}
                  aria-label={t("decrease_qty")}
                />
                <span className="w-8 text-center text-sm font-mono">{it.quantity}</span>
                <Button
                  type="button"
                  variant="primary"
                  size="xs"
                  icon={Plus}
                  onClick={() => cart.increment(it.product_id)}
                  aria-label={t("increase_qty")}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                icon={Trash2}
                onClick={() => cart.remove(it.product_id)}
                aria-label={t("remove_item")}
              />
            </div>
          </Card>
        ))}
      </div>

      <Card padding="md">
        <label className="text-xs font-medium text-ink-600 dark:text-ink-300 block mb-1">
          {t("notes")}
        </label>
        <textarea
          value={cart.notes}
          onChange={(e) => cart.setNotes(e.target.value)}
          rows={2}
          className={`${input} resize-none`}
          placeholder={t("notes_placeholder")}
        />
      </Card>

      <Card padding="md">
        <div className="flex justify-between text-base font-semibold text-ink-900 dark:text-ink-100 mb-3">
          <span>{t("total")}</span>
          <span className="font-mono">
            {fmt(cart.totalAmount)} {currency}
          </span>
        </div>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => router.push(appendOrgParam("/shop/checkout", orgCode))}
        >
          {t("proceed_to_checkout")}
        </Button>
      </Card>
    </div>
  );
}
