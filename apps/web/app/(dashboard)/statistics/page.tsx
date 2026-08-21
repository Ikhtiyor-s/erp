"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Wallet, ShoppingCart, AlertCircle, Package } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Dash = {
  today_sales: number; today_revenue: number;
  month_sales: number; month_revenue: number;
  cash_total: number; total_debt: number; stock_value: number;
};
type Row = { day: string; sales_count: number; revenue: number; paid: number; debt: number };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };

export default function StatisticsDashboard() {
  const t = useTranslations("ui");
  const [dash, setDash] = useState<Dash | null>(null);
  const [sales, setSales] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Dash>("/statistics/dashboard").then((r) => setDash(r.data)),
      api.get<Row[]>(`/statistics/sales-summary?date_from=${monthAgo()}&date_to=${today()}`)
        .then((r) => setSales(r.data)),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-slate-400">{t("ui__загрузка_43e40d49")}</div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__сводная_панель_c4125b67")} description={t("ui__ключевые_показатели_16cb0348")} />

      {dash && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={<ShoppingCart size={18} />} label={t("ui__продажи_сегодня_40543767")} value={fmt(dash.today_revenue)}
            sub={`${dash.today_sales} sotuv`} color="text-green-700" />
          <Kpi icon={<TrendingUp size={18} />} label={t("ui__продажи_за_месяц_fd0e9db0")} value={fmt(dash.month_revenue)}
            sub={`${dash.month_sales} sotuv`} color="text-blue-700" />
          <Kpi icon={<Wallet size={18} />} label={t("ui__кассы_2e721ce2")} value={fmt(dash.cash_total)}
            sub="Joriy balans" color="text-indigo-700" />
          <Kpi icon={<AlertCircle size={18} />} label={t("ui__долг_клиентов_883e9677")} value={fmt(dash.total_debt)}
            sub="To'lanmagan sotuvlar" color="text-red-700" />
        </div>
      )}

      {dash && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 border rounded-lg shadow-sm p-4 flex items-center gap-3">
            <Package size={32} className="text-purple-600" />
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">{t("ui__стоимость_остатков_на_складах_c2fb3daa")}</div>
              <div className="text-2xl font-bold font-mono text-purple-700">{fmt(dash.stock_value)}</div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 border rounded-lg shadow-sm p-4 flex items-center gap-3">
            <TrendingUp size={32} className="text-green-600" />
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">{t("ui__чистый_поток_касса_долг_06a46c50")}</div>
              <div className="text-2xl font-bold font-mono text-green-700">
                {fmt(dash.cash_total - dash.total_debt)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 border rounded-lg shadow-sm p-5">
        <h3 className="font-semibold mb-3">{t("ui__продажи_за_30_дней_0bf7b671")}</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
              <Tooltip formatter={(v: any) => fmt(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} name="Tushum" />
              <Line type="monotone" dataKey="paid" stroke="#10b981" strokeWidth={2} name="To'landi" />
              <Line type="monotone" dataKey="debt" stroke="#ef4444" strokeWidth={2} name="Qarz" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub, color }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 border rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
        <span className={color}>{icon}</span>{label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${color} font-mono`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}
