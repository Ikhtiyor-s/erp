"use client";

import { useEffect, useState } from "react";
import { TrendingUp, ShoppingCart, AlertCircle, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
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
      <div className="text-center text-slate-400 dark:text-slate-500 py-20">
        {t("ui__загрузка_43e40d49")}
      </div>
    );
  if (!data) return null;

  const maxDaily = Math.max(1, ...data.daily.map((d) => Number(d.revenue)));

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__панель_продаж_1ed9805b")} description={t("ui__kpi_и_аналитика_за_последний_п_98fe5d07")} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp size={18} />}
          label={t("ui__сегодня_96269cac")}
          value={fmt(data.kpi.today_revenue)}
          sub={`${data.kpi.today_count} sotuv`}
          color="text-green-600 dark:text-green-400"
        />
        <KpiCard
          icon={<Calendar size={18} />}
          label={t("ui__неделя_be3b4499")}
          value={fmt(data.kpi.week_revenue)}
          sub={`${data.kpi.week_count} sotuv`}
          color="text-blue-600 dark:text-blue-400"
        />
        <KpiCard
          icon={<ShoppingCart size={18} />}
          label={t("ui__месяц_aeb10f7f")}
          value={fmt(data.kpi.month_revenue)}
          sub={`${data.kpi.month_count} sotuv`}
          color="text-indigo-600 dark:text-indigo-400"
        />
        <KpiCard
          icon={<AlertCircle size={18} />}
          label={t("ui__долг_клиентов_883e9677")}
          value={fmt(data.kpi.total_debt)}
          sub="To'lanmagan"
          color="text-red-600 dark:text-red-400"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
        <h3 className="font-semibold mb-4 text-slate-900 dark:text-slate-100">
          {t("ui__продажи_за_30_дней_0bf7b671")}
        </h3>
        {data.daily.length === 0 ? (
          <div className="text-slate-400 dark:text-slate-500 text-center py-8">
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
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 dark:bg-slate-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    {d.day}: {fmt(d.revenue)} ({d.cnt})
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
          <h3 className="font-semibold mb-3 text-slate-900 dark:text-slate-100">
            {t("ui__топ_5_клиентов_30_дней_a22d043c")}
          </h3>
          <ol className="space-y-2">
            {data.top_customers.length === 0 && (
              <li className="text-slate-400 dark:text-slate-500">{t("ui__нет_данных_dee9a2d8")}</li>
            )}
            {data.top_customers.map((c, i) => (
              <li
                key={c.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-900 dark:text-slate-100">
                  <strong className="text-brand-600 dark:text-brand-400 mr-2">
                    #{i + 1}
                  </strong>
                  {c.name}
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {fmt(c.revenue)}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
          <h3 className="font-semibold mb-3 text-slate-900 dark:text-slate-100">
            {t("ui__топ_5_товаров_30_дней_27adf8eb")}
          </h3>
          <ol className="space-y-2">
            {data.top_products.length === 0 && (
              <li className="text-slate-400 dark:text-slate-500">{t("ui__нет_данных_dee9a2d8")}</li>
            )}
            {data.top_products.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-900 dark:text-slate-100">
                  <strong className="text-brand-600 dark:text-brand-400 mr-2">
                    #{i + 1}
                  </strong>
                  {p.name}
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {fmt(p.revenue)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
        <span className={color}>{icon}</span>
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 font-mono ${color}`}>{value}</div>
      <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
        {sub}
      </div>
    </div>
  );
}
