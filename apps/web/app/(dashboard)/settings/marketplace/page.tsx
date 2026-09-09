"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SyncLogRow = {
  id: number;
  direction: string;
  status: "success" | "error" | "skipped";
  item_count: number;
  message: string | null;
  created_at: string;
};

type MpOrder = {
  id: string;
  external_order_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  total_amount: number;
  status: "new" | "reviewed" | "dismissed";
  received_at: string;
};

const LOG_TONE: Record<SyncLogRow["status"], "success" | "danger" | "neutral"> = {
  success: "success",
  error: "danger",
  skipped: "neutral",
};

const ORDER_TONE: Record<MpOrder["status"], "info" | "success" | "neutral"> = {
  new: "info",
  reviewed: "success",
  dismissed: "neutral",
};

const fmt = (v: number) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

function SyncSection() {
  const [log, setLog] = useState<SyncLogRow[]>([]);
  const [orders, setOrders] = useState<MpOrder[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [logRes, ordersRes] = await Promise.all([
        api.get<SyncLogRow[]>("/integrations/marketplace/sync-log"),
        api.get<MpOrder[]>("/integrations/marketplace/orders"),
      ]);
      setLog(logRes.data);
      setOrders(ordersRes.data);
    } catch (e) {
      toast.error(getErrorMessage(e, "Yuklashda xato"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function doSync() {
    setSyncing(true);
    try {
      const { data } = await api.post("/integrations/marketplace/sync");
      if (data.status === "success") toast.success(`Yuborildi: ${data.item_count} ta mahsulot`);
      else if (data.status === "skipped") toast.error(data.message);
      else toast.error(`Xato: ${data.message}`);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setSyncing(false);
    }
  }

  async function setOrderStatus(id: string, status: MpOrder["status"]) {
    try {
      await api.put(`/integrations/marketplace/orders/${id}/status`, { status });
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-600 dark:text-ink-400">
            Mahsulot va qoldiqlarni sozlangan URL'ga yuborish. Haqiqiy marketplace API hujjati hali yo'q —
            bu ulanish tayyor, lekin format kelishilgan API topilgach moslashtirilishi kerak bo'lishi mumkin.
          </p>
          <Button icon={RefreshCw} onClick={doSync} loading={syncing}>Sinxronlash</Button>
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader title="Sinxronizatsiya tarixi" />
        <CardBody padding="none">
          <table className="w-full text-[13px]">
            <thead className="bg-ink-50 dark:bg-ink-900">
              <tr className="text-ink-500 dark:text-ink-400 text-[11px] uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60">
                <th className="px-4 py-2 text-left font-medium">Sana</th>
                <th className="px-4 py-2 text-left font-medium">Holat</th>
                <th className="px-4 py-2 text-right font-medium">Mahsulot soni</th>
                <th className="px-4 py-2 text-left font-medium">Xabar</th>
              </tr>
            </thead>
            <tbody>
              {log.map((r) => (
                <tr key={r.id} className="border-b border-ink-100 dark:border-ink-800/40 last:border-0">
                  <td className="px-4 py-2 text-ink-500 dark:text-ink-400">{new Date(r.created_at).toLocaleString("ru-RU")}</td>
                  <td className="px-4 py-2"><Badge tone={LOG_TONE[r.status]} soft>{r.status}</Badge></td>
                  <td className="px-4 py-2 text-right font-mono">{r.item_count}</td>
                  <td className="px-4 py-2 text-ink-600 dark:text-ink-400">{r.message}</td>
                </tr>
              ))}
              {!loading && log.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-400">Hali sinxronizatsiya bo'lmagan</td></tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader title="Kelgan buyurtmalar" description="Marketplace'dan webhook orqali qabul qilingan xom buyurtmalar" />
        <CardBody padding="none">
          <table className="w-full text-[13px]">
            <thead className="bg-ink-50 dark:bg-ink-900">
              <tr className="text-ink-500 dark:text-ink-400 text-[11px] uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60">
                <th className="px-4 py-2 text-left font-medium">№</th>
                <th className="px-4 py-2 text-left font-medium">Mijoz</th>
                <th className="px-4 py-2 text-right font-medium">Summa</th>
                <th className="px-4 py-2 text-left font-medium">Holat</th>
                <th className="px-4 py-2 text-left font-medium">Sana</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-ink-100 dark:border-ink-800/40 last:border-0">
                  <td className="px-4 py-2 font-mono text-ink-500 dark:text-ink-400">{o.external_order_id || "—"}</td>
                  <td className="px-4 py-2 text-ink-800 dark:text-ink-200">
                    {o.customer_name || "—"}
                    {o.customer_phone && <div className="text-xs text-ink-400">{o.customer_phone}</div>}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{fmt(o.total_amount)}</td>
                  <td className="px-4 py-2"><Badge tone={ORDER_TONE[o.status]} soft>{o.status}</Badge></td>
                  <td className="px-4 py-2 text-ink-500 dark:text-ink-400">{new Date(o.received_at).toLocaleString("ru-RU")}</td>
                  <td className="px-4 py-2 text-right">
                    {o.status === "new" && (
                      <Button variant="ghost" size="xs" onClick={() => setOrderStatus(o.id, "reviewed")}>Ko'rib chiqildi</Button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && orders.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-400">Hali buyurtma kelmagan</td></tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

export default function Page() {
  const t = useTranslations("ui");
  return (
    <div className="space-y-6">
      <SettingsForm
        title={t("ui__bitoverse_маркетплейс_9d0052a5")}
        description={t("ui__интеграция_с_внешним_маркетпле_85107656")}
        settingsKey="marketplace"
        fields={[
          { key: "enabled", label: t("ui__интеграция_включена_4491d209"), type: "boolean" },
          { key: "api_url", label: "URL API" },
          { key: "api_key", label: t("ui__api_ключ_8e608430"), type: "password" },
          { key: "store_id", label: t("ui__id_магазина_24f6d0a5") },
          { key: "sync_products", label: t("ui__синхронизация_товаров_82487c20"), type: "boolean" },
          { key: "sync_stock", label: t("ui__синхронизация_остатков_93d7cbe0"), type: "boolean" },
          { key: "sync_orders", label: t("ui__импорт_заказов_83e85400"), type: "boolean" },
        ]}
      />
      <SyncSection />
    </div>
  );
}
