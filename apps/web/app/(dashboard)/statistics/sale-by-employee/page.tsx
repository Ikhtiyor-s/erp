"use client";

import { PeriodReport } from "@/components/reports/PeriodReport";
import type { Column } from "@/components/ui/data-table";
import { useTranslations } from "next-intl";

type Row = { employee: string; sales_cnt: number; revenue: string; avg_check: string };
const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function Page() {
  const t = useTranslations("ui");
  const cols: Column<Row>[] = [
    { key: "employee", header: t("ui__сотрудник_8f519d66") },
    { key: "sales_cnt", header: t("ui__продаж_87d84378"), align: "right", width: "100px" },
    { key: "avg_check", header: t("ui__средний_чек_fb07a082"), align: "right", width: "160px",
      render: (r) => <span className="font-mono">{fmt(r.avg_check)}</span> },
    { key: "revenue", header: t("ui__выручка_2935dccf"), align: "right", width: "180px",
      render: (r) => <span className="font-mono font-semibold text-green-700">{fmt(r.revenue)}</span> },
  ];

  return <PeriodReport<Row>
    title={t("ui__продажи_кассиров_93b984bd")}
    description={t("ui__эффективность_сотрудников_за_п_8e88f467")}
    endpoint="/statistics/sale-by-employee"
    columns={cols}
    exportName="sale-by-employee"
    rowKey={(r) => r.employee}
  />;
}
