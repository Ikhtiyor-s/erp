"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Row = { supplier_id: string; name: string; balance: string };

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function SupplierBalancePage() {
  const t = useTranslations("ui");
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"" | "we_owe" | "they_owe">("");

  async function load() {
    setLoading(true);
    try {
      setRows((await api.get<Row[]>("/supplier/balance")).data);
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
    if (filter === "we_owe") r = r.filter((x) => Number(x.balance) > 0);
    if (filter === "they_owe") r = r.filter((x) => Number(x.balance) < 0);
    return r;
  }, [rows, q, filter]);

  const totals = useMemo(() => {
    const total = filtered.reduce((s, r) => s + Number(r.balance || 0), 0);
    const weOwe = filtered.filter((r) => Number(r.balance) > 0);
    const theyOwe = filtered.filter((r) => Number(r.balance) < 0);
    const sumWeOwe = weOwe.reduce((s, r) => s + Number(r.balance), 0);
    const sumTheyOwe = theyOwe.reduce((s, r) => s + Number(r.balance), 0);
    return { total, weOwe, theyOwe, sumWeOwe, sumTheyOwe };
  }, [filtered]);

  const columns: Column<Row>[] = [
    { key: "name", header: t("ui__поставщик_b8fbf748") },
    {
      key: "balance",
      header: t("ui__баланс_95dcad97"),
      align: "right",
      width: "200px",
      render: (r) => {
        const v = Number(r.balance);
        const cls =
          v > 0
            ? "text-red-600 dark:text-red-400"
            : v < 0
            ? "text-green-700 dark:text-green-400"
            : "text-slate-500 dark:text-slate-400";
        return <span className={`font-mono ${cls}`}>{fmt(v)}</span>;
      },
    },
    {
      key: "supplier_id" as any,
      header: "",
      align: "center",
      width: "60px",
      render: (r) => (
        <button
          onClick={() => router.push(`/supplier/suppliers/${r.supplier_id}`)}
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
        title={t("ui__баланс_поставщиков_d991a4a2")}
        description={t("ui__долги_перед_поставщиками_и_пер_8d83d397")}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_поставщика_b08b4dcc")}
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
              setFilter(e.target.value as "" | "we_owe" | "they_owe")
            }
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            <option value="we_owe">{t("ui__мы_должны_9e4a36bf")}</option>
            <option value="they_owe">{t("ui__нам_должны_4c105106")}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          label={t("ui__поставщиков_eb718fd5")}
          value={String(filtered.length)}
          color="text-slate-900 dark:text-slate-100"
        />
        <Card
          label={t("ui__мы_должны_9e4a36bf")}
          value={`${totals.weOwe.length} — ${fmt(totals.sumWeOwe)}`}
          color="text-red-700 dark:text-red-400"
        />
        <Card
          label={t("ui__нам_должны_4c105106")}
          value={`${totals.theyOwe.length} + ${fmt(
            Math.abs(totals.sumTheyOwe)
          )}`}
          color="text-green-700 dark:text-green-400"
        />
        <Card
          label={t("ui__сальдо_508d1e7a")}
          value={fmt(totals.total)}
          color={
            totals.total > 0
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
