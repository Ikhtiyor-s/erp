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
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function ProductTradePage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Row[]>("/warehouse/product-statistic")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  const cols: Column<Row>[] = [
    { key: "sku", header: "SKU", width: "120px", render: (r) => r.sku || "—" },
    { key: "name", header: t("ui__товар_8b35db64") },
    {
      key: "purchased_qty",
      header: t("ui__закуплено_6b4f8b9c"),
      align: "right",
      width: "130px",
      render: (r) => (
        <span className="font-mono text-blue-700 dark:text-blue-400">
          {fmt(r.purchased_qty)}
        </span>
      ),
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
      header: t("ui__текущий_остаток_c18e3cf5"),
      align: "right",
      width: "170px",
      render: (r) => <span className="font-mono">{fmt(r.current_stock)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__торговля_товарами_47838654")}
        description={t("ui__покупки_и_продажи_по_товарам_3204a1e2")}
      />
      <DataTable columns={cols} rows={rows} loading={loading} />
    </div>
  );
}
