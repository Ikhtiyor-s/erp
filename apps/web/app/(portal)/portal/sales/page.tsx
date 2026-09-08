"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { getPortalToken } from "../../portal-auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

type Sale = {
  id: string;
  doc_number: string | null;
  date: string;
  total: number;
  paid: number;
  debt: number;
  status: string;
  warehouse: string;
};

type SaleDetailItem = {
  product_name: string;
  quantity: number;
  price: string | number;
  amount: string | number;
};

type SaleDetail = {
  head: {
    id: string;
    doc_number: string | null;
    sale_date: string;
    warehouse_name: string | null;
    total_amount: string | number;
    paid_amount: string | number;
  };
  items: SaleDetailItem[];
};

const fmt = (v: unknown) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

type SaleStatusTone = "success" | "warning" | "info" | "neutral" | "danger";

const SALE_STATUS_TONE: Record<string, SaleStatusTone> = {
  paid: "success",
  partial: "warning",
  confirmed: "info",
  draft: "neutral",
  cancelled: "danger",
};

const SALE_STATUS_KEY: Record<string, string> = {
  paid: "sale_status_paid",
  partial: "sale_status_partial",
  confirmed: "sale_status_confirmed",
  draft: "sale_status_draft",
  cancelled: "sale_status_cancelled",
};

function SaleStatusBadge({ status }: { status: string }) {
  const t = useTranslations("portal");
  const tone = SALE_STATUS_TONE[status] ?? "neutral";
  const label = SALE_STATUS_KEY[status] ? t(SALE_STATUS_KEY[status]) : status;
  return <Badge tone={tone}>{label}</Badge>;
}

export default function PortalSalesPage() {
  const t = useTranslations("portal");
  const tc = useTranslations("common");

  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const tok = getPortalToken();
    try {
      const r = await fetch(`${API_BASE}/customer-portal/me/sales?limit=100`, {
        headers: { Authorization: `Bearer ${tok}` },
        signal: AbortSignal.timeout(10000),
      });
      const data = await r.json();
      setSales(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id: string) {
    const tok = getPortalToken();
    const r = await fetch(`${API_BASE}/customer-portal/me/sales/${id}`, {
      headers: { Authorization: `Bearer ${tok}` },
      signal: AbortSignal.timeout(10000),
    });
    setSelected(await r.json());
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div className="py-20 text-center text-sm text-ink-400">{tc("loading")}</div>;
  }

  const columns: Column<Sale>[] = [
    {
      key: "doc_number",
      header: "№",
      render: (r) => (r.doc_number ? `№ ${r.doc_number}` : `№ ${r.id.slice(0, 8)}`),
    },
    {
      key: "date",
      header: tc("date"),
      render: (r) => new Date(r.date).toLocaleDateString("uz-Cyrl-UZ"),
    },
    {
      key: "warehouse",
      header: tc("warehouse"),
    },
    {
      key: "status",
      header: tc("status"),
      render: (r) => <SaleStatusBadge status={r.status} />,
    },
    {
      key: "total",
      header: tc("total"),
      align: "right",
      render: (r) => <span className="font-mono">{fmt(r.total)}</span>,
    },
    {
      key: "debt",
      header: t("stat_debt"),
      align: "right",
      render: (r) =>
        r.debt > 0 ? (
          <span className="font-mono text-danger-600 dark:text-danger-500">{fmt(r.debt)}</span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
  ];

  const hasDetail = !!(selected && selected.head);

  return (
    <div className="space-y-4">
      <h1 className="text-[clamp(16px,2.2vw,18px)] font-semibold text-ink-900 dark:text-ink-50 tracking-tight">
        {t("sales_title")} ({sales.length})
      </h1>

      {/* Desktop table */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          rows={sales}
          onRowClick={(r) => openDetail(r.id)}
          emptyText={t("no_sales")}
        />
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-2">
        {sales.length === 0 && (
          <li className="text-center text-sm text-ink-400 py-8">{t("no_sales")}</li>
        )}
        {sales.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => openDetail(s.id)} className="w-full text-left">
              <Card
                padding="sm"
                className="hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">
                      {s.doc_number ? `№ ${s.doc_number}` : `№ ${s.id.slice(0, 8)}`}
                    </div>
                    <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 truncate">
                      {new Date(s.date).toLocaleDateString("uz-Cyrl-UZ")} • {s.warehouse}
                    </div>
                    <div className="mt-1">
                      <SaleStatusBadge status={s.status} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono font-semibold text-ink-900 dark:text-ink-100">
                      {fmt(s.total)}
                    </div>
                    {s.debt > 0 && (
                      <div className="text-xs text-danger-600 dark:text-danger-500 font-mono mt-0.5">
                        {t("stat_debt")}: {fmt(s.debt)}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </button>
          </li>
        ))}
      </ul>

      {/* Detail modal */}
      <Modal
        open={selected != null}
        onClose={() => setSelected(null)}
        title={
          hasDetail
            ? `${t("sale_detail")} — № ${selected!.head.doc_number || selected!.head.id.slice(0, 8)}`
            : t("sale_detail")
        }
        size="md"
      >
        {!hasDetail ? (
          <p className="text-center text-sm text-ink-400 py-8">{t("no_sales_detail")}</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-ink-500 dark:text-ink-400">{tc("date")}</div>
                <div className="text-ink-900 dark:text-ink-100">
                  {new Date(selected!.head.sale_date).toLocaleString("uz-Cyrl-UZ")}
                </div>
              </div>
              <div>
                <div className="text-xs text-ink-500 dark:text-ink-400">{tc("warehouse")}</div>
                <div className="text-ink-900 dark:text-ink-100">
                  {selected!.head.warehouse_name || "—"}
                </div>
              </div>
            </div>
            <div className="border-t border-ink-100 dark:border-ink-800 pt-3">
              <div className="text-xs text-ink-500 dark:text-ink-400 mb-2 uppercase tracking-wide">
                Mahsulotlar
              </div>
              {selected!.items.map((it, i) => (
                <div key={i} className="flex items-start justify-between py-1.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="text-ink-900 dark:text-ink-100 truncate">{it.product_name}</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">
                      {it.quantity} x {fmt(it.price)}
                    </div>
                  </div>
                  <div className="font-mono text-ink-900 dark:text-ink-100 shrink-0">
                    {fmt(it.amount)}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-ink-100 dark:border-ink-800 pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-500 dark:text-ink-400">{tc("total")}:</span>
                <span className="font-mono font-semibold text-ink-900 dark:text-ink-100">
                  {fmt(selected!.head.total_amount)}
                </span>
              </div>
              <div className="flex justify-between text-success-700 dark:text-success-500">
                <span>{t("stat_paid")}:</span>
                <span className="font-mono">{fmt(selected!.head.paid_amount)}</span>
              </div>
              {Number(selected!.head.total_amount) - Number(selected!.head.paid_amount) > 0 && (
                <div className="flex justify-between text-danger-600 dark:text-danger-500 font-semibold">
                  <span>{t("stat_debt")}:</span>
                  <span className="font-mono">
                    {fmt(Number(selected!.head.total_amount) - Number(selected!.head.paid_amount))}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
