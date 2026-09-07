"use client";

import { PeriodReport } from "@/components/reports/PeriodReport";
import type { Column } from "@/components/ui/data-table";
import { useTranslations } from "next-intl";

type Row = {
  id: string; name: string; sku?: string;
  stock_qty: string; sale_price?: string; last_sale?: string;
};
const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function Page() {
  const t = useTranslations("ui");
  const cols: Column<Row>[] = [
    { key: "sku", header: "SKU", width: "120px", render: (r) => r.sku || "—" },
    { key: "name", header: t("ui__товар_8b35db64") },
    { key: "stock_qty", header: t("ui__остаток_9a6054b1"), align: "right", width: "120px",
      render: (r) => <span className="font-mono">{fmt(r.stock_qty)}</span> },
    { key: "sale_price", header: t("ui__цена_682fa8db"), align: "right", width: "120px",
      render: (r) => r.sale_price ? <span className="font-mono">{fmt(r.sale_price)}</span> : "—" },
    { key: "last_sale", header: t("ui__последняя_продажа_b96efd6d"), width: "180px",
      render: (r) => r.last_sale
        ? <span className="text-warn-700 dark:text-warn-500">{new Date(r.last_sale).toLocaleDateString("ru-RU")}</span>
        : <span className="text-danger-700 dark:text-danger-500">{t("ui__не_продавался_7155b67d")}</span> },
  ];

  return <PeriodReport<Row>
    title={t("ui__непроданные_товары_11351a82")}
    description={t("ui__товары_без_продаж_за_последние_3bd9344a")}
    endpoint="/statistics/unsold-goods"
    columns={cols}
    exportName="unsold-goods"
    noDateRange
  />;
}
