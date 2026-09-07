"use client";

import { useEffect, useState } from "react";
import { TrendingUp, ShoppingCart, AlertCircle, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatWidget } from "@/components/ui/stat-widget";
import { useTranslations } from "next-intl";

type Dashboard = {
  kpi: {
    today_revenue: string;
    today_count: number;
    week_revenue: string;
    week_count: number;
    month_revenue: string;
    month_count: number;
    total_debt: string;
  };
  top_customers: { id: string; name: string; cnt: number; revenue: string }[];
  top_products: { id: string; name: string; qty: string; revenue: string }[];
  daily: { day: string; revenue: string; cnt: number }[];
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

export default function SaleDashboardPage() {
  const t = useTranslations("ui");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Dashboard>("/sale/dashboard")
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="text-center text-ink-400 dark:text-ink-500 py-20">
        {t("ui__загрузка_43e40d49")}
      </div>
    );
  if (!data) return null;

  const maxDaily = Math.max(1, ...data.daily.map((d) => Number(d.revenue)));

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__панель_продаж_1ed9805b")} description={t("ui__kpi_и_аналитика_за_последний_п_98fe5d07")} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatWidget
          label={t("ui__сегодня_96269cac")}
          value={fmt(data.kpi.today_revenue)}
          subValue={`${data.kpi.today_count} sotuv`}
          icon={TrendingUp}
          color="success"
          mono
        />
        <StatWidget
          label={t("ui__неделя_be3b4499")}
          value={fmt(data.kpi.week_revenue)}
          subValue={`${data.kpi.week_count} sotuv`}
          icon={Calendar}
          color="info"
          mono
        />
        <StatWidget
          label={t("ui__месяц_aeb10f7f")}
          value={fmt(data.kpi.month_revenue)}
          subValue={`${data.kpi.month_count} sotuv`}
          icon={ShoppingCart}
          color="brand"
          mono
        />
        <StatWidget
          label={t("ui__долг_клиентов_883e9677")}
          value={fmt(data.kpi.total_debt)}
          subValue="To'lanmagan"
          icon={AlertCircle}
          color="danger"
          mono
        />
      </div>

      <Card padding="none">
        <CardHeader title={t("ui__продажи_за_30_дней_0bf7b671")} />
        <CardBody>
          {data.daily.length === 0 ? (
            <div className="text-ink-400 dark:text-ink-500 text-center py-8">
              {t("ui__нет_данных_dee9a2d8")}
            </div>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {data.daily.map((d) => {
                const h = (Number(d.revenue) / maxDaily) * 100;
                return (
                  <div key={d.day} className="flex-1 group relative">
                    <div
                      className="w-full bg-brand-200 dark:bg-brand-900/50 hover:bg-brand-400 dark:hover:bg-brand-500 rounded-t transition-colors"
                      style={{ height: `${Math.max(h, 2)}%` }}
                    />
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-ink-900 dark:bg-ink-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                      {d.day}: {fmt(d.revenue)} ({d.cnt})
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-semibold mb-3 text-ink-900 dark:text-ink-100 text-[14px]">
            {t("ui__топ_5_клиентов_30_дней_a22d043c")}
          </h3>
          <ol className="space-y-2">
            {data.top_customers.length === 0 && (
              <li className="text-ink-400 dark:text-ink-500">{t("ui__нет_данных_dee9a2d8")}</li>
            )}
            {data.top_customers.map((c, i) => (
              <li
                key={c.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-ink-900 dark:text-ink-100">
                  <strong className="text-brand-600 dark:text-brand-400 mr-2">
                    #{i + 1}
                  </strong>
                  {c.name}
                </span>
                <span className="font-mono font-semibold text-ink-900 dark:text-ink-100">
                  {fmt(c.revenue)}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3 text-ink-900 dark:text-ink-100 text-[14px]">
            {t("ui__топ_5_товаров_30_дней_27adf8eb")}
          </h3>
          <ol className="space-y-2">
            {data.top_products.length === 0 && (
              <li className="text-ink-400 dark:text-ink-500">{t("ui__нет_данных_dee9a2d8")}</li>
            )}
            {data.top_products.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-ink-900 dark:text-ink-100">
                  <strong className="text-brand-600 dark:text-brand-400 mr-2">
                    #{i + 1}
                  </strong>
                  {p.name}
                </span>
                <span className="font-mono font-semibold text-ink-900 dark:text-ink-100">
                  {fmt(p.revenue)}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
