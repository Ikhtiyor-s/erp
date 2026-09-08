"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Wallet, ShoppingCart, AlertCircle, Receipt, AlertTriangle } from "lucide-react";
import { StatWidget } from "@/components/ui/stat-widget";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPortalToken } from "../../portal-auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

type Balance = {
  total_purchases: number;
  total_paid: number;
  debt: number;
  sale_count: number;
};

type Sale = {
  id: string;
  doc_number: string | null;
  date: string;
  total: number;
  paid: number;
  debt: number;
  status: string;
  warehouse: string;
  currency: string;
};

const fmt = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 0 });

const STATUS_MAP: Record<string, { tone: "success" | "warning" | "danger" | "info" | "neutral"; label: string }> = {
  paid: { tone: "success", label: "To'langan" },
  partial: { tone: "warning", label: "Qisman to'langan" },
  confirmed: { tone: "info", label: "Tasdiqlangan" },
  draft: { tone: "neutral", label: "Qoralama" },
  cancelled: { tone: "danger", label: "Bekor qilingan" },
};

export default function PortalDashboard() {
  const t = useTranslations("portal");
  const tc = useTranslations("common");
  const [bal, setBal] = useState<Balance | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    const tok = getPortalToken();
    if (!tok) return;
    try {
      const [b, s] = await Promise.all([
        fetch(`${API_BASE}/customer-portal/me/balance`, {
          headers: { Authorization: `Bearer ${tok}` },
          signal: AbortSignal.timeout(10000),
        }).then((r) => r.json()),
        fetch(`${API_BASE}/customer-portal/me/sales?limit=5`, {
          headers: { Authorization: `Bearer ${tok}` },
          signal: AbortSignal.timeout(10000),
        }).then((r) => r.json()),
      ]);
      setBal(b);
      setSales(Array.isArray(s) ? s : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">
        {t("dashboard_title")}
      </h1>

      {error && !loading && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-danger-50 dark:bg-danger-500/15 text-danger-700 dark:text-danger-500 text-sm">
          <AlertTriangle size={16} className="shrink-0" />
          {tc("error")}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatWidget
          label={t("stat_total_purchases")}
          value={bal ? fmt(bal.total_purchases) : "0"}
          icon={ShoppingCart}
          color="brand"
          mono
          loading={loading}
        />
        <StatWidget
          label={t("stat_paid")}
          value={bal ? fmt(bal.total_paid) : "0"}
          icon={Wallet}
          color="success"
          mono
          loading={loading}
        />
        <StatWidget
          label={t("stat_debt")}
          value={bal ? fmt(bal.debt) : "0"}
          icon={AlertCircle}
          color={bal && bal.debt > 0 ? "danger" : "ink"}
          mono
          loading={loading}
        />
        <StatWidget
          label={t("stat_sale_count")}
          value={bal?.sale_count ?? 0}
          icon={Receipt}
          color="info"
          loading={loading}
        />
      </div>

      <Card padding="none">
        <CardHeader
          title={t("recent_sales")}
          actions={
            <a href="/portal/sales" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
              →
            </a>
          }
        />
        {loading ? (
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-4 py-3">
                <div className="h-4 w-32 rounded bg-ink-100 dark:bg-ink-800 animate-pulse" />
              </div>
            ))}
          </div>
        ) : sales.length === 0 ? (
          <div className="px-4 py-10 text-center text-ink-400">{t("no_sales")}</div>
        ) : (
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            {sales.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-900 dark:text-ink-100">
                    {s.doc_number ? `№ ${s.doc_number}` : `№ ${s.id.slice(0, 8)}`}
                  </div>
                  <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                    {new Date(s.date).toLocaleString("uz-Cyrl-UZ", {
                      year: "numeric", month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })} • {s.warehouse}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-mono font-semibold text-ink-900 dark:text-ink-100">
                    {fmt(s.total)}
                  </div>
                  <Badge tone={STATUS_MAP[s.status]?.tone ?? "neutral"} className="mt-1">
                    {s.status === "partial"
                      ? `${STATUS_MAP.partial.label}: ${fmt(s.debt)}`
                      : STATUS_MAP[s.status]?.label ?? s.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
