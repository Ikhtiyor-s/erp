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

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });
const BADGE_TONE = { A: "success", B: "warning", C: "danger" } as const;

export default function AbcStatsPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Row[]>("/customer/abc-analysis")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  const cnt = { A: 0, B: 0, C: 0 };
  rows.forEach((r) => cnt[r.abc_class]++);

  const cols: Column<Row>[] = [
    { key: "name", header: t("ui__клиент_4af22f2d") },
    { key: "abc_class", header: "ABC", align: "center", width: "100px",
      render: (r) => <Badge tone={BADGE_TONE[r.abc_class]}>{r.abc_class}</Badge> },
    { key: "revenue", header: t("ui__выручка_2935dccf"), align: "right", width: "160px",
      render: (r) => <span className="font-mono">{fmt(r.revenue)}</span> },
    { key: "revenue_pct", header: t("ui__общей_2fbf1f3a"), align: "right", width: "100px",
      render: (r) => `${Number(r.revenue_pct).toFixed(2)}%` },
    { key: "sales_cnt", header: t("ui__продаж_87d84378"), align: "right", width: "100px" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__abc_анализ_прибыли_a0f8f607")} description={t("ui__a_80_b_15_c_5_выручки_7db79b27")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <StatWidget label={t("ui__класс_a_043f2c07")} value={cnt.A} color="success" mono />
        <StatWidget label={t("ui__класс_b_0024228c")} value={cnt.B} color="warn" mono />
        <StatWidget label={t("ui__класс_c_c7eb9680")} value={cnt.C} color="danger" mono />
      </div>
      <DataTable columns={cols} rows={rows} loading={loading} />
    </div>
  );
}
