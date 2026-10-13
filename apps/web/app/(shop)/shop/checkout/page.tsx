"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Send } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { input } from "@/components/ui/modal";
import { formatUzPhone, isValidUzPhone, normalizeUzPhoneInput, toApiPhone } from "@/lib/phone";
import { ShopApiError, submitShopCheckout } from "@/lib/shop-api";
import { appendOrgParam, useShopOrgCode } from "@/lib/shop-org";
import { useCart } from "../_components/cart";

const fmt = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 0 });

export default function ShopCheckoutPage() {
  const t = useTranslations("shop");
  const router = useRouter();
  const orgCode = useShopOrgCode();
  const cart = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState(cart.notes);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({});

  if (cart.items.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm text-ink-400">{t("cart_empty")}</p>
        <Button variant="secondary" onClick={() => router.push(appendOrgParam("/shop", orgCode))}>
          {t("back_to_catalog")}
        </Button>
      </div>
    );
  }

  function validate(): boolean {
    const errs: { name?: string; phone?: string } = {};
    if (!name.trim()) errs.name = t("field_required");
    if (!isValidUzPhone(phone)) errs.phone = t("invalid_phone");
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    const idempotencyKey = crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
    try {
      const result = await submitShopCheckout(
        {
          org_code: orgCode,
          customer: { name: name.trim(), phone: toApiPhone(phone) },
          items: cart.items.map((it) => ({ product_id: it.product_id, quantity: it.quantity })),
          notes: notes.trim() || null,
        },
        idempotencyKey,
      );
      cart.clear();
      const params = new URLSearchParams({
        order_number: result.order_number,
        total: String(result.total_amount),
        mode: result.payment.mode,
        provider: result.payment.provider ?? "",
        org: orgCode,
      });
      router.push(`/shop/order/${encodeURIComponent(result.sale_id)}?${params.toString()}`);
    } catch (e) {
      setError(e instanceof ShopApiError ? e.message : t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  const currency = cart.items[0]?.currency_code ?? "";

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-[clamp(16px,2.2vw,18px)] font-semibold text-ink-900 dark:text-ink-50 tracking-tight">
        {t("checkout_title")}
      </h1>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-danger-50 dark:bg-danger-500/15 text-danger-700 dark:text-danger-500 text-sm">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <Card padding="none">
        <CardHeader title={`${t("cart")} (${cart.items.length})`} />
        <CardBody className="space-y-2">
          {cart.items.map((it) => (
            <div key={it.product_id} className="flex items-center justify-between text-sm gap-3">
              <span className="min-w-0 truncate text-ink-700 dark:text-ink-300">{it.name}</span>
              <span className="font-mono text-ink-900 dark:text-ink-100 shrink-0">
                {it.quantity} x {fmt(it.price)} = {fmt(it.quantity * it.price)}
              </span>
            </div>
          ))}
          <div className="border-t border-ink-200 dark:border-ink-800 pt-2 flex justify-between font-semibold text-ink-900 dark:text-ink-100">
            <span>{t("total")}</span>
            <span className="font-mono">
              {fmt(cart.totalAmount)} {currency}
            </span>
          </div>
        </CardBody>
      </Card>

      <Card padding="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-ink-600 dark:text-ink-300 block mb-1">
              {t("customer_name")}
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={input}
              placeholder={t("customer_name_placeholder")}
            />
            {fieldErrors.name && <p className="text-xs text-danger-600 mt-1">{fieldErrors.name}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600 dark:text-ink-300 block mb-1">
              {t("phone")}
            </label>
            <div className="flex items-stretch border border-ink-300 dark:border-ink-600 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-brand-500">
              <span className="flex items-center px-3 bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300 text-sm font-medium">
                +998
              </span>
              <input
                required
                type="tel"
                inputMode="numeric"
                placeholder="90 123 45 67"
                autoComplete="tel"
                value={formatUzPhone(phone)}
                onChange={(e) => setPhone(normalizeUzPhoneInput(e.target.value))}
                className="flex-1 min-w-0 border-0 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 px-3 py-2 focus:outline-none"
              />
            </div>
            {fieldErrors.phone && <p className="text-xs text-danger-600 mt-1">{fieldErrors.phone}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-ink-600 dark:text-ink-300 block mb-1">
              {t("notes")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${input} resize-none`}
              placeholder={t("notes_placeholder")}
            />
          </div>
          <Button type="submit" variant="primary" size="lg" icon={Send} fullWidth loading={submitting}>
            {t("submit_order")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
