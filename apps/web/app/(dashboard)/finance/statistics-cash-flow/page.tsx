"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatWidget } from "@/components/ui/stat-widget";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type CashFlow = {
  daily: { day: string; inflow: string; outflow: string }[];
  by_payment_type: { payment_type?: string; direction: string; total: string }[];
};

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };

export default function CashFlowPage() {
  const t = useTranslations("ui");
  const [data, setData] = useState<CashFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(monthAgo());
  const [dateTo, setDateTo] = useState(today());

  async function load() {
    setLoading(true);
    try {
      setData((await api.get<CashFlow>(`/finance/cash-flow?date_from=${dateFrom}&date_to=${dateTo}`)).data);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const totalIn = data?.daily.reduce((s, r) => s + Number(r.inflow), 0) || 0;
  const totalOut = data?.daily.reduce((s, r) => s + Number(r.outflow), 0) || 0;
  const maxV = Math.max(1, ...(data?.daily.flatMap((d) => [Number(d.inflow), Number(d.outflow)]) || []));

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__денежный_поток_21f87fa1")} description={t("ui__cash_flow_за_период_bca8ad09")} />

      <Card className="flex flex-wrap gap-3 items-end">
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

      <Card padding="none">
        <CardHeader title={t("ui__по_дням_137cdcc3")} />
        <CardBody>
          {loading || !data?.daily.length ? (
            <div className="text-ink-400 dark:text-ink-500 text-center py-8">{t("ui__нет_данных_dee9a2d8")}</div>
          ) : (
            <div className="space-y-1">
              {data.daily.map((d) => (
                <div key={d.day} className="grid grid-cols-12 items-center text-xs gap-2">
                  <div className="col-span-2 text-ink-600 dark:text-ink-300">{d.day}</div>
                  <div className="col-span-5">
                    <div className="bg-success-500 h-4 rounded text-white text-xs px-2 leading-4 font-mono"
                      style={{ width: `${(Number(d.inflow) / maxV) * 100}%`, minWidth: Number(d.inflow) > 0 ? "30px" : "0" }}>
                      {Number(d.inflow) > 0 && fmt(d.inflow)}
                    </div>
                  </div>
                  <div className="col-span-5">
                    <div className="bg-danger-500 h-4 rounded text-white text-xs px-2 leading-4 font-mono"
                      style={{ width: `${(Number(d.outflow) / maxV) * 100}%`, minWidth: Number(d.outflow) > 0 ? "30px" : "0" }}>
                      {Number(d.outflow) > 0 && fmt(d.outflow)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader title={t("ui__по_типам_оплаты_de35931f")} />
        {!data?.by_payment_type.length ? (
          <div className="text-ink-400 dark:text-ink-500 text-center py-8">
            {t("ui__нет_данных_dee9a2d8")}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-900/40 text-ink-700 dark:text-ink-300">
              <tr>
                <th className="px-3 py-2 text-left">{t("ui__тип_оплаты_a6dd9595")}</th>
                <th className="px-3 py-2 text-center w-32">{t("ui__направление_e4de6223")}</th>
                <th className="px-3 py-2 text-right w-40">{t("ui__сумма_cf59ebf9")}</th>
              </tr>
            </thead>
            <tbody>
              {data.by_payment_type.map((r, idx) => (
                <tr
                  key={idx}
                  className="border-t border-ink-100 dark:border-ink-800"
                >
                  <td className="px-3 py-2 text-ink-900 dark:text-ink-100">
                    {r.payment_type || "— ko'rsatilmagan —"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={
                        r.direction === "in"
                          ? "text-success-700 dark:text-success-500"
                          : "text-danger-700 dark:text-danger-500"
                      }
                    >
                      {r.direction === "in" ? "Kirim" : "Chiqim"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink-700 dark:text-ink-300">
                    {fmt(r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
