"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Row = {
  cashbox_id: number; cashbox_name: string;
  direction: string; total: string; cnt: number;
};

type Cb = { cashbox_id: number; cashbox_name: string; in: number; out: number; net: number; cnt: number };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };

export default function CashboxTurnoverPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Cb[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(monthAgo());
  const [dateTo, setDateTo] = useState(today());

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<Row[]>(`/finance/turnover?date_from=${dateFrom}&date_to=${dateTo}`);
      const agg: Record<number, Cb> = {};
      for (const r of data) {
        if (!agg[r.cashbox_id]) {
          agg[r.cashbox_id] = { cashbox_id: r.cashbox_id, cashbox_name: r.cashbox_name, in: 0, out: 0, net: 0, cnt: 0 };
        }
        if (r.direction === "in") agg[r.cashbox_id].in += Number(r.total);
        else agg[r.cashbox_id].out += Number(r.total);
        agg[r.cashbox_id].cnt += Number(r.cnt);
      }
      Object.values(agg).forEach((a) => { a.net = a.in - a.out; });
      setRows(Object.values(agg));
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const totalIn = rows.reduce((s, r) => s + r.in, 0);
  const totalOut = rows.reduce((s, r) => s + r.out, 0);

  const cols: Column<Cb>[] = [
    { key: "cashbox_name", header: t("ui__касса_c85fd621") },
    { key: "cnt", header: t("ui__операций_f680ce84"), align: "right", width: "110px" },
    { key: "in", header: t("ui__приход_ebf29487"), align: "right", width: "160px",
      render: (r) => <span className="font-mono text-green-700 dark:text-green-400">{fmt(r.in)}</span> },
    { key: "out", header: t("ui__расход_6068400a"), align: "right", width: "160px",
      render: (r) => <span className="font-mono text-red-700 dark:text-red-400">{fmt(r.out)}</span> },
    { key: "net", header: t("ui__сальдо_508d1e7a"), align: "right", width: "160px",
      render: (r) => <span className={`font-mono font-semibold ${r.net < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>{fmt(r.net)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__оборот_по_кассам_b841cc99")} description={t("ui__приход_расход_по_каждой_кассе_3dc9d989")} />

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
          {t("ui__показать_2a175c27")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <SummaryCard label={t("ui__приход_ebf29487")} value={fmt(totalIn)} color="text-green-700 dark:text-green-400" />
        <SummaryCard label={t("ui__расход_6068400a")} value={fmt(totalOut)} color="text-red-700 dark:text-red-400" />
        <SummaryCard label={t("ui__сальдо_508d1e7a")} value={fmt(totalIn - totalOut)} color={totalIn >= totalOut ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"} />
      </div>

      <DataTable columns={cols} rows={rows} loading={loading} rowKey={(r) => r.cashbox_id} />
    </div>
  );
}

function SummaryCard({ label, value, color }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 font-mono ${color}`}>{value}</div>
    </div>
  );
}
