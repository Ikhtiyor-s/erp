"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatWidget } from "@/components/ui/stat-widget";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Row = { day: string; inflow: string; outflow: string; cnt: number };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };

export default function CashboxStatsPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(monthAgo());
  const [dateTo, setDateTo] = useState(today());

  async function load() {
    setLoading(true);
    try {
      setRows((await api.get<Row[]>(`/statistics/cashbox?date_from=${dateFrom}&date_to=${dateTo}`)).data);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const totalIn = rows.reduce((s, r) => s + Number(r.inflow || 0), 0);
  const totalOut = rows.reduce((s, r) => s + Number(r.outflow || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__статистика_кассы_1b2a21bb")} description={t("ui__денежные_операции_по_дням_d31c6df9")} />

      <Card className="flex gap-3 items-end">
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">{t("ui__с_даты_09fc6619")}</label>
          <input type="date" className={input} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">{t("ui__по_дату_760bcfc8")}</label>
          <input type="date" className={input} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <Button onClick={load}>{t("ui__показать_2a175c27")}</Button>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <StatWidget label={t("ui__приход_ebf29487")} value={totalIn} color="success" mono />
        <StatWidget label={t("ui__расход_6068400a")} value={totalOut} color="danger" mono />
        <StatWidget
          label={t("ui__чистый_поток_ea44befc")}
          value={totalIn - totalOut}
          color={totalIn >= totalOut ? "success" : "danger"}
          mono
        />
      </div>

      <Card className="h-80">
        {loading ? (
          <div className="text-center text-ink-400 py-10">{t("ui__загрузка_43e40d49")}</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-ink-400 py-10">{t("ui__нет_данных_dee9a2d8")}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
              <Tooltip formatter={(v: any) => fmt(v)} />
              <Legend />
              <Bar dataKey="inflow" fill="#17c666" name="Kirim" />
              <Bar dataKey="outflow" fill="#ea4d4d" name="Chiqim" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
