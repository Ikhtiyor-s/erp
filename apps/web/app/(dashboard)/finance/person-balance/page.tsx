"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Row = { id: string; balance: string; last_op?: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function PersonBalancePage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Row[]>("/finance/person-balance")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  const cols: Column<Row>[] = [
    { key: "id", header: t("ui__id_лица_7f72c567"), width: "300px",
      render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    { key: "last_op", header: t("ui__последняя_операция_7b264ddb"), width: "180px",
      render: (r) => r.last_op ? new Date(r.last_op).toLocaleString("ru-RU") : "—" },
    { key: "balance", header: t("ui__баланс_95dcad97"), align: "right", width: "180px",
      render: (r) => <span className={`font-mono ${Number(r.balance) < 0 ? "text-red-700" : "text-green-700"}`}>
        {fmt(r.balance)}
      </span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__баланс_физлиц_ec4d8c76")} description={t("ui__произвольные_физлица_не_в_спра_8ede276a")} />
      <DataTable columns={cols} rows={rows} loading={loading}
        emptyText={t("ui__операций_с_физлицами_нет_10863cee")} />
    </div>
  );
}
