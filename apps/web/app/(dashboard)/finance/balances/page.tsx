"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Eye, Download, ChevronDown, Users, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatWidget } from "@/components/ui/stat-widget";

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
          ? "text-success-700 dark:text-success-500"
          : negative
          ? "text-danger-700 dark:text-danger-500"
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
              <Button
                type="button"
                variant="ghost"
                size="xs"
                icon={Eye}
                onClick={() => router.push(profileRoute(r.id))}
                title={t("view_profile")}
                aria-label={`${r.name ?? r.id} profilini ko'rish`}
                className="text-brand-600 hover:text-brand-700 dark:text-brand-400"
              />
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Download}
              iconRight={ChevronDown}
              onClick={() => setExportOpen((v) => !v)}
              disabled={exporting || loading || rows.length === 0}
            >
              {t("export_csv")}
            </Button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-md shadow-lg z-10 overflow-hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  fullWidth
                  className="justify-start rounded-none"
                  onClick={() => doExport("csv")}
                >
                  {t("export_csv")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  fullWidth
                  className="justify-start rounded-none"
                  onClick={() => doExport("xlsx")}
                >
                  {t("export_xlsx")}
                </Button>
              </div>
            )}
          </div>
        }
      />

      <Card padding="none">
        {/* Tabs */}
        <div className="border-b border-ink-200/60 dark:border-ink-800/60 flex overflow-x-auto">
          {TABS.map((key) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === key
                  ? "border-brand-600 text-brand-700 dark:text-brand-400"
                  : "border-transparent text-ink-500 hover:text-ink-700 dark:hover:text-ink-200"
              }`}
            >
              {tabLabels[key]}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-b border-ink-200/60 dark:border-ink-800/60">
          <div className="sm:col-span-2 lg:col-span-2 relative">
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
              {t("filter_search")}
            </label>
            <Search size={14} className="absolute left-2.5 top-[34px] text-ink-400" />
            <input
              className={`${input} pl-8`}
              placeholder={t("filter_search")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
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
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
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
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatWidget
            label={t("card_total_count")}
            value={filtered.length}
            icon={Users}
            color="ink"
            mono
          />
          <StatWidget
            label={tab === "supplier" ? t("card_we_owe") : t("card_debtors")}
            value={`${totals.negative.length} — ${fmt(totals.sumNegative)}`}
            icon={TrendingDown}
            color="danger"
            mono
          />
          <StatWidget
            label={tab === "supplier" ? t("card_they_owe") : t("card_overpayers")}
            value={`${totals.positive.length} + ${fmt(totals.sumPositive)}`}
            icon={TrendingUp}
            color="success"
            mono
          />
          <StatWidget
            label={t("card_saldo")}
            value={fmt(totals.total)}
            icon={Scale}
            color={totals.total === 0 ? "ink" : totals.total > 0 ? "success" : "danger"}
            mono
          />
        </div>
      </Card>

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-md bg-danger-50 dark:bg-danger-500/15 border border-danger-500/30 px-4 py-3 text-[13px] text-danger-700 dark:text-danger-500">
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
        <Card padding="none" className="md:hidden">
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {filtered.map((r) => {
              const v = Number(r.balance);
              const isPositive = tab === "supplier" ? v < 0 : v > 0;
              const isNegative = tab === "supplier" ? v > 0 : v < 0;
              const balClass = isPositive
                ? "text-success-700 dark:text-success-500"
                : isNegative
                ? "text-danger-700 dark:text-danger-500"
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        icon={Eye}
                        onClick={() => router.push(profileRoute(r.id))}
                        aria-label={`${r.name ?? r.id} profilini ko'rish`}
                        className="text-brand-600 dark:text-brand-400"
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
