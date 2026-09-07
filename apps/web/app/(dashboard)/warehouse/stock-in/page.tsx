"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type StockInStatus = "draft" | "confirmed" | "cancelled";

type StockInRow = {
  id: string;
  doc_number: string | null;
  warehouse_id: number;
  warehouse_name: string | null;
  reason_id: number | null;
  reason_name: string | null;
  status: StockInStatus;
  total_qty: string;
  created_at: string;
};

type Warehouse = { id: number; name: string };

type PaginatedStockIns = {
  items: StockInRow[];
  total: number;
  page: number;
  limit: number;
};

const STATUS_TABS: Array<{ key: "all" | StockInStatus; labelKey: string }> = [
  { key: "all", labelKey: "status_all" },
  { key: "draft", labelKey: "status_draft" },
  { key: "confirmed", labelKey: "status_confirmed" },
  { key: "cancelled", labelKey: "status_cancelled" },
];

const STATUS_TONE: Record<StockInStatus, "neutral" | "success" | "danger"> = {
  draft: "neutral",
  confirmed: "success",
  cancelled: "danger",
};

function statusBadge(status: StockInStatus, t: (k: string) => string) {
  const labelMap: Record<StockInStatus, string> = {
    draft: "status_draft",
    confirmed: "status_confirmed",
    cancelled: "status_cancelled",
  };
  return <Badge tone={STATUS_TONE[status]}>{t(labelMap[status])}</Badge>;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ru-RU");
}

function fmtQty(v: string | null) {
  if (!v) return "—";
  return Number(v).toLocaleString("ru-RU", { maximumFractionDigits: 4 });
}

export default function StockInListPage() {
  const t = useTranslations("warehouse.stock_in");
  const router = useRouter();

  const [rows, setRows] = useState<StockInRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | StockInStatus>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<number | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { limit: 50, page: 1 };
      if (statusFilter !== "all") params.status = statusFilter;
      if (warehouseFilter) params.warehouse_id = warehouseFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get<PaginatedStockIns>("/warehouse/stock-ins", { params });
      setRows(res.data.items);
    } catch (e) {
      setError(getErrorMessage(e, t("error_load")));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, warehouseFilter, dateFrom, dateTo, t]);

  useEffect(() => {
    api.get<Warehouse[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<StockInRow>[] = [
    {
      key: "doc_number",
      header: t("col_doc_number"),
      width: "130px",
      render: (r) => <span className="font-mono text-[12px]">{r.doc_number || r.id.slice(0, 8)}</span>,
    },
    { key: "warehouse_name", header: t("col_warehouse"), render: (r) => r.warehouse_name || "—" },
    { key: "reason_name", header: t("col_reason"), render: (r) => r.reason_name || "—" },
    {
      key: "status",
      header: t("col_status"),
      width: "130px",
      render: (r) => statusBadge(r.status, t),
    },
    {
      key: "total_qty",
      header: t("col_qty"),
      align: "right",
      width: "120px",
      render: (r) => <span className="font-mono">{fmtQty(r.total_qty)}</span>,
    },
    {
      key: "created_at",
      header: t("col_date"),
      width: "110px",
      render: (r) => fmtDate(r.created_at),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        onCreate={() => router.push("/warehouse/stock-in/new")}
        createLabel={t("create")}
      />

      <div className="flex gap-1 flex-wrap border-b border-ink-200 dark:border-ink-800">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
              statusFilter === tab.key
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-ink-500 hover:text-ink-900 dark:hover:text-ink-100"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <Card padding="sm">
        <Button
          variant="ghost"
          size="sm"
          icon={filtersOpen ? ChevronUp : ChevronDown}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          {t("filter_date_from")} / {t("filter_date_to")}
        </Button>
        {filtersOpen && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] text-ink-500 dark:text-ink-400 block mb-1">{t("col_warehouse")}</label>
              <select
                className="w-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-brand-500"
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">— {t("status_all")} —</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-ink-500 dark:text-ink-400 block mb-1">{t("filter_date_from")}</label>
              <input
                type="date"
                className="w-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-brand-500"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] text-ink-500 dark:text-ink-400 block mb-1">{t("filter_date_to")}</label>
              <input
                type="date"
                className="w-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-brand-500"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setWarehouseFilter(""); setDateFrom(""); setDateTo(""); }}
              >
                Reset
              </Button>
            </div>
          </div>
        )}
      </Card>

      {error && (
        <div className="rounded-md bg-danger-50 dark:bg-danger-500/15 border border-danger-500/30 px-4 py-3 text-[13px] text-danger-700 dark:text-danger-500">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyText={t("empty")}
        onRowClick={(r) => router.push(`/warehouse/stock-in/${r.id}`)}
      />
    </div>
  );
}
