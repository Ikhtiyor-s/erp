"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Report = {
  by_reason: { reason: string | null; cnt: number; total: string }[];
  by_product: { id: string; name: string; qty: string; total: string }[];
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function WriteOffReportPage() {
  const t = useTranslations("ui");
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Report>("/warehouse/write-off-report")
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

  const totalAmount = data.by_reason.reduce((s, r) => s + Number(r.total), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__отчёт_по_списаниям_d8bbd540")}
        description={t("ui__свод_списаний_по_причинам_и_по_46d81e46")}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          label={t("ui__сумма_всех_списаний_b661827d")}
          value={fmt(totalAmount)}
          color="text-red-700 dark:text-red-400"
        />
        <Card label={t("ui__причин_375ee026")} value={String(data.by_reason.length)} />
        <Card label={t("ui__товаров_ac7fc73e")} value={String(data.by_product.length)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
          <h3 className="font-semibold mb-3 text-slate-900 dark:text-slate-100">
            {t("ui__по_причинам_11f53bb5")}
          </h3>
          {data.by_reason.length === 0 ? (
            <div className="text-slate-400 dark:text-slate-500 text-center py-6 text-sm">
              {t("ui__нет_данных_dee9a2d8")}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2">{t("ui__причина_d88300c7")}</th>
                  <th className="text-right px-3 py-2 w-20">{t("ui__кол_во_302e2bd6")}</th>
                  <th className="text-right px-3 py-2 w-32">{t("ui__сумма_cf59ebf9")}</th>
                </tr>
              </thead>
              <tbody>
                {data.by_reason.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-slate-200 dark:border-slate-700"
                  >
                    <td className="px-3 py-2 text-slate-900 dark:text-slate-100">
                      {r.reason || "Sababsiz"}
                    </td>
                    <td className="px-3 py-2 text-right">{r.cnt}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700 dark:text-red-400">
                      {fmt(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
          <h3 className="font-semibold mb-3 text-slate-900 dark:text-slate-100">
            {t("ui__топ_товаров_по_списанию_00101c71")}
          </h3>
          {data.by_product.length === 0 ? (
            <div className="text-slate-400 dark:text-slate-500 text-center py-6 text-sm">
              {t("ui__нет_данных_dee9a2d8")}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2">{t("ui__товар_8b35db64")}</th>
                  <th className="text-right px-3 py-2 w-24">{t("ui__кол_во_302e2bd6")}</th>
                  <th className="text-right px-3 py-2 w-32">{t("ui__сумма_cf59ebf9")}</th>
                </tr>
              </thead>
              <tbody>
                {data.by_product.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-slate-200 dark:border-slate-700"
                  >
                    <td className="px-3 py-2 text-slate-900 dark:text-slate-100">
                      {r.name}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.qty)}</td>
                    <td className="px-3 py-2 text-right font-mono text-red-700 dark:text-red-400">
                      {fmt(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  color = "text-slate-900 dark:text-slate-100",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 font-mono ${color}`}>{value}</div>
    </div>
  );
}
