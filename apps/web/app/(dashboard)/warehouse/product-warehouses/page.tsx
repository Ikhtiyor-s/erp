"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Stock = {
  warehouse_id: number; product_id: string; name: string;
  quantity: string; avg_cost: string;
};
type Warehouse = { id: number; name: string };

export default function StockPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Stock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [whFilter, setWhFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(wh?: number | null) {
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

  const columns: Column<Stock>[] = [
    { key: "warehouse_id", header: t("ui__склад_e8bf999f"), render: (r) => whName(r.warehouse_id), width: "180px" },
    { key: "name", header: t("ui__товар_8b35db64") },
    { key: "quantity", header: t("ui__остаток_9a6054b1"), align: "right",
      render: (r) => Number(r.quantity).toLocaleString("ru"), width: "120px" },
    { key: "avg_cost", header: t("ui__средняя_себестоимость_7c5ab064"), align: "right",
      render: (r) => Number(r.avg_cost).toLocaleString("ru"), width: "180px" },
    { key: "_total", header: t("ui__стоимость_b0cbf581"), align: "right",
      render: (r) => (Number(r.quantity) * Number(r.avg_cost)).toLocaleString("ru", { maximumFractionDigits: 0 }),
      width: "150px" },
  ];

  const totalValue = rows.reduce((s, r) => s + Number(r.quantity) * Number(r.avg_cost), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__остатки_товаров_1b243158")} description={t("ui__текущие_остатки_по_складам_4345ea9c")} />

      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600 dark:text-slate-300">{t("ui__склад_2cd219ec")}</label>
        <select className={`${input} max-w-xs`} value={whFilter || ""}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : null;
            setWhFilter(v); load(v);
          }}>
          <option value="">{t("ui__все_склады_ce2fe5e2")}</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        <div className="ml-auto text-sm">
          <span className="text-slate-500 dark:text-slate-400">{t("ui__общая_стоимость_остатков_a8667b78")} </span>
          <span className="font-semibold">{totalValue.toLocaleString("ru", { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} loading={loading}
        rowKey={(r) => `${r.warehouse_id}-${r.product_id}`} />
    </div>
  );
}
