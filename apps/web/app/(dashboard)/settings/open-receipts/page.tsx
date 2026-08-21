"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Sale = {
  id: string; doc_number?: string; sale_date: string;
  total_amount: string; paid_amount: string; status: string; customer_name?: string;
};

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function OpenReceiptsPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Sale[]>("/sale/sales?status=draft&limit=200")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  const cols: Column<Sale>[] = [
    { key: "doc_number", header: "№", render: (r) => r.doc_number || r.id.slice(0, 8), width: "120px" },
    { key: "sale_date", header: t("ui__дата_8cdd8bb7"), width: "180px",
      render: (r) => new Date(r.sale_date).toLocaleString("ru-RU") },
    { key: "customer_name", header: t("ui__клиент_4af22f2d"), render: (r) => r.customer_name || "Chakana" },
    { key: "total_amount", header: t("ui__сумма_cf59ebf9"), align: "right", width: "160px",
      render: (r) => <span className="font-mono">{fmt(r.total_amount)}</span> },
    { key: "status", header: t("ui__статус_7203f7a4"), width: "120px",
      render: (r) => <span className="text-yellow-600">{r.status}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__открытые_чеки_d11642c6")} description={t("ui__незавершённые_продажи_draft_8d4357ca")} />
      <DataTable columns={cols} rows={rows} loading={loading}
        emptyText={t("ui__открытых_чеков_нет_088acfce")} />
    </div>
  );
}
