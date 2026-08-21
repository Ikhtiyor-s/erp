"use client";

import { PeriodReport } from "@/components/reports/PeriodReport";
import type { Column } from "@/components/ui/data-table";
import { useTranslations } from "next-intl";

type Row = { id: string; name: string; sku?: string; qty: string; revenue: string; sales_cnt: number };
const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function Page() {
  const t = useTranslations("ui");
  const cols: Column<Row>[] = [
    { key: "sku", header: "SKU", width: "120px", render: (r) => r.sku || "—" },
    { key: "name", header: t("ui__товар_8b35db64") },
    { key: "sales_cnt", header: t("ui__продаж_87d84378"), align: "right", width: "100px" },
    { key: "qty", header: t("ui__количество_cb8bfd4d"), align: "right", width: "140px",
      render: (r) => <span className="font-mono">{fmt(r.qty)}</span> },
    { key: "revenue", header: t("ui__выручка_2935dccf"), align: "right", width: "160px",
      render: (r) => <span className="font-mono font-semibold text-green-700">{fmt(r.revenue)}</span> },
  ];

  return <PeriodReport<Row>
    title={t("ui__топ_товары_69d63d75")}
    description={t("ui__самые_продаваемые_товары_за_пе_e44b6c25")}
    endpoint="/statistics/products"
    columns={cols}
    exportName="products"
  />;
}
