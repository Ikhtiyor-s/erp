"use client";

import { useEffect, useState } from "react";
import { Layers, Boxes, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatWidget } from "@/components/ui/stat-widget";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Stock = {
  warehouse_id: number; product_id: string; name: string;
  quantity: string; avg_cost: string;
};
type Warehouse = { id: number; name: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

export default function InStockReportPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Stock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [whFilter, setWhFilter] = useState<number | "">("");
  const [loading, setLoading] = useState(true);

  async function load(wh?: number | "") {
    setLoading(true);
    try {
      const url = wh ? `/warehouse/stock?warehouse_id=${wh}` : "/warehouse/stock";
      setRows((await api.get<Stock[]>(url)).data);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    api.get<Warehouse[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)).catch(() => {});
    load();
  }, []);

  const whName = (id: number) => warehouses.find((w) => w.id === id)?.name || `#${id}`;
  const totalValue = rows.reduce((s, r) => s + Number(r.quantity) * Number(r.avg_cost), 0);
  const totalQty = rows.reduce((s, r) => s + Number(r.quantity), 0);

  const columns: Column<Stock>[] = [
    { key: "warehouse_id", header: t("ui__склад_e8bf999f"), render: (r) => whName(r.warehouse_id), width: "180px" },
    { key: "name", header: t("ui__товар_8b35db64") },
    { key: "quantity", header: t("ui__остаток_9a6054b1"), align: "right", width: "120px",
      render: (r) => <span className="font-mono">{fmt(r.quantity)}</span> },
    { key: "avg_cost", header: t("ui__себест_1f8eb5d4"), align: "right", width: "140px",
      render: (r) => <span className="font-mono">{Number(r.avg_cost).toLocaleString("ru", { maximumFractionDigits: 2 })}</span> },
    { key: "_total", header: t("ui__стоимость_b0cbf581"), align: "right", width: "160px",
      render: (r) => <span className="font-mono">{(Number(r.quantity) * Number(r.avg_cost)).toLocaleString("ru", { maximumFractionDigits: 0 })}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__отчёт_по_остаткам_424be55a")} description={t("ui__текущие_остатки_и_их_стоимость_b1ad9714")} />

      <div className="flex items-center gap-3">
        <label className="text-sm text-ink-600 dark:text-ink-300">{t("ui__склад_2cd219ec")}</label>
        <select className={`${input} max-w-xs`} value={whFilter}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : "";
            setWhFilter(v); load(v);
          }}>
          <option value="">{t("ui__все_склады_ce2fe5e2")}</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <StatWidget label={t("ui__позиций_7366e179")} value={rows.length} icon={Layers} color="ink" />
        <StatWidget label={t("ui__общее_количество_6f51238e")} value={fmt(totalQty)} icon={Boxes} color="brand" mono />
        <StatWidget
          label={t("ui__стоимость_остатков_7101cfdf")}
          value={totalValue.toLocaleString("ru", { maximumFractionDigits: 0 })}
          icon={Wallet}
          color="success"
          mono
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        rowKey={(r) => `${r.warehouse_id}-${r.product_id}`}
      />
    </div>
  );
}
