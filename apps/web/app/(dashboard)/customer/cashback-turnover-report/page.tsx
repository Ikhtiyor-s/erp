"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Row = {
  id: string; name: string; turnover: string;
  sales_cnt: number; cashback_1pct: string;
};

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function CashbackTurnoverPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [pct, setPct] = useState(1);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Row[]>("/customer/cashback-turnover")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const total = rows.reduce((s, r) => s + Number(r.turnover || 0), 0);
  const cashTotal = total * pct / 100;

  const columns: Column<Row>[] = [
    { key: "name", header: t("ui__клиент_4af22f2d") },
    { key: "sales_cnt", header: t("ui__продаж_87d84378"), align: "right", width: "100px" },
    { key: "turnover", header: t("ui__оборот_573e63b6"), align: "right", width: "180px",
      render: (r) => <span className="font-mono">{fmt(r.turnover)}</span> },
    {
      key: "cashback_1pct",
      header: `Keshbek ${pct}%`,
      align: "right",
      width: "180px",
      render: (r) => (
        <span className="font-mono text-green-700 dark:text-green-400">
          {fmt((Number(r.turnover) * pct) / 100)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__кэшбэк_оборот_клиентов_f31df9ea")} description={t("ui__расчёт_потенциального_кэшбэка__10c72eff")} />
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
            {t("ui__ставка_кэшбэка_e827bf34")}
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={pct}
            onChange={(e) => setPct(Number(e.target.value) || 0)}
            className="w-24 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <Card
          label={t("ui__клиентов_a8c15ba0")}
          value={rows.length}
          color="text-slate-900 dark:text-slate-100"
        />
        <Card
          label={t("ui__оборот_всего_9a1b2af4")}
          value={fmt(total)}
          color="text-slate-900 dark:text-slate-100"
        />
        <Card
          label={t("ui__кэшбэк_всего_8dad600a")}
          value={fmt(cashTotal)}
          color="text-green-600 dark:text-green-400"
        />
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} />
    </div>
  );
}

function Card({
  label,
  value,
  color,
}: {
  label: string;
  value: any;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-3 flex-1 min-w-[160px]">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-xl font-bold mt-1 font-mono ${color}`}>{value}</div>
    </div>
  );
}
