"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, input } from "@/components/ui/modal";
import { DataTable, type Column } from "@/components/ui/data-table";
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

const STATUS_TONE: Record<ReturnStatus, "neutral" | "success" | "danger"> = {
  draft: "neutral",
  confirmed: "success",
  cancelled: "danger",
};

function statusBadge(status: ReturnStatus, t: (k: string) => string) {
  const labelMap: Record<ReturnStatus, string> = {
    draft: "status_draft",
    confirmed: "status_confirmed",
    cancelled: "status_cancelled",
  };
  return <Badge tone={STATUS_TONE[status]}>{t(labelMap[status])}</Badge>;
}

function refundBadge(method: RefundMethod | null, t: (k: string) => string) {
  if (!method) return <span className="text-ink-400">—</span>;
  const labelMap: Record<RefundMethod, string> = {
    cash_refund: "refund_cash",
    supplier_balance: "refund_balance",
    replacement: "refund_replacement",
  };
  return <Badge tone="warning">{t(labelMap[method])}</Badge>;
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

  const columns: Column<SupplierReturn>[] = [
    {
      key: "doc_number",
      header: t("col_doc_number"),
      render: (r) => (
        <span className="font-mono text-brand-600 dark:text-brand-400">
          {r.doc_number || r.id.slice(0, 8)}
        </span>
      ),
    },
    { key: "supplier_name", header: t("col_supplier"), render: (r) => r.supplier_name ?? "—" },
    { key: "warehouse_name", header: t("col_warehouse"), render: (r) => r.warehouse_name ?? "—" },
    { key: "status", header: t("col_status"), render: (r) => statusBadge(r.status, t) },
    { key: "refund_method", header: t("refund_method"), render: (r) => refundBadge(r.refund_method, t) },
    {
      key: "total_amount",
      header: t("col_amount"),
      align: "right",
      render: (r) => <span className="font-mono">{fmtAmount(r.total_amount)}</span>,
    },
    { key: "created_at", header: t("col_date"), render: (r) => fmtDate(r.created_at) },
  ];

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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconRight={filtersOpen ? ChevronUp : ChevronDown}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          {t("filter_label")}
        </Button>

        {filtersOpen && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-lg border border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-900/30">
            <Field label={t("col_supplier")}>
              <select
                className={input}
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
              >
                <option value="">— {t("filter_all")} —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label={t("col_warehouse")}>
              <select
                className={input}
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">— {t("filter_all")} —</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <Field label={t("filter_date_from")}>
              <input
                type="date"
                className={input}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </Field>
            <Field label={t("filter_date_to")}>
              <input
                type="date"
                className={input}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </Field>
          </div>
        )}
      </div>

      {/* Loading / Error / Empty */}
      {loading && (
        <div className="text-center py-12 text-ink-400 text-[13px]">{t("loading")}</div>
      )}
      {!loading && error && (
        <div className="rounded-md bg-danger-50 dark:bg-danger-500/15 border border-danger-500/30 px-4 py-3 text-[13px] text-danger-700 dark:text-danger-500">
          {error}
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="text-center py-12 text-ink-400 text-[13px]">{t("empty")}</div>
      )}

      {/* Desktop table */}
      {!loading && !error && rows.length > 0 && (
        <>
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              onRowClick={(row) => router.push(`/supplier/returns/${row.id}`)}
            />
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
