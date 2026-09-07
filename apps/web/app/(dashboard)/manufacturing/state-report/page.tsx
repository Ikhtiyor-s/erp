"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Target, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { StatWidget } from "@/components/ui/stat-widget";
import { useTranslations } from "next-intl";

type Row = { status: string; cnt: number; total_planned: string; total_produced: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });
const statusLabel = (s: string) => ({
  draft: "Qoralama", in_progress: "Ishda",
  completed: "Yakunlandi", cancelled: "Bekor qilindi",
}[s] || s);
const STATUS_TONE: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  in_progress: "warning",
  completed: "success",
  cancelled: "danger",
};

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
      render: (r) => <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{statusLabel(r.status)}</Badge>,
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
        <StatWidget label={t("ui__всего_заказов_5bfc0cc4")} value={totalCnt} icon={ClipboardList} color="ink" />
        <StatWidget label={t("ui__запланировано_7420cfa9")} value={fmt(totalPlanned)} icon={Target} color="ink" mono />
        <StatWidget label={t("ui__произведено_74e8623b")} value={fmt(totalProduced)} icon={CheckCircle2} color="success" mono />
      </div>
      <DataTable columns={cols} rows={rows} loading={loading} rowKey={(r) => r.status} />
    </div>
  );
}
