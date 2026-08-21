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
      <div className="text-center py-20 text-slate-400 dark:text-slate-500">
        {t("ui__загрузка_43e40d49")}
      </div>
    );
  const h = data.head;
  const balanceVal = Number(data.balance.bal);

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
      >
        <ArrowLeft size={16} /> {t("ui__назад_2b0b0225")}
      </button>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 rounded-full">
            <User size={28} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {h.full_name}
              </h1>
              {h.is_active === false ? (
                <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                  {t("ui__уволен_ea0713a7")}
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  {t("ui__активен_318150c5")}
                </span>
              )}
            </div>
            <div className="text-slate-600 dark:text-slate-300 mt-1">
              {h.position_name || "Lavozimsiz"}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
              {h.phone && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">
                    {t("ui__тел_23ffe78b")}
                  </span>{" "}
                  <span className="text-slate-900 dark:text-slate-100">
                    {h.phone}
                  </span>
                </div>
              )}
              {h.email && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">
                    Email:
                  </span>{" "}
                  <span className="text-slate-900 dark:text-slate-100">
                    {h.email}
                  </span>
                </div>
              )}
              {h.hire_date && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">
                    {t("ui__принят_4f54040f")}
                  </span>{" "}
                  <span className="text-slate-900 dark:text-slate-100">
                    {new Date(h.hire_date).toLocaleDateString("ru-RU")}
                  </span>
                </div>
              )}
              {h.fire_date && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">
                    {t("ui__уволен_40a25ade")}
                  </span>{" "}
                  <span className="text-slate-900 dark:text-slate-100">
                    {new Date(h.fire_date).toLocaleDateString("ru-RU")}
                  </span>
                </div>
              )}
              {h.salary && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">
                    {t("ui__оклад_551eabfe")}
                  </span>{" "}
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    {fmt(h.salary)} {h.currency_code}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          icon={<DollarSign size={18} />}
          label={t("ui__баланс_с_сотрудником_7ffb0cb0")}
          value={fmt(data.balance.bal)}
          sub={`${data.balance.cnt} operatsiya`}
          color={
            balanceVal < 0
              ? "text-red-700 dark:text-red-400"
              : balanceVal > 0
              ? "text-green-700 dark:text-green-400"
              : "text-slate-700 dark:text-slate-300"
          }
        />
        <Card
          icon={<Factory size={18} />}
          label={t("ui__производство_96c63692")}
          value={String(data.productions.orders_cnt)}
          sub={`Завершено: ${data.productions.completed_cnt}, произведено ${fmt(
            data.productions.produced
          )}`}
          color="text-blue-700 dark:text-blue-400"
        />
        <Card
          icon={<Target size={18} />}
          label={t("ui__kpi_записей_af3a576a")}
          value={String(data.kpis.length)}
          sub="Butun davr uchun"
          color="text-purple-700 dark:text-purple-400"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
        <h3 className="font-semibold mb-3 text-slate-900 dark:text-slate-100">
          {t("ui__kpi_последние_24_8864b851")}
        </h3>
        {data.kpis.length === 0 ? (
          <div className="text-slate-400 dark:text-slate-500 text-center py-6 text-sm">
            {t("ui__kpi_записей_нет_9d6f9004")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">{t("ui__период_f90bfbcc")}</th>
                  <th className="px-3 py-2 text-left">{t("ui__метрика_7ae745f7")}</th>
                  <th className="px-3 py-2 text-right">{t("ui__план_ee229f3b")}</th>
                  <th className="px-3 py-2 text-right">{t("ui__факт_0a982a27")}</th>
                  <th className="px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {data.kpis.map((k, i) => {
                  const t = Number(k.target_value);
                  const a = Number(k.actual_value);
                  const ratio = t ? (a / t) * 100 : null;
                  return (
                    <tr
                      key={i}
                      className="border-t border-slate-200 dark:border-slate-700"
                    >
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                        {new Date(k.period_month).toLocaleDateString("ru-RU", {
                          year: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="px-3 py-2 text-slate-900 dark:text-slate-100">
                        {k.metric}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                        {k.target_value ? fmt(k.target_value) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                        {k.actual_value ? fmt(k.actual_value) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {ratio !== null ? (
                          <span
                            className={
                              ratio >= 100
                                ? "text-green-700 dark:text-green-400"
                                : ratio >= 80
                                ? "text-yellow-600 dark:text-yellow-400"
                                : "text-red-600 dark:text-red-400"
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
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
        <h3 className="font-semibold mb-3 text-slate-900 dark:text-slate-100">
          {t("ui__история_операций_последние_50_1528aac6")}
        </h3>
        {(data.movements || []).length === 0 ? (
          <div className="text-slate-400 dark:text-slate-500 text-center py-6 text-sm">
            {t("ui__операций_нет_97f2b4ae")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">{t("ui__дата_8cdd8bb7")}</th>
                  <th className="px-3 py-2 text-left">{t("ui__касса_c85fd621")}</th>
                  <th className="px-3 py-2 text-center">{t("ui__тип_345805b8")}</th>
                  <th className="px-3 py-2 text-right">{t("ui__сумма_cf59ebf9")}</th>
                  <th className="px-3 py-2 text-left">{t("ui__способ_c5fe4929")}</th>
                  <th className="px-3 py-2 text-left">{t("ui__описание_38ca0af8")}</th>
                </tr>
              </thead>
              <tbody>
                {data.movements.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-slate-200 dark:border-slate-700"
                  >
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {new Date(m.movement_date).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-3 py-2 text-slate-900 dark:text-slate-100">
                      {m.cashbox_name || "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {m.direction === "in" ? (
                        <span className="text-green-600 dark:text-green-400 inline-flex items-center gap-1">
                          <ArrowDownCircle size={14} /> {t("ui__приход_ebf29487")}
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 inline-flex items-center gap-1">
                          <ArrowUpCircle size={14} /> {t("ui__расход_6068400a")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      <span
                        className={
                          m.direction === "in"
                            ? "text-green-700 dark:text-green-400"
                            : "text-red-700 dark:text-red-400"
                        }
                      >
                        {m.direction === "in" ? "+" : "−"}
                        {fmt(m.amount)} {m.currency_code || ""}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {m.payment_type_name || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {m.description || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
        <span className={color}>{icon}</span>
        {label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${color} font-mono`}>{value}</div>
      <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
        {sub}
      </div>
    </div>
  );
}
