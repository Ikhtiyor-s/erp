"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Wallet, ShoppingCart, TrendingUp, CalendarDays, Package } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatWidget } from "@/components/ui/stat-widget";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Stats = {
  today_sales: number;
  today_revenue: number;
  month_sales: number;
  month_revenue: number;
  cash_total: number;
};

type DailyStat = {
  date: string;
  revenue: number;
  count: number;
};

const fmt = (v: unknown) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}`;
};

function CustomTooltip({ active, payload, label }: Record<string, any>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-ink-900 border border-ink-200/60 dark:border-ink-700 rounded-lg shadow-md px-3 py-2 text-[12px]">
      <p className="text-ink-500 dark:text-ink-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-mono font-semibold" style={{ color: p.color }}>
          {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("ui");
  const [stats, setStats] = useState<Stats | null>(null);
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<Stats>("/statistics/dashboard"),
      api.get<DailyStat[]>("/statistics/daily-revenue?days=14"),
    ]).then(([statsRes, dailyRes]) => {
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
      if (dailyRes.status === "fulfilled") setDaily(dailyRes.value.data ?? []);
      setLoading(false);
    });
  }, []);

  const chartData = daily.map((d) => ({
    day: fmtDate(d.date),
    revenue: d.revenue,
    count: d.count,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-[clamp(16px,2.2vw,18px)] font-semibold text-ink-900 dark:text-ink-50 tracking-tight">
        {t("ui__главная_047f5653")}
      </h1>

      {/* KPI widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatWidget
          label={t("ui__продажи_сегодня_40543767")}
          value={stats?.today_sales ?? 0}
          icon={CalendarDays}
          color="info"
          loading={loading}
        />
        <StatWidget
          label={t("ui__выручка_сегодня_e2952cde")}
          value={stats ? fmt(stats.today_revenue) : "0"}
          icon={ShoppingCart}
          color="brand"
          mono
          loading={loading}
        />
        <StatWidget
          label={t("ui__продажи_за_месяц_fd0e9db0")}
          value={stats?.month_sales ?? 0}
          icon={TrendingUp}
          color="purple"
          loading={loading}
        />
        <StatWidget
          label={t("ui__выручка_за_месяц_917d1928")}
          value={stats ? fmt(stats.month_revenue) : "0"}
          icon={Package}
          color="success"
          mono
          loading={loading}
        />
        <StatWidget
          label={t("ui__всего_в_кассах_60a8e1df")}
          value={stats ? fmt(stats.cash_total) : "0"}
          icon={Wallet}
          color="warn"
          mono
          loading={loading}
        />
      </div>

      {/* Revenue chart */}
      {(loading || chartData.length > 0) && (
        <Card padding="none">
          <CardHeader
            title={t("ui__выручка_2935dccf") + " — 14 kun"}
            description={t("ui__используйте_боковое_меню_для_н_49af7b77")}
          />
          <CardBody padding="md">
            {loading ? (
              <div className="h-48 rounded bg-ink-100 dark:bg-ink-800 animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--tw-ink-200, #e5e7eb)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    axisLine={false}
                    tickLine={false}
                    className="text-ink-400 dark:text-ink-500"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    axisLine={false}
                    tickLine={false}
                    className="text-ink-400 dark:text-ink-500"
                    tickFormatter={(v) => fmt(v)}
                    width={60}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <Bar dataKey="revenue" fill="#3454d1" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      )}

      {/* Welcome card */}
      <Card>
        <h2 className="font-semibold text-ink-900 dark:text-ink-100 text-[14px] mb-1">
          {t("ui__добро_пожаловать_в_erp_8616fb49")}
        </h2>
        <p className="text-[13px] text-ink-500 dark:text-ink-400">
          {t("ui__используйте_боковое_меню_для_н_49af7b77")}
        </p>
      </Card>
    </div>
  );
}
