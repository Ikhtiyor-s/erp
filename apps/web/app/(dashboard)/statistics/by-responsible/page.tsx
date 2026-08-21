"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Row = {
  id: string; responsible_name: string; orders_cnt: number;
  planned: string; produced: string; completed_cnt: number;
};

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

export default function Page() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Row[]>("/manufacturing/by-responsible")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  const cols: Column<Row>[] = [
    { key: "responsible_name", header: t("ui__ответственный_ab60703b") },
    { key: "orders_cnt", header: t("ui__заказов_00d9a0d8"), align: "right", width: "100px" },
    { key: "completed_cnt", header: t("ui__завершено_0083ce05"), align: "right", width: "120px",
      render: (r) => <span className="text-green-700">{r.completed_cnt}</span> },
    { key: "planned", header: t("ui__план_ee229f3b"), align: "right", width: "160px",
      render: (r) => <span className="font-mono">{fmt(r.planned)}</span> },
    { key: "produced", header: t("ui__факт_0a982a27"), align: "right", width: "160px",
      render: (r) => <span className="font-mono font-semibold text-green-700">{fmt(r.produced)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__производство_по_ответственному_438ed5ec")} description={t("ui__выработка_по_сотрудникам_08c9601e")} />
      <DataTable columns={cols} rows={rows} loading={loading} />
    </div>
  );
}
