"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, Activity, DollarSign } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatWidget } from "@/components/ui/stat-widget";
import { useTranslations } from "next-intl";

type Analytics = {
  total_customers: number;
  new_30d: number;
  active_30d: number;
  avg_check_30d: number;
  top_customers: { id: string; name: string; sales_cnt: number; revenue: string }[];
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

export default function AnalyticsDashboardPage() {
  const t = useTranslations("ui");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Analytics>("/customer/analytics-dashboard")
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="text-center py-20 text-ink-400 dark:text-ink-500">
        {t("ui__загрузка_43e40d49")}
      </div>
    );
  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__аналитика_клиентов_2af32abf")}
        description={t("ui__сводка_по_клиентской_базе_и_ак_42115927")}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatWidget
          icon={Users}
          label={t("ui__всего_клиентов_8824fde8")}
          value={data.total_customers}
          color="brand"
        />
        <StatWidget
          icon={UserPlus}
          label={t("ui__новых_за_30_дней_9f17efe0")}
          value={data.new_30d}
          color="success"
        />
        <StatWidget
          icon={Activity}
          label={t("ui__активных_за_30_дней_5d7a88cc")}
          value={data.active_30d}
          color="purple"
        />
        <StatWidget
          icon={DollarSign}
          label={t("ui__средний_чек_30_дн_6233284a")}
          value={fmt(data.avg_check_30d)}
          color="teal"
          mono
        />
      </div>

      <Card padding="none">
        <CardHeader title={t("ui__топ_10_клиентов_по_выручке_1d17a650")} />
        <CardBody>
          {data.top_customers.length === 0 ? (
            <div className="text-ink-400 dark:text-ink-500 text-center py-6 text-sm">
              {t("ui__нет_данных_dee9a2d8")}
            </div>
          ) : (
            <ol className="space-y-2">
              {data.top_customers.map((c, i) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between text-sm py-2 border-b border-ink-200 dark:border-ink-800 last:border-0"
                >
                  <span>
                    <strong className="text-brand-600 dark:text-brand-400 mr-2">
                      #{i + 1}
                    </strong>
                    <span className="text-ink-900 dark:text-ink-100">
                      {c.name}
                    </span>
                    <span className="text-xs text-ink-500 dark:text-ink-400 ml-2">
                      ({c.sales_cnt} продаж)
                    </span>
                  </span>
                  <span className="font-mono font-semibold text-ink-900 dark:text-ink-100">
                    {fmt(c.revenue)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
