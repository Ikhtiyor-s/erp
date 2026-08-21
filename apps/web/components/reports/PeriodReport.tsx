"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };

type Props<T> = {
  title: string;
  description: string;
  endpoint: string;
  columns: Column<T>[];
  exportName?: string;
  rowKey?: (r: T) => string | number;
  noDateRange?: boolean;
};

export function PeriodReport<T extends Record<string, any>>({
  title, description, endpoint, columns, exportName, rowKey, noDateRange,
}: Props<T>) {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(monthAgo());
  const [dateTo, setDateTo] = useState(today());

  async function load() {
    setLoading(true);
    try {
      const url = noDateRange
        ? endpoint
        : `${endpoint}?date_from=${dateFrom}&date_to=${dateTo}`;
      setRows((await api.get<T[]>(url)).data);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function exportCsv() {
    if (!exportName) return;
    const url = noDateRange
      ? `/statistics/export/${exportName}`
      : `/statistics/export/${exportName}?date_from=${dateFrom}&date_to=${dateTo}`;
    const { data } = await api.get(url, { responseType: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(data as Blob);
    a.download = `${exportName}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 flex gap-3 items-end">
        {!noDateRange && (
          <>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                {t("ui__с_даты_09fc6619")}
              </label>
              <input
                type="date"
                className={input}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                {t("ui__по_дату_760bcfc8")}
              </label>
              <input
                type="date"
                className={input}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <button
              onClick={load}
              className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
            >
              {t("ui__показать_2a175c27")}
            </button>
          </>
        )}
        {exportName && (
          <button
            onClick={exportCsv}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
          >
            <Download size={14} /> {t("ui__экспорт_csv_bfd8aa98")}
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey={rowKey} />
    </div>
  );
}
