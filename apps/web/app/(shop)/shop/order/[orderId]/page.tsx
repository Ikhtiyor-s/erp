"use client";

// The `[orderId]` dynamic segment carries `sale_id` (set by checkout/page.tsx's
// redirect) — the non-enumerable UUID lookup key GET /shop/order/{sale_id}
// expects, matching the checkout response's own "sale_id is the primary
// identifier" trust model. Lookup is tried first; if it fails for any reason
// (404, network, org not yet resolved), the page falls back to rendering
// whatever was carried via query params at the moment of the checkout
// redirect, and if neither is available, a generic "order received" message
// — never a hard error here.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, Clock, Store } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { appendOrgParam, useShopOrgCode } from "@/lib/shop-org";
import { fetchShopOrder, type ShopOrder } from "@/lib/shop-api";

const fmt = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 0 });

// Reads window.location.search directly instead of next/navigation's
// useSearchParams() — same reason as lib/shop-org.ts's useShopOrgCode: this
// route has no generateStaticParams, so Next still attempts a prerendered
// fallback shell at build time, and useSearchParams forces a Suspense
// boundary there that isn't worth the ceremony for a client-only read.
function useOrderQueryDetails() {
  const [details, setDetails] = useState<{ orderNumber: string; total: number; mode: string } | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const orderNumber = sp.get("order_number");
    const totalRaw = sp.get("total");
    const mode = sp.get("mode");
    const total = totalRaw ? Number(totalRaw) : NaN;
    if (orderNumber && mode && !Number.isNaN(total)) {
      setDetails({ orderNumber, total, mode });
    }
  }, []);

  return details;
}

export default function ShopOrderConfirmationPage() {
  const t = useTranslations("shop");
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const orgCode = useShopOrgCode();
  const queryDetails = useOrderQueryDetails();

  const saleId = params?.orderId ? decodeURIComponent(params.orderId as string) : null;

  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [lookupDone, setLookupDone] = useState(false);

  useEffect(() => {
    if (!saleId) {
      setLookupDone(true);
      return;
    }
    let active = true;
    setLookupDone(false);
    fetchShopOrder(orgCode, saleId)
      .then((data) => {
        if (active) setOrder(data);
      })
      .catch(() => {
        if (active) setOrder(null);
      })
      .finally(() => {
        if (active) setLookupDone(true);
      });
    return () => {
      active = false;
    };
  }, [orgCode, saleId]);

  const orderNumber = order?.order_number ?? queryDetails?.orderNumber ?? null;
  const total = order?.total_amount ?? queryDetails?.total ?? null;
  const mode = order?.payment.mode ?? queryDetails?.mode ?? null;
  const hasDetails = Boolean(orderNumber && total != null && mode);

  if (!lookupDone) {
    return <div className="py-20 text-center text-sm text-ink-400">{t("loading")}</div>;
  }

  return (
    <div className="max-w-md mx-auto py-10 space-y-4 text-center">
      <CheckCircle2 className="mx-auto text-success-500" size={48} />
      <h1 className="text-lg font-semibold text-ink-900 dark:text-ink-50">
        {t("order_received_title")}
      </h1>

      {hasDetails ? (
        <Card padding="lg" className="text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-ink-500 dark:text-ink-400">{t("order_number")}</span>
            <span className="font-mono font-semibold text-ink-900 dark:text-ink-100">
              № {orderNumber}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-500 dark:text-ink-400">{t("total")}</span>
            <span className="font-mono font-semibold text-ink-900 dark:text-ink-100">
              {fmt(total as number)}
            </span>
          </div>
          <div className="border-t border-ink-200 dark:border-ink-800 pt-3 flex items-start gap-2 text-sm text-ink-600 dark:text-ink-300">
            <Clock size={16} className="shrink-0 mt-0.5 text-warn-500" />
            <span>
              {mode === "manual" ? t("payment_pending_manual") : t("payment_pending_gateway")}
            </span>
          </div>
        </Card>
      ) : (
        <p className="text-sm text-ink-500 dark:text-ink-400">{t("order_received_no_details")}</p>
      )}

      <Button variant="secondary" icon={Store} onClick={() => router.push(appendOrgParam("/shop", orgCode))}>
        {t("back_to_catalog")}
      </Button>
    </div>
  );
}
