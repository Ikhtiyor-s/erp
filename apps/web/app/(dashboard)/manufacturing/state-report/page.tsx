"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Row = { status: string; cnt: number; total_planned: string; total_produced: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });
const statusLabel = (s: string) => ({
  draft: "Qoralama", in_progress: "Ishda",
  completed: "Yakunlandi", cancelled: "Bekor qilindi",
}[s] || s);
const statusColor = (s: string) => ({
  draft: "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200",
  in_progress: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
  completed: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  cancelled: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
}[s] || "bg-slate-100 dark:bg-slate-700");

export default function StateReportPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Row[]>("/manufacturing/state-report")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  const totalCnt = rows.reduce((s, r) => s + Number(r.cnt), 0);
  const totalPlanned = rows.reduce((s, r) => s + Number(r.total_planned), 0);
  const totalProduced = rows.reduce((s, r) => s + Number(r.total_produced), 0);

  const cols: Column<Row>[] = [
    {
      key: "status", header: t("ui__статус_7203f7a4"), width: "200px",
      render: (r) => <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold ${statusColor(r.status)}`}>
        {statusLabel(r.status)}
      </span>,
    },
    { key: "cnt", header: t("ui__заказов_00d9a0d8"), align: "right", width: "120px" },
    { key: "total_planned", header: t("ui__план_ee229f3b"), align: "right", width: "180px",
      render: (r) => <span className="font-mono">{fmt(r.total_planned)}</span> },
    { key: "total_produced", header: t("ui__факт_0a982a27"), align: "right", width: "180px",
      render: (r) => <span className="font-mono">{fmt(r.total_produced)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__отчёт_по_статусам_9bdce63d")} description={t("ui__производственные_заказы_по_ста_9ce49aca")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Card label={t("ui__всего_заказов_5bfc0cc4")} value={totalCnt} />
        <Card label={t("ui__запланировано_7420cfa9")} value={fmt(totalPlanned)} />
        <Card label={t("ui__произведено_74e8623b")} value={fmt(totalProduced)} color="text-green-700 dark:text-green-400" />
      </div>
      <DataTable columns={cols} rows={rows} loading={loading} rowKey={(r) => r.status} />
    </div>
  );
}

function Card({
  label,
  value,
  color = "text-slate-900 dark:text-slate-100",
}: any) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 font-mono ${color}`}>{value}</div>
    </div>
  );
}
