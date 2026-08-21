"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Row = {
  sale_id: string; doc_number?: string; sale_date: string;
  product_name: string; plan_price: string; fact_price: string;
  deviation: string; quantity: string; impact: string;
};

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };

export default function PriceDeviationPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(monthAgo());
  const [dateTo, setDateTo] = useState(today());

  async function load() {
    setLoading(true);
    try {
      setRows((await api.get<Row[]>(`/finance/price-deviation?date_from=${dateFrom}&date_to=${dateTo}`)).data);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const totalImpact = rows.reduce((s, r) => s + Number(r.impact || 0), 0);

  const cols: Column<Row>[] = [
    { key: "sale_date", header: t("ui__дата_8cdd8bb7"), width: "150px",
      render: (r) => new Date(r.sale_date).toLocaleDateString("ru-RU") },
    { key: "doc_number", header: "№", width: "120px",
      render: (r) => r.doc_number || r.sale_id.slice(0, 8) },
    { key: "product_name", header: t("ui__товар_8b35db64") },
    { key: "plan_price", header: t("ui__план_ee229f3b"), align: "right", width: "120px",
      render: (r) => <span className="font-mono">{fmt(r.plan_price)}</span> },
    { key: "fact_price", header: t("ui__факт_0a982a27"), align: "right", width: "120px",
      render: (r) => <span className="font-mono">{fmt(r.fact_price)}</span> },
    { key: "deviation", header: t("ui__отклонение_25ccf335"), align: "right", width: "140px",
      render: (r) => {
        const v = Number(r.deviation);
        return <span className={`font-mono ${v < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
          {v > 0 ? "+" : ""}{fmt(v)}
        </span>;
      } },
    { key: "quantity", header: t("ui__кол_во_302e2bd6"), align: "right", width: "100px",
      render: (r) => <span className="font-mono">{fmt(r.quantity)}</span> },
    { key: "impact", header: t("ui__эффект_c60028c8"), align: "right", width: "150px",
      render: (r) => {
        const v = Number(r.impact);
        return <span className={`font-mono font-semibold ${v < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
          {v > 0 ? "+" : ""}{fmt(v)}
        </span>;
      } },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__отклонение_цены_b3515ea2")}
        description={t("ui__сравнение_плановой_карточка_то_8e3a1d09")} />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 flex gap-3 items-end">
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">{t("ui__с_даты_09fc6619")}</label>
          <input type="date" className={input} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">{t("ui__по_дату_760bcfc8")}</label>
          <input type="date" className={input} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button onClick={load} className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700">
          {t("ui__применить_2cd84411")}
        </button>
        <div className="ml-auto text-sm">
          <span className="text-slate-500 dark:text-slate-400">{t("ui__суммарный_эффект_nbsp_04179872")}</span>
          <span className={`font-mono font-bold ${totalImpact < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
            {totalImpact > 0 ? "+" : ""}{fmt(totalImpact)}
          </span>
        </div>
      </div>

      <DataTable columns={cols} rows={rows} loading={loading}
        rowKey={(r) => `${r.sale_id}-${r.product_name}`}
        emptyText={t("ui__отклонений_нет_8f3230b4")} />
    </div>
  );
}
