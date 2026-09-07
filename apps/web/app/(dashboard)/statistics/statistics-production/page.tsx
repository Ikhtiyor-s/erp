"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ClipboardList, Package } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatWidget } from "@/components/ui/stat-widget";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Row = { day: string; orders_cnt: number; produced: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };

export default function ProductionStatsPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(monthAgo());
  const [dateTo, setDateTo] = useState(today());

  async function load() {
    setLoading(true);
    try {
      setRows((await api.get<Row[]>(`/statistics/production?date_from=${dateFrom}&date_to=${dateTo}`)).data);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const totalOrders = rows.reduce((s, r) => s + Number(r.orders_cnt || 0), 0);
  const totalProduced = rows.reduce((s, r) => s + Number(r.produced || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__статистика_производства_4311bf37")} description={t("ui__завершённые_производственные_з_2eab1127")} />

      <Card className="flex gap-3 items-end">
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">{t("ui__с_даты_09fc6619")}</label>
          <input type="date" className={input} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">{t("ui__по_дату_760bcfc8")}</label>
          <input type="date" className={input} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <Button onClick={load} size="md">
          {t("ui__показать_2a175c27")}
        </Button>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatWidget label={t("ui__завершённых_заказов_0184c7d9")} value={totalOrders} icon={ClipboardList} color="brand" />
        <StatWidget label={t("ui__произведено_единиц_87cb274e")} value={fmt(totalProduced)} icon={Package} color="success" mono />
      </div>

      <Card padding="lg" className="h-80">
        {loading ? (
          <div className="text-center text-ink-400 py-10">{t("ui__загрузка_43e40d49")}</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-ink-400 py-10">{t("ui__производства_не_было_a9ce8da3")}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="produced" fill="#3454d1" name="Ishlab chiqarildi" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
