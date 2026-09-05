"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type ReturnStatus = "draft" | "confirmed" | "cancelled";
type RefundMethod = "cash_refund" | "supplier_balance" | "replacement";

type SupplierReturn = {
  id: string;
  doc_number: string;
  supplier_id: string;
  supplier_name: string | null;
  warehouse_id: number;
  warehouse_name: string | null;
  status: ReturnStatus;
  refund_method: RefundMethod | null;
  total_amount: string;
  created_at: string;
};

type Supplier = { id: string; name: string };
type Warehouse = { id: number; name: string };

type PaginatedReturns = {
  items: SupplierReturn[];
  total: number;
  page: number;
  limit: number;
};

const STATUS_TABS: Array<{ key: "all" | ReturnStatus; labelKey: string }> = [
  { key: "all", labelKey: "status_all" },
  { key: "draft", labelKey: "status_draft" },
  { key: "confirmed", labelKey: "status_confirmed" },
  { key: "cancelled", labelKey: "status_cancelled" },
];

function statusBadge(status: ReturnStatus, t: (k: string) => string) {
  const colorMap: Record<ReturnStatus, string> = {
    draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  };
  const labelMap: Record<ReturnStatus, string> = {
    draft: "status_draft",
    confirmed: "status_confirmed",
    cancelled: "status_cancelled",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${colorMap[status]}`}>
      {t(labelMap[status])}
    </span>
  );
}

function refundBadge(method: RefundMethod | null, t: (k: string) => string) {
  if (!method) return <span className="text-ink-400">—</span>;
  const labelMap: Record<RefundMethod, string> = {
    cash_refund: "refund_cash",
    supplier_balance: "refund_balance",
    replacement: "refund_replacement",
  };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
      {t(labelMap[method])}
    </span>
  );
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ru-RU");
}

function fmtAmount(v: string) {
  return Number(v).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

export default function SupplierReturnsPage() {
  const t = useTranslations("supplier.returns");
  const router = useRouter();

  const [rows, setRows] = useState<SupplierReturn[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | ReturnStatus>("all");
  const [supplierFilter, setSupplierFilter] = useState("");
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
      if (supplierFilter) params.supplier_id = supplierFilter;
      if (warehouseFilter) params.warehouse_id = warehouseFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get<PaginatedReturns>("/warehouse/supplier-returns", { params });
      setRows(res.data.items);
    } catch (e) {
      setError(getErrorMessage(e, t("error_load")));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, supplierFilter, warehouseFilter, dateFrom, dateTo]);

  useEffect(() => {
    api.get<Supplier[]>("/supplier/suppliers").then((r) => setSuppliers(r.data)).catch(() => {});
    api.get<Warehouse[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        onCreate={() => router.push("/supplier/returns/new")}
        createLabel={t("create")}
      />

      {/* Status tabs */}
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

      {/* Filter panel */}
      <div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-600 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-100 transition-colors"
        >
          {t("filter_label")}
          {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {filtersOpen && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-lg border border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-900/30">
            <div className="space-y-1">
              <label className="text-[12px] text-ink-600 dark:text-ink-400 font-medium">{t("col_supplier")}</label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-brand-500"
              >
                <option value="">— {t("filter_all")} —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[12px] text-ink-600 dark:text-ink-400 font-medium">{t("col_warehouse")}</label>
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value ? Number(e.target.value) : "")}
                className="w-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-brand-500"
              >
                <option value="">— {t("filter_all")} —</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[12px] text-ink-600 dark:text-ink-400 font-medium">{t("filter_date_from")}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] text-ink-600 dark:text-ink-400 font-medium">{t("filter_date_to")}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Loading / Error / Empty */}
      {loading && (
        <div className="text-center py-12 text-ink-400 text-[13px]">{t("loading")}</div>
      )}
      {!loading && error && (
        <div className="text-center py-12 text-rose-600 text-[13px]">{error}</div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="text-center py-12 text-ink-400 text-[13px]">{t("empty")}</div>
      )}

      {/* Desktop table */}
      {!loading && !error && rows.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-ink-200 dark:border-ink-800">
            <table className="w-full text-[13px]">
              <thead className="bg-ink-50 dark:bg-ink-900/40">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-ink-600 dark:text-ink-400 whitespace-nowrap">{t("col_doc_number")}</th>
                  <th className="px-4 py-3 text-left font-medium text-ink-600 dark:text-ink-400">{t("col_supplier")}</th>
                  <th className="px-4 py-3 text-left font-medium text-ink-600 dark:text-ink-400">{t("col_warehouse")}</th>
                  <th className="px-4 py-3 text-left font-medium text-ink-600 dark:text-ink-400 whitespace-nowrap">{t("col_status")}</th>
                  <th className="px-4 py-3 text-left font-medium text-ink-600 dark:text-ink-400 whitespace-nowrap">{t("refund_method")}</th>
                  <th className="px-4 py-3 text-right font-medium text-ink-600 dark:text-ink-400 whitespace-nowrap">{t("col_amount")}</th>
                  <th className="px-4 py-3 text-left font-medium text-ink-600 dark:text-ink-400 whitespace-nowrap">{t("col_date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200/60 dark:divide-ink-800/60">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-ink-50/50 dark:hover:bg-ink-900/20 transition-colors cursor-pointer"
                    onClick={() => router.push(`/supplier/returns/${row.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-brand-600 dark:text-brand-400">
                      {row.doc_number || row.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-ink-900 dark:text-ink-100">{row.supplier_name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-900 dark:text-ink-100">{row.warehouse_name ?? "—"}</td>
                    <td className="px-4 py-3">{statusBadge(row.status, t)}</td>
                    <td className="px-4 py-3">{refundBadge(row.refund_method, t)}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-900 dark:text-ink-100">
                      {fmtAmount(row.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-ink-600 dark:text-ink-400 whitespace-nowrap">{fmtDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="md:hidden space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                onClick={() => router.push(`/supplier/returns/${row.id}`)}
                className="rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 space-y-2 cursor-pointer active:bg-ink-50 dark:active:bg-ink-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-brand-600 dark:text-brand-400 text-[13px]">
                    {row.doc_number || row.id.slice(0, 8)}
                  </span>
                  {statusBadge(row.status, t)}
                </div>
                <div className="text-[13px] text-ink-700 dark:text-ink-300">
                  {row.supplier_name ?? "—"} · {row.warehouse_name ?? "—"}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-ink-500">{fmtDate(row.created_at)}</span>
                  <span className="font-mono text-[13px] text-ink-900 dark:text-ink-100">
                    {fmtAmount(row.total_amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
