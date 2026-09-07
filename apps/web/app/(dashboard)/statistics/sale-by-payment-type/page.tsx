"use client";

import { PeriodReport } from "@/components/reports/PeriodReport";
import type { Column } from "@/components/ui/data-table";
import { useTranslations } from "next-intl";

type Row = { payment_type: string; payments_cnt: number; total: string };
const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function Page() {
  const t = useTranslations("ui");
  const cols: Column<Row>[] = [
    { key: "payment_type", header: t("ui__тип_оплаты_a6dd9595") },
    { key: "payments_cnt", header: t("ui__операций_f680ce84"), align: "right", width: "120px" },
    { key: "total", header: t("ui__сумма_cf59ebf9"), align: "right", width: "180px",
      render: (r) => <span className="font-mono font-semibold text-success-700 dark:text-success-500">{fmt(r.total)}</span> },
  ];

  return <PeriodReport<Row>
    title={t("ui__продажи_по_типу_оплаты_49e0f2cc")}
    description={t("ui__наличные_карта_перевод_и_т_д_72f171a5")}
    endpoint="/statistics/sale-by-payment-type"
    columns={cols}
    exportName="sale-by-payment-type"
    rowKey={(r) => r.payment_type}
  />;
}
