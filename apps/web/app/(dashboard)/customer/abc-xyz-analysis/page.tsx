"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Row = {
  id: string; name: string; revenue: string; sales_cnt: number;
  abc_class: "A" | "B" | "C"; revenue_pct: string;
};

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const badge = (cls: string) => ({
  A: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700",
  B: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
  C: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700",
}[cls] || "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200");

export default function AbcAnalysisPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Row[]>("/customer/abc-analysis")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const counts = { A: 0, B: 0, C: 0 };
  let totalRev = 0;
  rows.forEach((r) => { counts[r.abc_class]++; totalRev += Number(r.revenue); });

  const columns: Column<Row>[] = [
    { key: "name", header: t("ui__клиент_4af22f2d") },
    {
      key: "abc_class", header: t("ui__класс_4dfce627"), align: "center", width: "100px",
      render: (r) => (
        <span className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${badge(r.abc_class)}`}>
          {r.abc_class}
        </span>
      ),
    },
    { key: "revenue", header: t("ui__выручка_2935dccf"), align: "right", width: "160px",
      render: (r) => <span className="font-mono">{fmt(r.revenue)}</span> },
    { key: "revenue_pct", header: t("ui__от_общей_81ac97af"), align: "right", width: "120px",
      render: (r) => `${fmt(r.revenue_pct)}%` },
    { key: "sales_cnt", header: t("ui__продаж_87d84378"), align: "right", width: "100px" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__abc_анализ_клиентов_49d96dbc")} description={t("ui__a_80_выручки_b_15_c_5_94771861")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          label={t("ui__всего_e7ffde0e")}
          value={rows.length}
          color="text-slate-900 dark:text-slate-100"
        />
        <Card
          label={t("ui__класс_a_043f2c07")}
          value={counts.A}
          color="text-green-600 dark:text-green-400"
        />
        <Card
          label={t("ui__класс_b_0024228c")}
          value={counts.B}
          color="text-yellow-600 dark:text-yellow-400"
        />
        <Card
          label={t("ui__класс_c_c7eb9680")}
          value={counts.C}
          color="text-red-600 dark:text-red-400"
        />
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Общая выручка от клиентов:{" "}
        <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
          {fmt(totalRev)}
        </span>
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} />
    </div>
  );
}

function Card({
  label,
  value,
  color,
}: {
  label: string;
  value: any;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 font-mono ${color}`}>{value}</div>
    </div>
  );
}
