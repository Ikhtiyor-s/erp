"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Row = { customer_id: string; name: string; balance: string };

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function CustomerBalancePage() {
  const t = useTranslations("ui");
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"" | "debtors" | "overpayers">("");

  async function load() {
    setLoading(true);
    try {
      setRows((await api.get<Row[]>("/customer/balance")).data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let r = rows;
    if (q) r = r.filter((x) => x.name.toLowerCase().includes(q.toLowerCase()));
    if (filter === "debtors") r = r.filter((x) => Number(x.balance) < 0);
    if (filter === "overpayers") r = r.filter((x) => Number(x.balance) > 0);
    return r;
  }, [rows, q, filter]);

  const totals = useMemo(() => {
    const total = filtered.reduce((s, r) => s + Number(r.balance || 0), 0);
    const debtors = filtered.filter((r) => Number(r.balance) < 0);
    const overpayers = filtered.filter((r) => Number(r.balance) > 0);
    const totalDebt = debtors.reduce((s, r) => s + Number(r.balance), 0);
    const totalOverpay = overpayers.reduce(
      (s, r) => s + Number(r.balance),
      0
    );
    return { total, debtors, overpayers, totalDebt, totalOverpay };
  }, [filtered]);

  const columns: Column<Row>[] = [
    { key: "name", header: t("ui__клиент_4af22f2d") },
    {
      key: "balance",
      header: t("ui__баланс_95dcad97"),
      align: "right",
      width: "200px",
      render: (r) => {
        const v = Number(r.balance);
        const cls =
          v < 0
            ? "text-red-600 dark:text-red-400"
            : v > 0
            ? "text-green-700 dark:text-green-400"
            : "text-slate-500 dark:text-slate-400";
        return <span className={`font-mono ${cls}`}>{fmt(v)}</span>;
      },
    },
    {
      key: "customer_id" as any,
      header: "",
      align: "center",
      width: "60px",
      render: (r) => (
        <button
          onClick={() => router.push(`/customer/customers/${r.customer_id}`)}
          className="text-brand-600 dark:text-brand-400 hover:text-brand-700"
          title={t("ui__профиль_a46c3723")}
          aria-label={`${r.name} profilini ko'rish`}
        >
          <Eye size={14} aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__баланс_клиентов_d0e50725")}
        description={t("ui__долги_и_переплаты_b7f67a48")}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_клиента_a3f1695e")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-slate-400"
          />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__поиск_b84a8f87")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__фильтр_2f884b41")}
          </label>
          <select
            className={input}
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "" | "debtors" | "overpayers")
            }
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            <option value="debtors">{t("ui__только_должники_0cc602ce")}</option>
            <option value="overpayers">{t("ui__только_переплатили_560cace3")}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          label={t("ui__клиентов_a8c15ba0")}
          value={String(filtered.length)}
          color="text-slate-900 dark:text-slate-100"
        />
        <Card
          label={t("ui__должники_cd54f490")}
          value={`${totals.debtors.length} — ${fmt(totals.totalDebt)}`}
          color="text-red-700 dark:text-red-400"
        />
        <Card
          label={t("ui__переплатили_0c5ce114")}
          value={`${totals.overpayers.length} + ${fmt(totals.totalOverpay)}`}
          color="text-green-700 dark:text-green-400"
        />
        <Card
          label={t("ui__сальдо_508d1e7a")}
          value={fmt(totals.total)}
          color={
            totals.total < 0
              ? "text-red-700 dark:text-red-400"
              : "text-green-700 dark:text-green-400"
          }
        />
      </div>

      <DataTable columns={columns} rows={filtered} loading={loading} />
    </div>
  );
}

function Card({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-xl font-bold mt-1 ${color} font-mono`}>{value}</div>
    </div>
  );
}
