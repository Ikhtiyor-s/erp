"use client";

import { PeriodReport } from "@/components/reports/PeriodReport";
import type { Column } from "@/components/ui/data-table";
import { useTranslations } from "next-intl";

type Row = {
  id: string; name: string; sku?: string;
  current_qty: string; min_qty: string; need_to_produce: string;
};
const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

export default function Page() {
  const t = useTranslations("ui");
  const cols: Column<Row>[] = [
    { key: "sku", header: "SKU", width: "120px", render: (r) => r.sku || "—" },
    { key: "name", header: t("ui__готовая_продукция_5d5498a6") },
    { key: "current_qty", header: t("ui__сейчас_2c2777ef"), align: "right", width: "120px",
      render: (r) => <span className="font-mono text-red-700">{fmt(r.current_qty)}</span> },
    { key: "min_qty", header: t("ui__минимум_96111129"), align: "right", width: "120px",
      render: (r) => <span className="font-mono">{fmt(r.min_qty)}</span> },
    { key: "need_to_produce", header: t("ui__нужно_произвести_37641e77"), align: "right", width: "180px",
      render: (r) => <span className="font-mono font-bold text-brand-700">{fmt(r.need_to_produce)}</span> },
  ];

  return <PeriodReport<Row>
    title={t("ui__рекомендуемое_производство_d53df091")}
    description={t("ui__продукты_с_bom_у_которых_остат_de88d984")}
    endpoint="/statistics/recommended-production"
    columns={cols}
    exportName="recommended-production"
    noDateRange
  />;
}
