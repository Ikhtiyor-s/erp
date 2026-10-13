"use client";

// Scan screen (SC-5) — V1 is scan-only by design, no name-search product
// grid (SPEC: SHOULD/MAY only). Scanning reuses the existing camera-based
// BarcodeScanner component verbatim (components/barcode/scanner.tsx, the
// same one app/m/pos/page.tsx already uses) — no new scan/camera code here.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Minus, Plus, ScanLine, ShoppingCart, Store, Trash2, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BarcodeScanner } from "@/components/barcode/scanner";
import { KioskApiError, fetchKioskProductByBarcode } from "@/lib/kiosk-api";
import { useKioskSession } from "./_components/kiosk-session";
import { useKioskCart } from "./_components/kiosk-cart";
import { KioskMessageScreen } from "./_components/kiosk-message-screen";

const fmt = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 0 });

export default function KioskScanPage() {
  const t = useTranslations("kiosk_customer");
  const tScan = useTranslations("barcode.scan");
  const router = useRouter();
  const { state, reload } = useKioskSession();
  const cart = useKioskCart();
  const [scanOpen, setScanOpen] = useState(false);
  const [showCart, setShowCart] = useState(false);

  const onScan = useCallback(
    async (code: string) => {
      setScanOpen(false);
      try {
        const product = await fetchKioskProductByBarcode(code);
        cart.addProduct(product);
        toast.success(product.name);
      } catch (e) {
        if (e instanceof KioskApiError && e.status === 404) {
          toast.error(tScan("product_not_found"));
          return;
        }
        toast.error(e instanceof Error ? e.message : tScan("product_not_found"));
      }
    },
    [cart, tScan],
  );

  if (state.status === "loading") {
    return <div className="flex-1 flex items-center justify-center text-ink-400 text-sm">{t("loading")}</div>;
  }

  if (state.status === "device_inactive") {
    return (
      <KioskMessageScreen
        icon={AlertTriangle}
        tone="danger"
        title={t("device_inactive_title")}
        message={t("device_inactive_message")}
      />
    );
  }

  if (state.status === "error") {
    return (
      <KioskMessageScreen
        icon={WifiOff}
        tone="danger"
        title={t("session_error_title")}
        message={state.message}
        action={{ label: t("retry"), onClick: reload }}
      />
    );
  }

  const { session } = state;
  const maxCart = session.max_cart_amount;
  const overLimit = maxCart != null && cart.totalAmount > maxCart;
  const nearLimit = !overLimit && maxCart != null && cart.totalAmount >= maxCart * 0.9;
  const currency = cart.items[0]?.currency_code ?? "";

  return (
    <div className="flex-1 flex flex-col gap-4">
      <Card padding="md" className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white shrink-0">
          <Store size={18} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-ink-900 dark:text-ink-50 truncate">
            {session.organization_name || "—"}
          </div>
          <div className="text-xs text-ink-500 dark:text-ink-400 truncate">{session.cashbox_name}</div>
        </div>
      </Card>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
        <ScanLine size={72} className="text-brand-500" />
        <p className="text-base text-ink-500 dark:text-ink-400 max-w-sm">{t("scan_prompt")}</p>
        <Button
          size="lg"
          icon={ScanLine}
          onClick={() => setScanOpen(true)}
          className="min-h-[56px] px-8 text-base"
        >
          {t("scan_button")}
        </Button>
      </div>

      {cart.totalQty > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          aria-label={t("cart_title")}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-6 py-4 bg-brand-600 text-white rounded-full shadow-lg min-h-[56px]"
        >
          <ShoppingCart size={20} />
          <span className="font-semibold">
            {cart.totalQty} • {fmt(cart.totalAmount)} {currency}
          </span>
        </button>
      )}

      {showCart && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end" onClick={() => setShowCart(false)}>
          <div
            className="bg-white dark:bg-ink-900 w-full rounded-t-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-ink-900 px-4 py-3 border-b border-ink-200 dark:border-ink-800 flex items-center justify-between">
              <span className="font-semibold text-lg">
                {t("cart_title")} ({cart.items.length})
              </span>
              <button
                onClick={() => setShowCart(false)}
                aria-label={t("close")}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {cart.items.length === 0 ? (
                <p className="text-center text-ink-400 py-8">{t("cart_empty")}</p>
              ) : (
                cart.items.map((it) => (
                  <div key={it.product_id} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{it.name}</div>
                      <div className="text-xs text-ink-500 dark:text-ink-400 font-mono">
                        {it.quantity} x {fmt(it.price)} = {fmt(it.quantity * it.price)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => cart.changeQty(it.product_id, -1)}
                        aria-label={t("decrease_qty")}
                        className="w-11 h-11 rounded bg-ink-100 dark:bg-ink-800 flex items-center justify-center"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-mono font-semibold">{it.quantity}</span>
                      <button
                        onClick={() => cart.changeQty(it.product_id, 1)}
                        aria-label={t("increase_qty")}
                        className="w-11 h-11 rounded bg-brand-600 text-white flex items-center justify-center"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => cart.removeItem(it.product_id)}
                        aria-label={t("remove_item")}
                        className="w-11 h-11 rounded bg-ink-100 dark:bg-ink-800 text-danger-600 dark:text-danger-500 flex items-center justify-center"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-ink-900 p-4 border-t border-ink-200 dark:border-ink-800 space-y-3">
              <div className="flex justify-between text-lg font-semibold">
                <span>{t("total")}</span>
                <span className="font-mono">
                  {fmt(cart.totalAmount)} {currency}
                </span>
              </div>

              {overLimit && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-danger-50 dark:bg-danger-500/15 text-danger-700 dark:text-danger-500 text-sm">
                  <AlertTriangle size={16} className="shrink-0" />
                  {t("cart_limit_exceeded")}
                </div>
              )}
              {!overLimit && nearLimit && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-warn-50 dark:bg-warn-500/15 text-warn-700 dark:text-warn-500 text-sm">
                  <AlertTriangle size={16} className="shrink-0" />
                  {t("cart_limit_warning")}
                </div>
              )}

              <Button
                size="lg"
                variant="primary"
                fullWidth
                disabled={cart.items.length === 0 || overLimit}
                onClick={() => router.push("/kiosk/pay")}
                className="min-h-[56px] text-base"
              >
                {t("checkout_button")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {scanOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end">
          <div className="w-full bg-ink-950 rounded-t-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink-800">
              <span className="text-white font-medium text-sm">{tScan("open_scanner")}</span>
              <button
                onClick={() => setScanOpen(false)}
                aria-label={tScan("close_scanner")}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-300"
              >
                <X size={20} />
              </button>
            </div>
            <BarcodeScanner onScan={onScan} onError={() => setScanOpen(false)} className="w-full h-72" />
          </div>
        </div>
      )}
    </div>
  );
}
