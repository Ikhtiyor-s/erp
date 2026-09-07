"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Wallet, ShoppingCart, AlertCircle, Package } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatWidget } from "@/components/ui/stat-widget";
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

  if (loading) return <div className="text-center py-20 text-ink-400">{t("ui__загрузка_43e40d49")}</div>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__сводная_панель_c4125b67")} description={t("ui__ключевые_показатели_16cb0348")} />

      {dash && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatWidget
            icon={ShoppingCart}
            label={t("ui__продажи_сегодня_40543767")}
            value={dash.today_revenue}
            subValue={`${dash.today_sales} sotuv`}
            color="success"
            mono
          />
          <StatWidget
            icon={TrendingUp}
            label={t("ui__продажи_за_месяц_fd0e9db0")}
            value={dash.month_revenue}
            subValue={`${dash.month_sales} sotuv`}
            color="info"
            mono
          />
          <StatWidget
            icon={Wallet}
            label={t("ui__кассы_2e721ce2")}
            value={dash.cash_total}
            subValue="Joriy balans"
            color="brand"
            mono
          />
          <StatWidget
            icon={AlertCircle}
            label={t("ui__долг_клиентов_883e9677")}
            value={dash.total_debt}
            subValue="To'lanmagan sotuvlar"
            color="danger"
            mono
          />
          <StatWidget
            icon={Package}
            label={t("ui__стоимость_остатков_на_складах_c2fb3daa")}
            value={dash.stock_value}
            color="purple"
            mono
          />
          <StatWidget
            icon={TrendingUp}
            label={t("ui__чистый_поток_касса_долг_06a46c50")}
            value={dash.cash_total - dash.total_debt}
            color={dash.cash_total >= dash.total_debt ? "success" : "danger"}
            mono
          />
        </div>
      )}

      <Card padding="none">
        <CardHeader title={t("ui__продажи_за_30_дней_0bf7b671")} />
        <CardBody>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#3454d1" strokeWidth={2} name="Tushum" />
                <Line type="monotone" dataKey="paid" stroke="#17c666" strokeWidth={2} name="To'landi" />
                <Line type="monotone" dataKey="debt" stroke="#ea4d4d" strokeWidth={2} name="Qarz" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
