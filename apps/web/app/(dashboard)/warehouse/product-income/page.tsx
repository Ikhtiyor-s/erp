"use client";

import { useEffect, useState } from "react";
import { DollarSign, Package, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatWidget } from "@/components/ui/stat-widget";
import { useTranslations } from "next-intl";

type Row = {
  id: string;
  sku?: string;
  name: string;
  sold_qty: string;
  revenue: string;
  cost: string;
  profit: string;
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function ProductIncomePage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Row[]>("/warehouse/product-income")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const totalCost = rows.reduce((s, r) => s + Number(r.cost || 0), 0);
  const totalProfit = rows.reduce((s, r) => s + Number(r.profit || 0), 0);

  const cols: Column<Row>[] = [
    { key: "sku", header: "SKU", width: "120px", render: (r) => r.sku || "—" },
    { key: "name", header: t("ui__товар_8b35db64") },
    {
      key: "sold_qty",
      header: t("ui__продано_5890c258"),
      align: "right",
      width: "120px",
      render: (r) => <span className="font-mono">{fmt(r.sold_qty)}</span>,
    },
    {
      key: "revenue",
      header: t("ui__выручка_2935dccf"),
      align: "right",
      width: "150px",
      render: (r) => <span className="font-mono">{fmt(r.revenue)}</span>,
    },
    {
      key: "cost",
      header: t("ui__себестоимость_cc32c68e"),
      align: "right",
      width: "150px",
      render: (r) => (
        <span className="font-mono text-ink-600 dark:text-ink-400">
          {fmt(r.cost)}
        </span>
      ),
    },
    {
      key: "profit",
      header: t("ui__прибыль_23acc06e"),
      align: "right",
      width: "150px",
      render: (r) => {
        const v = Number(r.profit);
        return (
          <span
            className={`font-mono font-semibold ${
              v < 0
                ? "text-danger-700 dark:text-danger-500"
                : "text-success-700 dark:text-success-500"
            }`}
          >
            {fmt(v)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__доход_по_товарам_f249a9b8")}
        description={t("ui__прибыль_выручка_себестоимость_38a70cc9")}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatWidget
          label={t("ui__выручка_2935dccf")}
          value={fmt(totalRevenue)}
          icon={DollarSign}
          color="brand"
          mono
        />
        <StatWidget
          label={t("ui__себестоимость_cc32c68e")}
          value={fmt(totalCost)}
          icon={Package}
          color="ink"
          mono
        />
        <StatWidget
          label={t("ui__прибыль_23acc06e")}
          value={fmt(totalProfit)}
          icon={TrendingUp}
          color={totalProfit >= 0 ? "success" : "danger"}
          mono
        />
      </div>

      <DataTable columns={cols} rows={rows} loading={loading} />
    </div>
  );
}
