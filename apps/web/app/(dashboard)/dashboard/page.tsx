"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Wallet, ShoppingCart, TrendingUp, Calendar } from "lucide-react";
import { useTranslations } from "next-intl";

type Stats = {
  today_sales: number;
  today_revenue: number;
  month_sales: number;
  month_revenue: number;
  cash_total: number;
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

export default function DashboardPage() {
  const t = useTranslations("ui");
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api
      .get<Stats>("/statistics/dashboard")
      .then((r) => setStats(r.data))
      .catch(() => {});
  }, []);

  const cards = [
    {
      title: t("ui__продажи_сегодня_40543767"),
      value: stats?.today_sales ?? "—",
      icon: Calendar,
      color: "text-blue-600 dark:text-blue-400",
      isMoney: false,
    },
    {
      title: t("ui__выручка_сегодня_e2952cde"),
      value: stats ? fmt(stats.today_revenue) : "—",
      icon: ShoppingCart,
      color: "text-green-600 dark:text-green-400",
      isMoney: true,
    },
    {
      title: t("ui__продажи_за_месяц_fd0e9db0"),
      value: stats?.month_sales ?? "—",
      icon: TrendingUp,
      color: "text-purple-600 dark:text-purple-400",
      isMoney: false,
    },
    {
      title: t("ui__выручка_за_месяц_917d1928"),
      value: stats ? fmt(stats.month_revenue) : "—",
      icon: TrendingUp,
      color: "text-orange-600 dark:text-orange-400",
      isMoney: true,
    },
    {
      title: t("ui__всего_в_кассах_60a8e1df"),
      value: stats ? fmt(stats.cash_total) : "—",
      icon: Wallet,
      color: "text-emerald-600 dark:text-emerald-400",
      isMoney: true,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        {t("ui__главная_047f5653")}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((c) => {
          const I = c.icon;
          return (
            <div
              key={c.title}
              className="bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm border border-slate-200 dark:border-slate-700"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {c.title}
                </span>
                <I size={20} className={c.color} />
              </div>
              <div className={`text-2xl font-bold mt-2 ${c.isMoney ? "font-mono" : ""} text-slate-900 dark:text-slate-100`}>
                {c.value}
              </div>
            </div>
          );
        })}
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h2 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">
          {t("ui__добро_пожаловать_в_erp_8616fb49")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Используйте боковое меню для навигации по модулям: финансы, склад,
          продажи, клиенты, поставщики, производство и т.д.
        </p>
      </div>
    </div>
  );
}
