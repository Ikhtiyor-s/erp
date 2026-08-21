"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Stats = {
  cashboxes: { name: string; balance: string; code?: string }[];
  customers: { debtors: number; overpayers: number; net: string };
};

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function BalanceStatsPage() {
  const t = useTranslations("ui");
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Stats>("/finance/balance-statistics")
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-slate-400 dark:text-slate-500 py-20">{t("ui__загрузка_43e40d49")}</div>;
  if (!data) return null;

  const totalCash = data.cashboxes.reduce((s, r) => s + Number(r.balance), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__статистика_баланса_6353c2cc")} description={t("ui__срез_балансов_на_текущий_момен_a90ea763")} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
          <h3 className="font-semibold mb-4 text-slate-900 dark:text-slate-100">
            {t("ui__кассы_2e721ce2")}
          </h3>
          {data.cashboxes.length === 0 ? (
            <div className="text-slate-400 dark:text-slate-500 text-center py-8">
              {t("ui__касс_нет_0681b6ff")}
            </div>
          ) : (
            <ul className="space-y-2">
              {data.cashboxes.map((c, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-sm py-2 border-b border-slate-200 dark:border-slate-700 last:border-0"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {c.name}{" "}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {c.code}
                    </span>
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      Number(c.balance) < 0
                        ? "text-red-700 dark:text-red-400"
                        : "text-green-700 dark:text-green-400"
                    }`}
                  >
                    {fmt(c.balance)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between text-sm pt-2 border-t-2 border-slate-300 dark:border-slate-600">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {t("ui__всего_по_кассам_eaf9a22f")}
                </span>
                <span
                  className={`font-mono font-bold text-lg ${
                    totalCash < 0
                      ? "text-red-700 dark:text-red-400"
                      : "text-green-700 dark:text-green-400"
                  }`}
                >
                  {fmt(totalCash)}
                </span>
              </li>
            </ul>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
          <h3 className="font-semibold mb-4 text-slate-900 dark:text-slate-100">
            {t("ui__балансы_клиентов_0a9d27cb")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t("ui__должников_390d1199")}
              </div>
              <div className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
                {data.customers.debtors}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t("ui__переплатили_0c5ce114")}
              </div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                {data.customers.overpayers}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t("ui__сальдо_508d1e7a")}
              </div>
              <div
                className={`text-2xl font-bold font-mono mt-1 ${
                  Number(data.customers.net) < 0
                    ? "text-red-700 dark:text-red-400"
                    : "text-green-700 dark:text-green-400"
                }`}
              >
                {fmt(data.customers.net)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
