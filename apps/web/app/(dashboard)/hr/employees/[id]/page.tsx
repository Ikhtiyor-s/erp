"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  DollarSign,
  Factory,
  Target,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatWidget } from "@/components/ui/stat-widget";

type Profile = {
  head: {
    id: string;
    full_name: string;
    phone?: string;
    email?: string;
    salary?: string;
    position_name?: string;
    currency_code?: string;
    hire_date?: string;
    fire_date?: string;
    is_active?: boolean;
  };
  balance: { bal: string; cnt: number };
  productions: { orders_cnt: number; produced: string; completed_cnt: number };
  kpis: {
    period_month: string;
    metric: string;
    target_value?: string;
    actual_value?: string;
    notes?: string;
  }[];
  movements: {
    id: number;
    direction: "in" | "out";
    amount: string;
    description?: string;
    movement_date: string;
    cashbox_name?: string;
    currency_code?: string;
    payment_type_name?: string;
  }[];
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function EmployeeProfilePage() {
  const t = useTranslations("ui");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Profile | null>(null);

  useEffect(() => {
    api.get<Profile>(`/hr/employees/${id}`).then((r) => setData(r.data));
  }, [id]);

  if (!data)
    return (
      <div className="text-center py-20 text-ink-400 dark:text-ink-500">
        {t("ui__загрузка_43e40d49")}
      </div>
    );
  const h = data.head;
  const balanceVal = Number(data.balance.bal);

  return (
    <div className="space-y-6">
      <Button type="button" variant="ghost" size="sm" icon={ArrowLeft} onClick={() => router.back()}>
        {t("ui__назад_2b0b0225")}
      </Button>

      <Card padding="lg">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-full">
            <User size={28} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100">
                {h.full_name}
              </h1>
              {h.is_active === false ? (
                <Badge tone="danger">{t("ui__уволен_ea0713a7")}</Badge>
              ) : (
                <Badge tone="success">{t("ui__активен_318150c5")}</Badge>
              )}
            </div>
            <div className="text-ink-600 dark:text-ink-300 mt-1">
              {h.position_name || "Lavozimsiz"}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
              {h.phone && (
                <div>
                  <span className="text-ink-500 dark:text-ink-400">
                    {t("ui__тел_23ffe78b")}
                  </span>{" "}
                  <span className="text-ink-900 dark:text-ink-100">
                    {h.phone}
                  </span>
                </div>
              )}
              {h.email && (
                <div>
                  <span className="text-ink-500 dark:text-ink-400">
                    Email:
                  </span>{" "}
                  <span className="text-ink-900 dark:text-ink-100">
                    {h.email}
                  </span>
                </div>
              )}
              {h.hire_date && (
                <div>
                  <span className="text-ink-500 dark:text-ink-400">
                    {t("ui__принят_4f54040f")}
                  </span>{" "}
                  <span className="text-ink-900 dark:text-ink-100">
                    {new Date(h.hire_date).toLocaleDateString("ru-RU")}
                  </span>
                </div>
              )}
              {h.fire_date && (
                <div>
                  <span className="text-ink-500 dark:text-ink-400">
                    {t("ui__уволен_40a25ade")}
                  </span>{" "}
                  <span className="text-ink-900 dark:text-ink-100">
                    {new Date(h.fire_date).toLocaleDateString("ru-RU")}
                  </span>
                </div>
              )}
              {h.salary && (
                <div>
                  <span className="text-ink-500 dark:text-ink-400">
                    {t("ui__оклад_551eabfe")}
                  </span>{" "}
                  <span className="font-mono text-ink-900 dark:text-ink-100">
                    {fmt(h.salary)} {h.currency_code}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatWidget
          label={t("ui__баланс_с_сотрудником_7ffb0cb0")}
          value={fmt(data.balance.bal)}
          subValue={`${data.balance.cnt} operatsiya`}
          icon={DollarSign}
          color={balanceVal < 0 ? "danger" : balanceVal > 0 ? "success" : "ink"}
          mono
        />
        <StatWidget
          label={t("ui__производство_96c63692")}
          value={data.productions.orders_cnt}
          subValue={`Завершено: ${data.productions.completed_cnt}, произведено ${fmt(
            data.productions.produced
          )}`}
          icon={Factory}
          color="info"
          mono
        />
        <StatWidget
          label={t("ui__kpi_записей_af3a576a")}
          value={data.kpis.length}
          subValue="Butun davr uchun"
          icon={Target}
          color="purple"
          mono
        />
      </div>

      <Card padding="none">
        <CardHeader title={t("ui__kpi_последние_24_8864b851")} />
        {data.kpis.length === 0 ? (
          <div className="text-ink-400 dark:text-ink-500 text-center py-6 text-sm">
            {t("ui__kpi_записей_нет_9d6f9004")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-500 dark:text-ink-500 text-[11px] uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60">
                  <th className="px-3 py-2 text-left font-medium">{t("ui__период_f90bfbcc")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("ui__метрика_7ae745f7")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("ui__план_ee229f3b")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("ui__факт_0a982a27")}</th>
                  <th className="px-3 py-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {data.kpis.map((k, i) => {
                  const target = Number(k.target_value);
                  const actual = Number(k.actual_value);
                  const ratio = target ? (actual / target) * 100 : null;
                  return (
                    <tr
                      key={i}
                      className="border-b border-ink-100 dark:border-ink-800/40 last:border-0 hover:bg-ink-50/60 dark:hover:bg-ink-900/30"
                    >
                      <td className="px-3 py-2.5 text-ink-700 dark:text-ink-300">
                        {new Date(k.period_month).toLocaleDateString("ru-RU", {
                          year: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="px-3 py-2.5 text-ink-900 dark:text-ink-100">
                        {k.metric}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-ink-700 dark:text-ink-300">
                        {k.target_value ? fmt(k.target_value) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-ink-700 dark:text-ink-300">
                        {k.actual_value ? fmt(k.actual_value) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {ratio !== null ? (
                          <span
                            className={
                              ratio >= 100
                                ? "text-success-700 dark:text-success-500"
                                : ratio >= 80
                                ? "text-warn-700 dark:text-warn-500"
                                : "text-danger-700 dark:text-danger-500"
                            }
                          >
                            {ratio.toFixed(0)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padding="none">
        <CardHeader title={t("ui__история_операций_последние_50_1528aac6")} />
        {(data.movements || []).length === 0 ? (
          <div className="text-ink-400 dark:text-ink-500 text-center py-6 text-sm">
            {t("ui__операций_нет_97f2b4ae")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-500 dark:text-ink-500 text-[11px] uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60">
                  <th className="px-3 py-2 text-left font-medium">{t("ui__дата_8cdd8bb7")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("ui__касса_c85fd621")}</th>
                  <th className="px-3 py-2 text-center font-medium">{t("ui__тип_345805b8")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("ui__сумма_cf59ebf9")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("ui__способ_c5fe4929")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("ui__описание_38ca0af8")}</th>
                </tr>
              </thead>
              <tbody>
                {data.movements.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-ink-100 dark:border-ink-800/40 last:border-0 hover:bg-ink-50/60 dark:hover:bg-ink-900/30"
                  >
                    <td className="px-3 py-2.5 text-ink-700 dark:text-ink-300">
                      {new Date(m.movement_date).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-3 py-2.5 text-ink-900 dark:text-ink-100">
                      {m.cashbox_name || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {m.direction === "in" ? (
                        <Badge tone="success">
                          <ArrowDownCircle size={12} /> {t("ui__приход_ebf29487")}
                        </Badge>
                      ) : (
                        <Badge tone="danger">
                          <ArrowUpCircle size={12} /> {t("ui__расход_6068400a")}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      <span
                        className={
                          m.direction === "in"
                            ? "text-success-700 dark:text-success-500"
                            : "text-danger-700 dark:text-danger-500"
                        }
                      >
                        {m.direction === "in" ? "+" : "−"}
                        {fmt(m.amount)} {m.currency_code || ""}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-700 dark:text-ink-300">
                      {m.payment_type_name || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-ink-700 dark:text-ink-300">
                      {m.description || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
