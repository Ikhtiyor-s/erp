"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Download, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";

// ─── Types ────────────────────────────────────────────────────────────────────

type ByProductRow = {
  product_id: string;
  product_name: string;
  sold_qty: number;
  revenue: string;
  cogs: string;
  profit: string;
  margin_pct: number;
};

type ByCategoryRow = {
  category_id: string | null;
  category_name: string;
  sold_qty: number;
  revenue: string;
  cogs: string;
  profit: string;
  margin_pct: number;
};

type ByWarehouseRow = {
  warehouse_id: number;
  warehouse_name: string;
  sold_qty: number;
  revenue: string;
  cogs: string;
  profit: string;
  margin_pct: number;
};

type CogsReport = {
  period: { from: string; to: string };
  total_revenue: string;
  total_cogs: string;
  gross_profit: string;
  gross_margin_pct: number;
  by_product: ByProductRow[];
  by_category: ByCategoryRow[];
  by_warehouse: ByWarehouseRow[];
};

type Warehouse = { id: number; name: string };
type Category = { id: number; name: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const fmtNum = (v: string | number) =>
  new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(Number(v || 0));

type Tab = "product" | "category" | "warehouse";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CogsReportPage() {
  const t = useTranslations("statistics.cogs");

  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [warehouseId, setWarehouseId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const [report, setReport] = useState<CogsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [tab, setTab] = useState<Tab>("product");
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get<Warehouse[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)).catch(() => {});
    api.get<Category[]>("/warehouse/category").then((r) => setCategories(r.data)).catch(() => {});
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        date_from: dateFrom,
        date_to: dateTo,
      };
      if (warehouseId) params.warehouse_id = warehouseId;
      if (categoryId) params.category_id = categoryId;
      const { data } = await api.get<CogsReport>("/statistics/cogs", { params });
      setReport(data);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t("error_load")));
    } finally {
      setLoading(false);
    }
  }

  async function doExport(format: "csv" | "xlsx") {
    setExporting(true);
    setExportOpen(false);
    try {
      const params: Record<string, string> = {
        date_from: dateFrom,
        date_to: dateTo,
        format,
      };
      if (warehouseId) params.warehouse_id = warehouseId;
      if (categoryId) params.category_id = categoryId;
      const { data } = await api.get("/statistics/reports/cogs", {
        params,
        responseType: "blob",
      });
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cogs-report-${dateFrom}-${dateTo}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(format.toUpperCase() + " " + t("export_success"));
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, t("export_error")));
    } finally {
      setExporting(false);
    }
  }

  const margin = report ? report.gross_margin_pct : 0;
  const profitNum = report ? Number(report.gross_profit) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="relative">
            <button
              onClick={() => setExportOpen((v) => !v)}
              disabled={exporting || !report}
              className="inline-flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <Download size={14} />
              {t("export_btn")}
              <ChevronDown size={12} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg z-10">
                <button
                  onClick={() => doExport("csv")}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 rounded-t-md"
                >
                  {t("export_csv")}
                </button>
                <button
                  onClick={() => doExport("xlsx")}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 rounded-b-md"
                >
                  {t("export_xlsx")}
                </button>
              </div>
            )}
          </div>
        }
      />

      {/* Filter panel */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("filter_date_from")}
          </label>
          <input
            type="date"
            className={input}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("filter_date_to")}
          </label>
          <input
            type="date"
            className={input}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("filter_warehouse")}
          </label>
          <select
            className={input}
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">{t("all_warehouses")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("filter_category")}
          </label>
          <select
            className={input}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">{t("all_categories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          {t("filter_apply")}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label={t("card_revenue")}
          value={report ? fmtNum(report.total_revenue) : "—"}
          loading={loading}
          colorClass="text-brand-700 dark:text-brand-400"
          borderClass="border-l-brand-500"
        />
        <SummaryCard
          label={t("card_cogs")}
          value={report ? fmtNum(report.total_cogs) : "—"}
          loading={loading}
          colorClass="text-amber-700 dark:text-amber-400"
          borderClass="border-l-amber-500"
        />
        <SummaryCard
          label={t("card_profit")}
          value={report ? fmtNum(report.gross_profit) : "—"}
          loading={loading}
          colorClass={
            profitNum >= 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-rose-700 dark:text-rose-400"
          }
          borderClass={profitNum >= 0 ? "border-l-emerald-500" : "border-l-rose-500"}
        />
        <SummaryCard
          label={t("card_margin")}
          value={report ? `${margin.toFixed(1)}%` : "—"}
          loading={loading}
          colorClass={
            margin >= 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-rose-700 dark:text-rose-400"
          }
          borderClass={margin >= 0 ? "border-l-emerald-500" : "border-l-rose-500"}
          badge={
            report
              ? {
                  label: `${margin.toFixed(1)}%`,
                  className:
                    margin >= 0
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
                }
              : undefined
          }
        />
      </div>

      {/* Chart — top 10 by profit */}
      {report && report.by_product.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5 h-72">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
            {t("chart_top10")}
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[...report.by_product]
                .sort((a, b) => Number(b.profit) - Number(a.profit))
                .slice(0, 10)}
              margin={{ top: 0, right: 0, left: 0, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="product_name"
                tick={{ fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtNum} />
              <Tooltip formatter={(v: unknown) => fmtNum(v as number)} />
              <Bar dataKey="profit" name={t("col_profit")} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-700 flex">
          {(["product", "category", "warehouse"] as Tab[]).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? "border-brand-600 text-brand-700 dark:text-brand-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {t(`tab_by_${key}`)}
            </button>
          ))}
        </div>

        <div className="p-0">
          {loading && (
            <div className="py-16 text-center text-slate-400">{t("loading")}</div>
          )}
          {!loading && error && (
            <div className="py-16 text-center text-rose-500">{error}</div>
          )}
          {!loading && !error && tab === "product" && (
            <CogsTable
              rows={report?.by_product ?? []}
              nameKey="product_name"
              t={t}
              noData={t("no_data")}
            />
          )}
          {!loading && !error && tab === "category" && (
            <CogsTable
              rows={report?.by_category ?? []}
              nameKey="category_name"
              t={t}
              noData={t("no_data")}
            />
          )}
          {!loading && !error && tab === "warehouse" && (
            <CogsTable
              rows={report?.by_warehouse ?? []}
              nameKey="warehouse_name"
              t={t}
              noData={t("no_data")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  loading,
  colorClass,
  borderClass,
  badge,
}: {
  label: string;
  value: string;
  loading: boolean;
  colorClass: string;
  borderClass: string;
  badge?: { label: string; className: string };
}) {
  return (
    <div
      className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-l-4 ${borderClass} rounded-lg shadow-sm p-4`}
    >
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
        {label}
      </div>
      {loading ? (
        <div className="h-7 w-24 bg-slate-100 dark:bg-slate-700 rounded animate-pulse mt-1" />
      ) : (
        <div className={`text-2xl font-bold font-mono ${colorClass}`}>{value}</div>
      )}
      {badge && !loading && (
        <span className={`mt-2 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
          {badge.label}
        </span>
      )}
    </div>
  );
}

