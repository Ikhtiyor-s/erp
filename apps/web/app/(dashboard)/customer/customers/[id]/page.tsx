"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  DollarSign,
  ShoppingCart,
  ArrowDownCircle,
  ArrowUpCircle,
  Eye,
} from "lucide-react";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";

type Profile = {
  head: {
    id: string;
    code?: string;
    uuid_label: string;
    name: string;
    phone?: string;
    email?: string;
    tin?: string;
    address?: string;
    category_name?: string;
    location_name?: string;
    created_at?: string;
    is_active?: boolean;
  };
  balance: { bal: string; cnt: number };
  sales: { cnt: number; total: string; paid: string; last_sale?: string };
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
  recent_sales: {
    id: string;
    doc_number?: string;
    sale_date: string;
    total_amount: string;
    paid_amount: string;
    status: string;
    warehouse_name?: string;
  }[];
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const statusLabel = (s: string) =>
  ({
    draft: "Qoralama",
    completed: "Yakunlandi",
    cancelled: "Bekor qilindi",
    partial: "Qisman",
  }[s] || s);

const statusColor = (s: string) =>
  ({
    draft: "text-slate-500 dark:text-slate-400",
    completed: "text-green-700 dark:text-green-400",
    cancelled: "text-red-700 dark:text-red-400",
    partial: "text-yellow-700 dark:text-yellow-400",
  }[s] || "text-slate-700 dark:text-slate-300");

export default function CustomerProfilePage() {
  const t = useTranslations("ui");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Profile | null>(null);

  useEffect(() => {
    api.get<Profile>(`/customer/customers/${id}`).then((r) => setData(r.data));
  }, [id]);

  if (!data)
    return (
      <div className="text-center py-20 text-slate-400 dark:text-slate-500">
        {t("ui__загрузка_43e40d49")}
      </div>
    );
  const h = data.head;
  const balanceVal = Number(data.balance.bal);
  const debt = Number(data.sales.total) - Number(data.sales.paid);

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
                {h.name}
              </h1>
              <code className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                {h.uuid_label}
              </code>
              {h.is_active === false && (
                <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                  {t("ui__неактивен_28911a13")}
                </span>
              )}
            </div>
            <div className="text-slate-600 dark:text-slate-300 mt-1">
              {h.category_name || "Kategoriyasiz"}
              {h.location_name && ` • ${h.location_name}`}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
              {h.code && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">
                    {t("ui__код_e99a9afe")}
                  </span>{" "}
                  <span className="text-slate-900 dark:text-slate-100">
                    {h.code}
                  </span>
                </div>
              )}
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
              {h.tin && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">
                    {t("ui__инн_66d33a57")}
                  </span>{" "}
                  <span className="text-slate-900 dark:text-slate-100">
                    {h.tin}
                  </span>
                </div>
              )}
              {h.address && (
                <div className="col-span-2 md:col-span-4">
                  <span className="text-slate-500 dark:text-slate-400">
                    {t("ui__адрес_53d0666d")}
                  </span>{" "}
                  <span className="text-slate-900 dark:text-slate-100">
                    {h.address}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          icon={<DollarSign size={18} />}
          label={t("ui__баланс_95dcad97")}
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
          icon={<ShoppingCart size={18} />}
          label={t("ui__покупок_bbf3a630")}
          value={String(data.sales.cnt)}
          sub={
            data.sales.last_sale
              ? `Последняя: ${new Date(data.sales.last_sale).toLocaleDateString(
                  "ru-RU"
                )}`
              : "Xaridlar yo'q"
          }
          color="text-blue-700 dark:text-blue-400"
        />
        <Card
          icon={<DollarSign size={18} />}
          label={t("ui__оборот_573e63b6")}
          value={fmt(data.sales.total)}
          sub={`To'landi: ${fmt(data.sales.paid)}`}
          color="text-purple-700 dark:text-purple-400"
        />
        <Card
          icon={<DollarSign size={18} />}
          label={t("ui__долг_7e49b743")}
          value={fmt(debt)}
          sub="To'lanmagan sotuvlar"
          color={
            debt > 0
              ? "text-red-700 dark:text-red-400"
              : "text-green-700 dark:text-green-400"
          }
        />
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
        <h3 className="font-semibold mb-3 text-slate-900 dark:text-slate-100">
          {t("ui__последние_продажи_30_9ceafeb7")}
        </h3>
        {data.recent_sales.length === 0 ? (
          <div className="text-slate-400 dark:text-slate-500 text-center py-6 text-sm">
            {t("ui__продаж_нет_9ed30707")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left">№</th>
                  <th className="px-3 py-2 text-left">{t("ui__дата_8cdd8bb7")}</th>
                  <th className="px-3 py-2 text-left">{t("ui__склад_e8bf999f")}</th>
                  <th className="px-3 py-2 text-right">{t("ui__сумма_cf59ebf9")}</th>
                  <th className="px-3 py-2 text-right">{t("ui__оплачено_6d8c0850")}</th>
                  <th className="px-3 py-2 text-left">{t("ui__статус_7203f7a4")}</th>
                  <th className="px-3 py-2 text-center">—</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_sales.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-slate-200 dark:border-slate-700"
                  >
                    <td className="px-3 py-2 text-slate-900 dark:text-slate-100">
                      {s.doc_number || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {new Date(s.sale_date).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {s.warehouse_name || "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-900 dark:text-slate-100">
                      {fmt(s.total_amount)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                      {fmt(s.paid_amount)}
                    </td>
                    <td className={`px-3 py-2 ${statusColor(s.status)}`}>
                      {statusLabel(s.status)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Link
                        href={`/sale/contract/${s.id}`}
                        className="text-brand-600 dark:text-brand-400 hover:text-brand-700"
                      >
                        <Eye size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
        <h3 className="font-semibold mb-3 text-slate-900 dark:text-slate-100">
          {t("ui__история_операций_50_d4183802")}
        </h3>
        {data.movements.length === 0 ? (
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
