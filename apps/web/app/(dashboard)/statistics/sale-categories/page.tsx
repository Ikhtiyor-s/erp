"use client";

import { PeriodReport } from "@/components/reports/PeriodReport";
import type { Column } from "@/components/ui/data-table";
import { useTranslations } from "next-intl";

type Row = { category: string; sales_cnt: number; qty: string; revenue: string };
const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function Page() {
  const t = useTranslations("ui");
  const cols: Column<Row>[] = [
    { key: "category", header: t("ui__категория_c95a1e2d") },
    { key: "sales_cnt", header: t("ui__продаж_87d84378"), align: "right", width: "100px" },
    { key: "qty", header: t("ui__количество_cb8bfd4d"), align: "right", width: "140px",
      render: (r) => <span className="font-mono">{fmt(r.qty)}</span> },
    { key: "revenue", header: t("ui__выручка_2935dccf"), align: "right", width: "160px",
      render: (r) => <span className="font-mono font-semibold text-success-700 dark:text-success-500">{fmt(r.revenue)}</span> },
  ];

  return <PeriodReport<Row>
    title={t("ui__продажи_по_категориям_884aae48")}
    description={t("ui__распределение_выручки_по_катег_9651d9b2")}
    endpoint="/statistics/sale-by-category"
    columns={cols}
    exportName="sale-by-category"
    rowKey={(r) => r.category}
  />;
}