// ─── COGS Table ───────────────────────────────────────────────────────────────

type AnyRow = Record<string, unknown>;

function CogsTable({
  rows,
  nameKey,
  t,
  noData,
}: {
  rows: AnyRow[];
  nameKey: string;
  t: ReturnType<typeof useTranslations<"statistics.cogs">>;
  noData: string;
}) {
  const sorted = [...rows].sort(
    (a, b) => Number(b.profit ?? 0) - Number(a.profit ?? 0)
  );

  if (sorted.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm">{noData}</div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                {t("col_name")}
              </th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-28">
                {t("col_qty")}
              </th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-36">
                {t("col_revenue")}
              </th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-36">
                {t("col_cogs")}
              </th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-36">
                {t("col_profit")}
              </th>
              <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-slate-300 w-24">
                {t("col_margin")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const profit = Number(row.profit ?? 0);
              const margin = Number(row.margin_pct ?? 0);
              return (
                <tr
                  key={i}
                  className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                    {String(row[nameKey] ?? "")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                    {fmtNum(Number(row.sold_qty ?? 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-brand-700 dark:text-brand-400">
                    {fmtNum(row.revenue as string)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-amber-700 dark:text-amber-400">
                    {fmtNum(row.cogs as string)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-semibold ${
                      profit >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-700 dark:text-rose-400"
                    }`}
                  >
                    {fmtNum(row.profit as string)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                        margin >= 0
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200"
                      }`}
                    >
                      {margin.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
        {sorted.map((row, i) => {
          const profit = Number(row.profit ?? 0);
          const margin = Number(row.margin_pct ?? 0);
          return (
            <li key={i} className="p-4 space-y-2">
              <div className="font-medium text-slate-800 dark:text-slate-100">
                {String(row[nameKey] ?? "")}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t("col_qty")}</span>
                <span className="font-mono text-right">{fmtNum(Number(row.sold_qty ?? 0))}</span>

                <span className="text-slate-500 dark:text-slate-400">{t("col_revenue")}</span>
                <span className="font-mono text-right text-brand-700 dark:text-brand-400">
                  {fmtNum(row.revenue as string)}
                </span>

                <span className="text-slate-500 dark:text-slate-400">{t("col_cogs")}</span>
                <span className="font-mono text-right text-amber-700 dark:text-amber-400">
                  {fmtNum(row.cogs as string)}
                </span>

                <span className="text-slate-500 dark:text-slate-400">{t("col_profit")}</span>
                <span
                  className={`font-mono text-right font-semibold ${
                    profit >= 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-rose-700 dark:text-rose-400"
                  }`}
                >
                  {fmtNum(row.profit as string)}
                </span>

                <span className="text-slate-500 dark:text-slate-400">{t("col_margin")}</span>
                <span className="text-right">
                  <span
                    className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                      margin >= 0
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200"
                    }`}
                  >
                    {margin.toFixed(1)}%
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
