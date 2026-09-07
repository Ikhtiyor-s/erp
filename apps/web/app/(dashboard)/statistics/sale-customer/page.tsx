"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Row = {
  id: string;
  name: string;
  revenue: string;
  sales_cnt: number;
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function SaleCustomerPage() {
  const t = useTranslations("ui");
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    api
      .get<Row[]>("/customer/abc-analysis")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      q
        ? rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()))
        : rows,
    [rows, q]
  );

  const total = filtered.reduce((s, r) => s + Number(r.revenue || 0), 0);

  const cols: Column<Row>[] = [
    { key: "name", header: t("ui__клиент_4af22f2d") },
    {
      key: "sales_cnt",
      header: t("ui__продаж_87d84378"),
      align: "right",
      width: "120px",
    },
    {
      key: "revenue",
      header: t("ui__сумма_cf59ebf9"),
      align: "right",
      width: "180px",
      render: (r) => (
        <span className="font-mono text-ink-900 dark:text-ink-100">
          {fmt(r.revenue)}
        </span>
      ),
    },
    {
      key: "id" as any,
      header: "",
      width: "60px",
      align: "center",
      render: (r) => (
        <button
          onClick={() => router.push(`/customer/customers/${r.id}`)}
          className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
          title={t("ui__профиль_a46c3723")}
          aria-label={`${r.name} profilini ko'rish`}
        >
          <Eye size={14} aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__продажи_по_клиентам_72da73e7")}
        description={t("ui__суммы_продаж_по_каждому_клиент_3150187f")}
      />

      <Card className="flex gap-3 items-end">
        <div className="relative flex-1 max-w-md">
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__поиск_клиента_a3f1695e")}
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
          />
        </div>
        <div className="ml-auto text-sm text-ink-500 dark:text-ink-400">
          Сумма:{" "}
          <span className="font-mono font-semibold text-ink-900 dark:text-ink-100">
            {fmt(total)}
          </span>
        </div>
      </Card>

      <DataTable columns={cols} rows={filtered} loading={loading} />
    </div>
  );
}
