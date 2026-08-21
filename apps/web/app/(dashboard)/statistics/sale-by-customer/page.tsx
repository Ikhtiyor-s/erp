"use client";

import { PeriodReport } from "@/components/reports/PeriodReport";
import type { Column } from "@/components/ui/data-table";
import { useTranslations } from "next-intl";

type Row = {
  customer: string; sales_cnt: number;
  revenue: string; paid: string; debt: string;
};
const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function Page() {
  const t = useTranslations("ui");
  const cols: Column<Row>[] = [
    { key: "customer", header: t("ui__клиент_4af22f2d") },
    { key: "sales_cnt", header: t("ui__продаж_87d84378"), align: "right", width: "100px" },
    { key: "revenue", header: t("ui__выручка_2935dccf"), align: "right", width: "160px",
      render: (r) => <span className="font-mono">{fmt(r.revenue)}</span> },
    { key: "paid", header: t("ui__оплачено_6d8c0850"), align: "right", width: "150px",
      render: (r) => <span className="font-mono text-green-700">{fmt(r.paid)}</span> },
    { key: "debt", header: t("ui__долг_7e49b743"), align: "right", width: "150px",
      render: (r) => {
        const v = Number(r.debt);
        return <span className={`font-mono ${v > 0 ? "text-red-700" : "text-slate-400"}`}>{fmt(v)}</span>;
      } },
  ];

  return <PeriodReport<Row>
    title={t("ui__продажи_по_клиентам_72da73e7")}
    description={t("ui__выручка_оплаты_и_долги_клиенто_449b8669")}
    endpoint="/statistics/sale-by-customer"
    columns={cols}
    exportName="sale-by-customer"
    rowKey={(r) => r.customer}
  />;
}
