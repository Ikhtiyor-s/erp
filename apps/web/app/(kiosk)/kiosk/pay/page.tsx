"use client";

// Checkout trigger + the blocking wait screen (SC-5). Per kiosk/router.py's
// documented polling contract (apps/api/app/modules/kiosk/router.py, the
// comment above GET /kiosk/order/{sale_id}): poll every ~2.5s for up to
// ~90s total; "paid"/"cancelled"/"payment_failed" are terminal; a timeout
// still "awaiting_payment" after 90s uses the SAME escalation message
// "payment_failed" does. Nothing here ever shows a success state without a
// live "paid" response — this is not an optimistic spinner.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { newIdempotencyKey } from "@/lib/idempotency";
import { KioskApiError, fetchKioskOrder, submitKioskCheckout } from "@/lib/kiosk-api";
import { useKioskCart } from "../_components/kiosk-cart";
import { KioskMessageScreen } from "../_components/kiosk-message-screen";

const fmt = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 0 });

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 90_000;
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

type Phase =
  | "guard_empty"
  | "submitting"
  | "checkout_error"
  | "device_inactive"
  | "cart_limit_exceeded"
  | "unavailable"
  | "waiting"
  | "paid"
  | "cancelled"
  | "escalation";

type OrderInfo = { saleId: string; orderNumber: string; totalAmount: number };

export default function KioskPayPage() {
  const t = useTranslations("kiosk_customer");
  const router = useRouter();
  const cart = useKioskCart();

  const [phase, setPhase] = useState<Phase>(cart.items.length === 0 ? "guard_empty" : "submitting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderInfo | null>(null);

  const checkoutFiredRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollDeadlineRef = useRef<number>(0);

  useEffect(() => {
    if (phase === "guard_empty") {
      router.replace("/kiosk");
    }
  }, [phase, router]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  function pollOrder(saleId: string, consecutiveErrors: number) {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (Date.now() >= pollDeadlineRef.current) {
      setPhase("escalation");
      return;
    }
    pollTimerRef.current = setTimeout(async () => {
      try {
        const status = await fetchKioskOrder(saleId);
        if (status.status === "paid") {
          setOrder((cur) => (cur ? { ...cur, totalAmount: status.total_amount } : cur));
          setPhase("paid");
          return;
        }
        if (status.status === "cancelled") {
          setPhase("cancelled");
          return;
        }
        if (status.status === "payment_failed") {
          setPhase("escalation");
          return;
        }
        pollOrder(saleId, 0);
      } catch (e) {
        if (e instanceof KioskApiError && e.status === 401) {
          setPhase("device_inactive");
          return;
        }
        if (consecutiveErrors + 1 >= MAX_CONSECUTIVE_POLL_ERRORS) {
          setPhase("escalation");
          return;
        }
        pollOrder(saleId, consecutiveErrors + 1);
      }
    }, POLL_INTERVAL_MS);
  }

  function runCheckout() {
    setPhase("submitting");
    setErrorMessage(null);
    const key = newIdempotencyKey();
    const items = cart.items.map((it) => ({ product_id: it.product_id, quantity: it.quantity }));
    submitKioskCheckout(items, key)
      .then((result) => {
        cart.clear();
        setOrder({ saleId: result.sale_id, orderNumber: result.order_number, totalAmount: result.total_amount });
        if (result.payment.mode === "unavailable") {
          setPhase("unavailable");
          return;
        }
        pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS;
        setPhase("waiting");
        pollOrder(result.sale_id, 0);
      })
      .catch((e: unknown) => {
        if (e instanceof KioskApiError && e.status === 401) {
          setPhase("device_inactive");
          return;
        }
        if (e instanceof KioskApiError && e.code === "cart_limit_exceeded") {
          setErrorMessage(e.message);
          setPhase("cart_limit_exceeded");
          return;
        }
        setErrorMessage(e instanceof Error ? e.message : null);
        setPhase("checkout_error");
      });
  }

  useEffect(() => {
    if (phase === "submitting" && !checkoutFiredRef.current && cart.items.length > 0) {
      checkoutFiredRef.current = true;
      runCheckout();
    }
    // Fires exactly once per page mount — intentionally not re-run on cart
    // changes (the cart is frozen for this checkout attempt once it starts).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startOver() {
    cart.clear();
    router.replace("/kiosk");
  }

  function retryCheckout() {
    checkoutFiredRef.current = true;
    runCheckout();
  }

  if (phase === "guard_empty") {
    return null;
  }

  if (phase === "submitting") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Loader2 size={48} className="animate-spin text-brand-500" />
        <p className="text-ink-500 dark:text-ink-400">{t("preparing_checkout")}</p>
      </div>
    );
  }

  if (phase === "device_inactive") {
    return (
      <KioskMessageScreen
        icon={AlertTriangle}
        tone="danger"
        title={t("device_inactive_title")}
        message={t("device_inactive_message")}
      />
    );
  }

  if (phase === "cart_limit_exceeded") {
    return (
      <KioskMessageScreen
        icon={AlertTriangle}
        tone="warning"
        title={t("cart_limit_title")}
        message={errorMessage || t("cart_limit_exceeded")}
        action={{ label: t("back_to_cart"), onClick: () => router.replace("/kiosk") }}
      />
    );
  }

  if (phase === "checkout_error") {
    return (
      <KioskMessageScreen
        icon={AlertTriangle}
        tone="danger"
        title={t("checkout_error_title")}
        message={errorMessage || t("checkout_error_message")}
        action={{ label: t("retry"), onClick: retryCheckout }}
      />
    );
  }

  if (phase === "unavailable") {
    return (
      <KioskMessageScreen
        icon={Clock}
        tone="warning"
        title={t("payment_unavailable_title")}
        message={t("payment_unavailable_message")}
        action={{ label: t("new_purchase"), onClick: startOver }}
      />
    );
  }

  if (phase === "waiting") {
    return (
      <div className="flex-1 min-h-[70vh] flex flex-col items-center justify-center text-center gap-4 px-6">
        <Loader2 size={64} className="animate-spin text-brand-500" />
        <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-50">{t("waiting_title")}</h1>
        <p className="text-base text-ink-500 dark:text-ink-400 max-w-md">{t("waiting_message")}</p>
        {order && (
          <p className="font-mono text-sm text-ink-400">
            № {order.orderNumber} · {fmt(order.totalAmount)}
          </p>
        )}
      </div>
    );
  }

  if (phase === "paid") {
    return (
      <KioskMessageScreen
        icon={CheckCircle2}
        tone="success"
        title={t("success_title")}
        message={order ? `№ ${order.orderNumber} · ${fmt(order.totalAmount)}` : t("success_message")}
        action={{ label: t("new_purchase"), onClick: startOver }}
      />
    );
  }

  if (phase === "cancelled") {
    return (
      <KioskMessageScreen
        icon={XCircle}
        tone="danger"
        title={t("cancelled_title")}
        message={t("cancelled_message")}
        action={{ label: t("new_purchase"), onClick: startOver }}
      />
    );
  }

  return (
    <KioskMessageScreen
      icon={AlertTriangle}
      tone="danger"
      title={t("escalation_title")}
      message={t("escalation_message")}
      action={{ label: t("new_purchase"), onClick: startOver }}
    />
  );
}
