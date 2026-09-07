"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { useTranslations } from "next-intl";

type Product = {
  id: string;
  sku?: string;
  name: string;
  sale_price: string;
  purchase_price: string;
  currency_code?: string;
  unit_name?: string;
  category_name?: string;
  total_stock?: string;
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export function ProductKindList({
  title,
  description,
  kind,
  isService,
}: {
  title: string;
  description: string;
  kind?: string;
  isService?: boolean;
}) {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("limit", "200");
      if (q) p.set("q", q);
      if (kind) p.set("kind", kind);
      if (isService !== undefined) p.set("is_service", String(isService));
      setRows((await api.get<Product[]>(`/warehouse/products?${p}`)).data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const columns: Column<Product>[] = [
    { key: "sku", header: "SKU", width: "120px", render: (r) => r.sku || "—" },
    { key: "name", header: t("ui__название_602680ed") },
    {
      key: "category_name",
      header: t("ui__категория_c95a1e2d"),
      width: "150px",
      render: (r) => r.category_name || "—",
    },
    {
      key: "unit_name",
      header: t("ui__ед_11f95ddc"),
      width: "80px",
      render: (r) => r.unit_name || "—",
    },
    {
      key: "purchase_price",
      header: t("ui__закуп_57c36fc5"),
      align: "right",
      width: "130px",
      render: (r) => <span className="font-mono">{fmt(r.purchase_price)}</span>,
    },
    {
      key: "sale_price",
      header: t("ui__продажа_78b786c5"),
      align: "right",
      width: "150px",
      render: (r) => (
        <span className="font-mono">
          {fmt(r.sale_price)} {r.currency_code || ""}
        </span>
      ),
    },
    ...(isService
      ? []
      : [
          {
            key: "total_stock" as any,
            header: t("ui__остаток_9a6054b1"),
            align: "right" as const,
            width: "110px",
            render: (r: Product) => (
              <span className="font-mono">{fmt(r.total_stock)}</span>
            ),
          },
        ]),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <Card className="flex gap-3 items-end">
        <div className="relative flex-1 max-w-md">
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__поиск_bfc95980")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-ink-400"
          />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__поиск_b84a8f87")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
        >
          {t("ui__фильтр_2f884b41")}
        </button>
        <div className="ml-auto text-xs text-ink-500 dark:text-ink-400">
          Всего:{" "}
          <span className="font-semibold text-ink-900 dark:text-ink-100">
            {rows.length}
          </span>
        </div>
      </Card>

      <DataTable columns={columns} rows={rows} loading={loading} />
      <p className="text-xs text-ink-400 dark:text-ink-500">
        Управление товарами — на странице{" "}
        <a href="/warehouse/products" className="text-brand-600 dark:text-brand-400 hover:underline">
          /warehouse/products
        </a>
      </p>
    </div>
  );
}
