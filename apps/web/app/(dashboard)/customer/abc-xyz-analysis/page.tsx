"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatWidget } from "@/components/ui/stat-widget";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

type Row = {
  id: string; name: string; revenue: string; sales_cnt: number;
  abc_class: "A" | "B" | "C"; revenue_pct: string;
};

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const CLASS_TONE: Record<Row["abc_class"], "success" | "warning" | "danger"> = {
  A: "success",
  B: "warning",
  C: "danger",
};

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
      render: (r) => <Badge tone={CLASS_TONE[r.abc_class]}>{r.abc_class}</Badge>,
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
        <StatWidget label={t("ui__всего_e7ffde0e")} value={rows.length} color="ink" mono />
        <StatWidget label={t("ui__класс_a_043f2c07")} value={counts.A} color="success" mono />
        <StatWidget label={t("ui__класс_b_0024228c")} value={counts.B} color="warn" mono />
        <StatWidget label={t("ui__класс_c_c7eb9680")} value={counts.C} color="danger" mono />
      </div>
      <div className="text-sm text-ink-500 dark:text-ink-400">
        Общая выручка от клиентов:{" "}
        <span className="font-mono font-semibold text-ink-800 dark:text-ink-100">
          {fmt(totalRev)}
        </span>
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} />
    </div>
  );
}
