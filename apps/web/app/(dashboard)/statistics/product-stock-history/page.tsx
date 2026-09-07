"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Row = { day: string; product_id: string; net_change: string };
type Product = { id: string; name: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

export default function StockHistoryPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const url = productId
        ? `/statistics/product-stock-history?product_id=${productId}`
        : "/statistics/product-stock-history";
      setRows((await api.get<Row[]>(url)).data);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [productId]);

  useEffect(() => {
    if (search.length < 2) { setProducts([]); return; }
    const t = setTimeout(() => {
      api.get<Product[]>(`/warehouse/products?q=${encodeURIComponent(search)}`)
        .then((r) => setProducts(r.data.slice(0, 10))).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const cols: Column<Row>[] = [
    { key: "day", header: t("ui__дата_8cdd8bb7"), width: "150px",
      render: (r) => new Date(r.day).toLocaleDateString("ru-RU") },
    { key: "product_id", header: t("ui__товар_id_ea8528d7"), render: (r) => r.product_id.slice(0, 8) + "…", width: "150px" },
    { key: "net_change", header: t("ui__изменение_остатка_275f6eb2"), align: "right",
      render: (r) => {
        const v = Number(r.net_change);
        return <span className={`font-mono ${v < 0 ? "text-danger-700 dark:text-danger-500" : "text-success-700 dark:text-success-500"}`}>
          {v > 0 ? "+" : ""}{fmt(v)}
        </span>;
      } },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__история_остатков_83f6b923")} description={t("ui__изменения_остатков_продажи_и_п_9431ea77")} />

      <Card className="flex gap-3 items-end">
        <div className="flex-1 max-w-md relative">
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">{t("ui__фильтр_по_товару_6865709f")}</label>
          <input className={input} placeholder={productName || "Tovar qidirish..."}
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {products.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-ink-800 border border-ink-200 dark:border-ink-700 rounded-md shadow-lg max-h-48 overflow-auto">
              {products.map((p) => (
                <button key={p.id}
                  onClick={() => { setProductId(p.id); setProductName(p.name); setSearch(p.name); setProducts([]); }}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-ink-50 dark:bg-ink-900/40">
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {productId && (
          <Button
            variant="outline"
            onClick={() => { setProductId(""); setProductName(""); setSearch(""); }}
          >
            {t("ui__сбросить_02d901c1")}
          </Button>
        )}
      </Card>

      <DataTable columns={cols} rows={rows} loading={loading}
        rowKey={(r) => `${r.day}-${r.product_id}`} />
    </div>
  );
}
