"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
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

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 flex gap-3 items-end">
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">{t("ui__с_даты_09fc6619")}</label>
          <input type="date" className={input} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">{t("ui__по_дату_760bcfc8")}</label>
          <input type="date" className={input} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button onClick={load} className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700">
          {t("ui__показать_2a175c27")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Card label={t("ui__приход_ebf29487")} value={fmt(totalIn)} color="text-green-700 dark:text-green-400" />
        <Card label={t("ui__расход_6068400a")} value={fmt(totalOut)} color="text-red-700 dark:text-red-400" />
        <Card
          label={t("ui__чистый_поток_ea44befc")}
          value={fmt(totalIn - totalOut)}
          color={
            totalIn >= totalOut
              ? "text-green-700 dark:text-green-400"
              : "text-red-700 dark:text-red-400"
          }
        />
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
        <h3 className="font-semibold mb-3 text-slate-900 dark:text-slate-100">
          {t("ui__по_дням_137cdcc3")}
        </h3>
        {loading || !data?.daily.length ? (
          <div className="text-slate-400 text-center py-8">{t("ui__нет_данных_dee9a2d8")}</div>
        ) : (
          <div className="space-y-1">
            {data.daily.map((d) => (
              <div key={d.day} className="grid grid-cols-12 items-center text-xs gap-2">
                <div className="col-span-2 text-slate-600 dark:text-slate-300">{d.day}</div>
                <div className="col-span-5">
                  <div className="bg-green-500 h-4 rounded text-white text-xs px-2 leading-4 font-mono"
                    style={{ width: `${(Number(d.inflow) / maxV) * 100}%`, minWidth: Number(d.inflow) > 0 ? "30px" : "0" }}>
                    {Number(d.inflow) > 0 && fmt(d.inflow)}
                  </div>
                </div>
                <div className="col-span-5">
                  <div className="bg-red-500 h-4 rounded text-white text-xs px-2 leading-4 font-mono"
                    style={{ width: `${(Number(d.outflow) / maxV) * 100}%`, minWidth: Number(d.outflow) > 0 ? "30px" : "0" }}>
                    {Number(d.outflow) > 0 && fmt(d.outflow)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
        <h3 className="font-semibold mb-3 text-slate-900 dark:text-slate-100">
          {t("ui__по_типам_оплаты_de35931f")}
        </h3>
        {!data?.by_payment_type.length ? (
          <div className="text-slate-400 dark:text-slate-500 text-center py-8">
            {t("ui__нет_данных_dee9a2d8")}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300">
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
                  className="border-t border-slate-200 dark:border-slate-700"
                >
                  <td className="px-3 py-2 text-slate-900 dark:text-slate-100">
                    {r.payment_type || "— ko'rsatilmagan —"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={
                        r.direction === "in"
                          ? "text-green-700 dark:text-green-400"
                          : "text-red-700 dark:text-red-400"
                      }
                    >
                      {r.direction === "in" ? "Kirim" : "Chiqim"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                    {fmt(r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, color }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 font-mono ${color}`}>{value}</div>
    </div>
  );
}
