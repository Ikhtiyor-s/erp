"use client";

import { PeriodReport } from "@/components/reports/PeriodReport";
import type { Column } from "@/components/ui/data-table";
import { useTranslations } from "next-intl";

type Row = {
  id: string; name: string; last_sale?: string;
  sales_cnt: number; revenue: string; days_inactive?: number;
};
const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

export default function Page() {
  const t = useTranslations("ui");
  const cols: Column<Row>[] = [
    { key: "name", header: t("ui__клиент_4af22f2d") },
    { key: "last_sale", header: t("ui__последняя_продажа_b96efd6d"), width: "180px",
      render: (r) => r.last_sale ? new Date(r.last_sale).toLocaleDateString("ru-RU") : "—" },
    { key: "days_inactive", header: t("ui__дней_без_покупок_0477d576"), align: "right", width: "150px",
      render: (r) => {
        if (r.days_inactive === null || r.days_inactive === undefined) return "—";
        const tone = r.days_inactive > 60
          ? "text-danger-700 dark:text-danger-500"
          : r.days_inactive > 30
          ? "text-warn-700 dark:text-warn-500"
          : "text-success-700 dark:text-success-500";
        return <span className={`font-mono ${tone}`}>
          {r.days_inactive}
        </span>;
      } },
    { key: "sales_cnt", header: t("ui__продаж_87d84378"), align: "right", width: "100px" },
    { key: "revenue", header: t("ui__выручка_2935dccf"), align: "right", width: "160px",
      render: (r) => <span className="font-mono">{fmt(r.revenue)}</span> },
  ];

  return <PeriodReport<Row>
    title={t("ui__активность_клиентов_d6be274d")}
    description={t("ui__когда_клиент_покупал_в_последн_0066068e")}
    endpoint="/statistics/customer-activity"
    columns={cols}
    exportName="customer-activity"
    noDateRange
  />;
}
