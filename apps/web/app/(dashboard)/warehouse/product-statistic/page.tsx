"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Row = {
  id: string;
  sku?: string;
  name: string;
  purchased_qty: string;
  sold_qty: string;
  current_stock: string;
  sale_price: string;
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function ProductStatisticPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Row[]>("/warehouse/product-statistic")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  const totalSold = rows.reduce((s, r) => s + Number(r.sold_qty || 0), 0);
  const totalStock = rows.reduce((s, r) => s + Number(r.current_stock || 0), 0);

  const cols: Column<Row>[] = [
    { key: "sku", header: "SKU", width: "120px", render: (r) => r.sku || "—" },
    { key: "name", header: t("ui__товар_8b35db64") },
    {
      key: "purchased_qty",
      header: t("ui__закуплено_6b4f8b9c"),
      align: "right",
      width: "130px",
      render: (r) => <span className="font-mono">{fmt(r.purchased_qty)}</span>,
    },
    {
      key: "sold_qty",
      header: t("ui__продано_5890c258"),
      align: "right",
      width: "130px",
      render: (r) => (
        <span className="font-mono text-green-700 dark:text-green-400">
          {fmt(r.sold_qty)}
        </span>
      ),
    },
    {
      key: "current_stock",
      header: t("ui__остаток_9a6054b1"),
      align: "right",
      width: "130px",
      render: (r) => (
        <span className="font-mono text-brand-700 dark:text-brand-400">
          {fmt(r.current_stock)}
        </span>
      ),
    },
    {
      key: "sale_price",
      header: t("ui__цена_682fa8db"),
      align: "right",
      width: "130px",
      render: (r) => <span className="font-mono">{fmt(r.sale_price)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__статистика_товаров_012165a0")}
        description={t("ui__движение_товаров_закуплено_про_077e3202")}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card label={t("ui__позиций_7366e179")} value={String(rows.length)} />
        <Card label={t("ui__продано_всего_22de79fe")} value={fmt(totalSold)} color="text-green-700 dark:text-green-400" />
        <Card label={t("ui__остаток_всего_9c5cd796")} value={fmt(totalStock)} color="text-brand-700 dark:text-brand-400" />
      </div>

      <DataTable columns={cols} rows={rows} loading={loading} />
    </div>
  );
}

function Card({
  label,
  value,
  color = "text-slate-900 dark:text-slate-100",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 font-mono ${color}`}>{value}</div>
    </div>
  );
}
