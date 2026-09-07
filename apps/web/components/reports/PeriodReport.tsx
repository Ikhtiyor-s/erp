"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

      <Card className="flex gap-3 items-end">
        {!noDateRange && (
          <>
            <div>
              <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
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
              <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
                {t("ui__по_дату_760bcfc8")}
              </label>
              <input
                type="date"
                className={input}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button onClick={load}>
              {t("ui__показать_2a175c27")}
            </Button>
          </>
        )}
        {exportName && (
          <Button onClick={exportCsv} variant="outline" icon={Download} className="ml-auto">
            {t("ui__экспорт_csv_bfd8aa98")}
          </Button>
        )}
      </Card>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey={rowKey} />
    </div>
  );
}
