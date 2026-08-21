"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Row = { id: string; name: string; balance: string };

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function EmployeeBalancePage() {
  const t = useTranslations("ui");
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    api
      .get<Row[]>("/finance/employee-balance")
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

  const total = filtered.reduce((s, r) => s + Number(r.balance || 0), 0);

  const cols: Column<Row>[] = [
    { key: "name", header: t("ui__сотрудник_8f519d66") },
    {
      key: "balance",
      header: t("ui__баланс_95dcad97"),
      align: "right",
      width: "200px",
      render: (r) => {
        const v = Number(r.balance);
        return (
          <span
            className={`font-mono ${
              v < 0
                ? "text-red-700 dark:text-red-400"
                : v > 0
                ? "text-green-700 dark:text-green-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {fmt(v)}
          </span>
        );
      },
    },
    {
      key: "id" as any,
      header: "",
      align: "center",
      width: "60px",
      render: (r) => (
        <button
          onClick={() => router.push(`/hr/employees/${r.id}`)}
          className="text-brand-600 dark:text-brand-400 hover:text-brand-700"
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
        title={t("ui__баланс_сотрудников_7d9aea5a")}
        description={t("ui__расчёты_с_сотрудниками_f70361dc")}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 flex gap-3 items-end">
        <div className="relative flex-1 max-w-md">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_сотрудника_e7411e45")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-slate-400"
          />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__поиск_b84a8f87")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="ml-auto text-sm text-slate-500 dark:text-slate-400">
          Всего:{" "}
          <span
            className={`font-mono font-semibold ${
              total < 0
                ? "text-red-700 dark:text-red-400"
                : "text-green-700 dark:text-green-400"
            }`}
          >
            {fmt(total)}
          </span>
        </div>
      </div>

      <DataTable columns={cols} rows={filtered} loading={loading} />
    </div>
  );
}
