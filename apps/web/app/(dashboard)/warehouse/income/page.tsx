"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

type Supply = {
  id: string; doc_number?: string; supply_date: string;
  total_amount: string; status: string;
  supplier_name?: string; warehouse_name?: string;
};

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function IncomePage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Supply[]>("/supplier/supplies")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const total = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);

  const columns: Column<Supply>[] = [
    { key: "doc_number", header: "№", render: (r) => r.doc_number || r.id.slice(0, 8), width: "100px" },
    { key: "supply_date", header: t("ui__дата_8cdd8bb7"), width: "120px" },
    { key: "supplier_name", header: t("ui__поставщик_b8fbf748"), render: (r) => r.supplier_name || "—" },
    { key: "warehouse_name", header: t("ui__склад_e8bf999f"), render: (r) => r.warehouse_name || "—" },
    { key: "total_amount", header: t("ui__сумма_cf59ebf9"), align: "right", width: "160px",
      render: (r) => <span className="font-mono">{fmt(r.total_amount)}</span> },
    {
      key: "status",
      header: t("ui__статус_7203f7a4"),
      width: "120px",
      render: (r) =>
        r.status === "received" ? (
          <Badge tone="success">{t("ui__принято_713e9366")}</Badge>
        ) : r.status === "cancelled" ? (
          <Badge tone="danger">{t("ui__отменено_81a04dab")}</Badge>
        ) : (
          <Badge tone="neutral">{r.status}</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__приходы_4b3f0ea9")} description={t("ui__поступления_от_поставщиков_док_3319b62c")} />
      <div className="flex justify-end text-sm">
        <span className="text-ink-500 dark:text-ink-400">{t("ui__сумма_всех_приходов_nbsp_de0279ea")}</span>
        <span className="font-mono font-semibold">{fmt(total)}</span>
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} />
      <div className="text-xs text-ink-400">
        {t("ui__создание_прихода_доступно_в_ра_674ee269")}
      </div>
    </div>
  );
}
