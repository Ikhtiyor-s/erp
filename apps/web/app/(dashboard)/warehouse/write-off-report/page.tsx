"use client";

import { useEffect, useState } from "react";
import { Layers, Tag, Package } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { StatWidget } from "@/components/ui/stat-widget";
import { Card, CardHeader } from "@/components/ui/card";
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
      <div className="text-center text-ink-400 dark:text-ink-500 py-20">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <StatWidget
          label={t("ui__сумма_всех_списаний_b661827d")}
          value={fmt(totalAmount)}
          icon={Layers}
          color="danger"
          mono
        />
        <StatWidget
          label={t("ui__причин_375ee026")}
          value={data.by_reason.length}
          icon={Tag}
          color="ink"
        />
        <StatWidget
          label={t("ui__товаров_ac7fc73e")}
          value={data.by_product.length}
          icon={Package}
          color="ink"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card padding="none">
          <CardHeader title={t("ui__по_причинам_11f53bb5")} />
          {data.by_reason.length === 0 ? (
            <div className="text-ink-400 dark:text-ink-500 text-center py-6 text-sm">
              {t("ui__нет_данных_dee9a2d8")}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900/40 text-ink-700 dark:text-ink-300">
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
                    className="border-t border-ink-100 dark:border-ink-800"
                  >
                    <td className="px-3 py-2 text-ink-900 dark:text-ink-100">
                      {r.reason || "Sababsiz"}
                    </td>
                    <td className="px-3 py-2 text-right">{r.cnt}</td>
                    <td className="px-3 py-2 text-right font-mono text-danger-700 dark:text-danger-500">
                      {fmt(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card padding="none">
          <CardHeader title={t("ui__топ_товаров_по_списанию_00101c71")} />
          {data.by_product.length === 0 ? (
            <div className="text-ink-400 dark:text-ink-500 text-center py-6 text-sm">
              {t("ui__нет_данных_dee9a2d8")}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900/40 text-ink-700 dark:text-ink-300">
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
                    className="border-t border-ink-100 dark:border-ink-800"
                  >
                    <td className="px-3 py-2 text-ink-900 dark:text-ink-100">
                      {r.name}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.qty)}</td>
                    <td className="px-3 py-2 text-right font-mono text-danger-700 dark:text-danger-500">
                      {fmt(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
