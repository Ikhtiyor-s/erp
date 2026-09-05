"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Eye, Download, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";

type EntityType = "customer" | "supplier" | "employee" | "person";

const ENDPOINTS: Record<EntityType, string> = {
  customer: "/customer/balance",
  supplier: "/supplier/balance",
  employee: "/finance/employee-balance",
  person: "/finance/person-balance",
};

const PROFILE_ROUTES: Partial<Record<EntityType, (id: string) => string>> = {
  customer: (id) => `/customer/customers/${id}`,
  supplier: (id) => `/supplier/suppliers/${id}`,
  employee: (id) => `/hr/employees/${id}`,
};

type BalanceRow = {
  id: string;
  name?: string;
  balance: string;
  debit?: string;
  credit?: string;
  last_op?: string;
};

const fmt = (v: unknown) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const TABS: EntityType[] = ["customer", "supplier", "employee", "person"];

export default function BalancesPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6 text-ink-500">Loading...</div>}>
      <BalancesPage />
    </Suspense>
  );
}

function BalancesPage() {
  const t = useTranslations("finance.balances");
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = (searchParams.get("tab") as EntityType | null) ?? "customer";
  const [tab, setTab] = useState<EntityType>(
    TABS.includes(initialTab) ? initialTab : "customer"
  );

  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [minBalance, setMinBalance] = useState("");
  const [maxBalance, setMaxBalance] = useState("");

  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  function switchTab(next: EntityType) {
    setTab(next);
    setQ("");
    setRows([]);
    setError(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`?${params.toString()}`);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<BalanceRow[]>(ENDPOINTS[tab]);
      const normalized = data.map((r) => ({
        ...r,
        id: (r as Record<string, unknown>).customer_id as string
          ?? (r as Record<string, unknown>).supplier_id as string
          ?? r.id,
        name: r.name ?? r.id,
      }));
      setRows(normalized);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t("error_load")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tab]);

  const filtered = useMemo(() => {
    let r = rows;
    if (q) r = r.filter((x) => (x.name ?? x.id).toLowerCase().includes(q.toLowerCase()));
    if (minBalance !== "") r = r.filter((x) => Number(x.balance) >= Number(minBalance));
    if (maxBalance !== "") r = r.filter((x) => Number(x.balance) <= Number(maxBalance));
    return r;
  }, [rows, q, minBalance, maxBalance]);

  const totals = useMemo(() => {
    const total = filtered.reduce((s, r) => s + Number(r.balance || 0), 0);
    const negative = filtered.filter((r) => Number(r.balance) < 0);
    const positive = filtered.filter((r) => Number(r.balance) > 0);
    const sumNegative = negative.reduce((s, r) => s + Number(r.balance), 0);
    const sumPositive = positive.reduce((s, r) => s + Number(r.balance), 0);
    return { total, negative, positive, sumNegative, sumPositive };
  }, [filtered]);

  async function doExport(format: "csv" | "xlsx") {
    setExporting(true);
    setExportOpen(false);
    try {
      const { data } = await api.get(`${ENDPOINTS[tab]}/export`, {
        params: { format, date_from: dateFrom, date_to: dateTo },
        responseType: "blob",
      });
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tab}-balance-${dateFrom}-${dateTo}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(format.toUpperCase() + " exported");
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, t("error_export")));
    } finally {
      setExporting(false);
    }
  }

  const profileRoute = PROFILE_ROUTES[tab];

  const columns: Column<BalanceRow>[] = [
    {
      key: "name",
      header: t("col_entity"),
      render: (r) =>
        tab === "person" ? (
          <span className="font-mono text-xs text-ink-500">{r.id}</span>
        ) : (
          <span className="font-medium">{r.name ?? r.id}</span>
        ),
    },
    ...(tab === "person"
      ? [
          {
            key: "last_op" as keyof BalanceRow,
            header: t("col_last_op"),
            width: "180px",
            render: (r: BalanceRow) =>
              r.last_op ? new Date(r.last_op).toLocaleString("ru-RU") : "—",
          } as Column<BalanceRow>,
        ]
      : []),
    {
      key: "balance",
      header: t("col_balance"),
      align: "right",
      width: "200px",
      render: (r) => {
        const v = Number(r.balance);
        const positive = tab === "supplier" ? v < 0 : v > 0;
        const negative = tab === "supplier" ? v > 0 : v < 0;
        const cls = positive
          ? "text-emerald-700 dark:text-emerald-400"
          : negative
          ? "text-rose-700 dark:text-rose-400"
          : "text-ink-500 dark:text-ink-400";
        return <span className={`font-mono ${cls}`}>{fmt(v)}</span>;
      },
    },
    ...(profileRoute
      ? [
          {
            key: "id" as keyof BalanceRow,
            header: "",
            align: "center" as const,
            width: "52px",
            render: (r: BalanceRow) => (
              <button
                onClick={() => router.push(profileRoute(r.id))}
                className="text-brand-600 dark:text-brand-400 hover:text-brand-700 p-1"
                title={t("view_profile")}
                aria-label={`${r.name ?? r.id} profilini ko'rish`}
              >
                <Eye size={14} aria-hidden="true" />
              </button>
            ),
          } as Column<BalanceRow>,
        ]
      : []),
  ];

  const tabLabels: Record<EntityType, string> = {
    customer: t("tab_customer"),
    supplier: t("tab_supplier"),
    employee: t("tab_employee"),
    person: t("tab_person"),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="relative">
            <button
              onClick={() => setExportOpen((v) => !v)}
              disabled={exporting || loading || rows.length === 0}
              className="inline-flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <Download size={14} />
              {t("export_csv")}
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

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-700 flex overflow-x-auto">
          {TABS.map((key) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === key
                  ? "border-brand-600 text-brand-700 dark:text-brand-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {tabLabels[key]}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-b border-slate-200 dark:border-slate-700">
          <div className="sm:col-span-2 lg:col-span-2 relative">
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              {t("filter_search")}
            </label>
            <Search size={14} className="absolute left-2.5 top-[34px] text-slate-400" />
            <input
              className={`${input} pl-8`}
              placeholder={t("filter_search")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              {t("filter_min_balance")}
            </label>
            <input
              type="number"
              className={input}
              placeholder="0"
              value={minBalance}
              onChange={(e) => setMinBalance(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              {t("filter_max_balance")}
            </label>
            <input
              type="number"
              className={input}
              placeholder="—"
              value={maxBalance}
              onChange={(e) => setMaxBalance(e.target.value)}
            />
          </div>
        </div>

        {/* Summary cards */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-b border-slate-200 dark:border-slate-700">
          <SummaryCard label={t("card_total_count")} value={String(filtered.length)} color="text-ink-900 dark:text-ink-100" />
          <SummaryCard
            label={tab === "supplier" ? t("card_we_owe") : t("card_debtors")}
            value={`${totals.negative.length} — ${fmt(totals.sumNegative)}`}
            color="text-rose-700 dark:text-rose-400"
          />
          <SummaryCard
            label={tab === "supplier" ? t("card_they_owe") : t("card_overpayers")}
            value={`${totals.positive.length} + ${fmt(totals.sumPositive)}`}
            color="text-emerald-700 dark:text-emerald-400"
          />
          <SummaryCard
            label={t("card_saldo")}
            value={fmt(totals.total)}
            color={
              totals.total === 0
                ? "text-ink-500"
                : totals.total > 0
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400"
            }
          />
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-md bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-4 text-sm text-rose-700 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        rows={filtered}
        loading={loading}
        rowKey={(r) => r.id}
        emptyText={t("empty")}
      />

      {/* Mobile cards */}
      {!loading && !error && filtered.length > 0 && (
        <ul className="md:hidden divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
          {filtered.map((r) => {
            const v = Number(r.balance);
            const isPositive = tab === "supplier" ? v < 0 : v > 0;
            const isNegative = tab === "supplier" ? v > 0 : v < 0;
            const balClass = isPositive
              ? "text-emerald-700 dark:text-emerald-400"
              : isNegative
              ? "text-rose-700 dark:text-rose-400"
              : "text-ink-500";
            return (
              <li key={r.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-ink-800 dark:text-ink-100 truncate">
                    {tab === "person" ? (
                      <span className="font-mono text-xs text-ink-500">{r.id}</span>
                    ) : (
                      r.name ?? r.id
                    )}
                  </div>
                  {tab === "person" && r.last_op && (
                    <div className="text-xs text-ink-400 mt-0.5">
                      {new Date(r.last_op).toLocaleString("ru-RU")}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-mono font-semibold text-sm ${balClass}`}>
                    {fmt(v)}
                  </span>
                  {profileRoute && (
                    <button
                      onClick={() => router.push(profileRoute(r.id))}
                      className="text-brand-600 dark:text-brand-400 p-1"
                      aria-label={`${r.name ?? r.id} profilini ko'rish`}
                    >
                      <Eye size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-md p-3">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-base font-bold mt-1 ${color} font-mono`}>{value}</div>
    </div>
  );
}
