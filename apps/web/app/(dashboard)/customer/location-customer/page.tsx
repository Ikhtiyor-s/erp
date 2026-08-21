"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Loc = {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  customer_count: number;
};

export default function LocationCustomerPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Loc[]>("/customer/locations-map")
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  const total = rows.reduce((s, r) => s + (r.customer_count || 0), 0);

  const cols: Column<Loc>[] = [
    { key: "name", header: t("ui__локация_fb00342c") },
    {
      key: "address",
      header: t("ui__адрес_80148fa5"),
      render: (r) => r.address || "—",
    },
    {
      key: "phone",
      header: t("ui__телефон_2928e19c"),
      width: "150px",
      render: (r) => r.phone || "—",
    },
    {
      key: "customer_count",
      header: t("ui__клиентов_a8c15ba0"),
      align: "right",
      width: "140px",
      render: (r) => (
        <span className="font-mono text-brand-700 dark:text-brand-400">
          {r.customer_count}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__местоположение_клиентов_1bed1e56")}
        description={t("ui__распределение_клиентов_по_лока_38de61bf")}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card label={t("ui__всего_локаций_330210f8")} value={String(rows.length)} icon={<MapPin />} />
        <Card label={t("ui__всего_клиентов_8824fde8")} value={String(total)} />
        <Card
          label={t("ui__среднее_на_локацию_45f5b29c")}
          value={rows.length ? (total / rows.length).toFixed(1) : "—"}
        />
      </div>

      <DataTable columns={cols} rows={rows} loading={loading} />
    </div>
  );
}

function Card({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold mt-1 font-mono text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}
