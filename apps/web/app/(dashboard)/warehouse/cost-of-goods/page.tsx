"use client";

import { useEffect, useState } from "react";
import { Layers, Boxes, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatWidget } from "@/components/ui/stat-widget";
import { useTranslations } from "next-intl";

type Row = { id: string; name: string; sku?: string; total_qty: string; total_cost: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function CostOfGoodsPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Row[]>("/warehouse/cost-of-goods")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const total = rows.reduce((s, r) => s + Number(r.total_cost || 0), 0);
  const totalQty = rows.reduce((s, r) => s + Number(r.total_qty || 0), 0);

  const columns: Column<Row>[] = [
    { key: "sku", header: "SKU", width: "120px", render: (r) => r.sku || "—" },
    { key: "name", header: t("ui__товар_8b35db64") },
    { key: "total_qty", header: t("ui__остаток_9a6054b1"), align: "right", width: "120px",
      render: (r) => <span className="font-mono">{fmt(r.total_qty)}</span> },
    { key: "total_cost", header: t("ui__себестоимость_cc32c68e"), align: "right", width: "180px",
      render: (r) => <span className="font-mono">{fmt(r.total_cost)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__себестоимость_cc32c68e")} description={t("ui__стоимость_остатков_по_всем_скл_78764062")} />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <StatWidget label={t("ui__позиций_7366e179")} value={rows.length} icon={Layers} color="ink" />
        <StatWidget label={t("ui__общее_количество_6f51238e")} value={fmt(totalQty)} icon={Boxes} color="brand" mono />
        <StatWidget label={t("ui__стоимость_всего_5118f296")} value={fmt(total)} icon={Wallet} color="success" mono />
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} />
    </div>
  );
}
