"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Truck,
  DollarSign,
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatWidget } from "@/components/ui/stat-widget";

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
    created_at?: string;
    is_active?: boolean;
  };
  balance: { bal: string; cnt: number };
  supplies: { cnt: number; total: string; last_supply?: string };
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
  recent_supplies: {
    id: string;
    doc_number?: string;
    supply_date: string;
    total_amount: string;
    status: string;
    warehouse_name?: string;
  }[];
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const statusLabel = (s: string) =>
  ({ draft: "Qoralama", received: "Olindi", cancelled: "Bekor qilindi" }[s] || s);

const STATUS_TONE: Record<string, "neutral" | "success" | "danger"> = {
  draft: "neutral",
  received: "success",
  cancelled: "danger",
};

export default function SupplierProfilePage() {
  const t = useTranslations("ui");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<Profile>(`/supplier/suppliers/${id}`)
      .then((r) => {
        if (active) setData(r.data);
      })
      .catch((e) => {
        if (active) setError(getErrorMessage(e, "Ma'lumotlarni yuklashda xatolik"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-400">
        {t("ui__загрузка_43e40d49")}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" icon={ArrowLeft} onClick={() => router.back()}>
          {t("ui__назад_2b0b0225")}
        </Button>
        <div className="rounded-md bg-danger-50 dark:bg-danger-500/15 border border-danger-500/30 px-4 py-3 text-[13px] text-danger-700 dark:text-danger-500">
          {error || "Ma'lumot topilmadi"}
        </div>
      </div>
    );
  }

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
            <Truck size={28} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100">
                {h.name}
              </h1>
              <code className="text-xs text-ink-500 dark:text-ink-400 bg-ink-100 dark:bg-ink-800 px-2 py-0.5 rounded">
                {h.uuid_label}
              </code>
              {h.is_active === false && (
                <Badge tone="danger">{t("ui__неактивен_28911a13")}</Badge>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
              {h.code && (
                <div>
                  <span className="text-ink-500 dark:text-ink-400">
                    {t("ui__код_e99a9afe")}
                  </span>{" "}
                  <span className="text-ink-900 dark:text-ink-100">
                    {h.code}
                  </span>
                </div>
              )}
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
              {h.tin && (
                <div>
                  <span className="text-ink-500 dark:text-ink-400">
                    {t("ui__инн_66d33a57")}
                  </span>{" "}
                  <span className="text-ink-900 dark:text-ink-100">
                    {h.tin}
                  </span>
                </div>
              )}
              {h.address && (
                <div className="col-span-2 md:col-span-4">
                  <span className="text-ink-500 dark:text-ink-400">
                    {t("ui__адрес_53d0666d")}
                  </span>{" "}
                  <span className="text-ink-900 dark:text-ink-100">
                    {h.address}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatWidget
          label={t("ui__баланс_95dcad97")}
          value={fmt(data.balance.bal)}
          subValue={`${data.balance.cnt} operatsiya`}
          icon={DollarSign}
          color={balanceVal > 0 ? "danger" : balanceVal < 0 ? "success" : "ink"}
          mono
        />
        <StatWidget
          label={t("ui__поставок_b92e2a57")}
          value={data.supplies.cnt}
          subValue={
            data.supplies.last_supply
              ? `Последняя: ${new Date(data.supplies.last_supply).toLocaleDateString("ru-RU")}`
              : "Yetkazib berishlar yo'q"
          }
          icon={Package}
          color="info"
          mono
        />
        <StatWidget
          label={t("ui__оборот_573e63b6")}
          value={fmt(data.supplies.total)}
          subValue="Barcha yetkazib berishlar summasi"
          icon={DollarSign}
          color="purple"
          mono
        />
      </div>

      <Card padding="none">
        <CardHeader title={t("ui__последние_поставки_30_0234c26f")} />
        {data.recent_supplies.length === 0 ? (
          <div className="text-ink-400 dark:text-ink-500 text-center py-6 text-sm">
            {t("ui__поставок_нет_1160b6f1")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900">
                <tr className="text-ink-500 dark:text-ink-400 text-[11px] uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60">
                  <th className="px-3 py-2 text-left font-medium">№</th>
                  <th className="px-3 py-2 text-left font-medium">{t("ui__дата_8cdd8bb7")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("ui__склад_e8bf999f")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("ui__сумма_cf59ebf9")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("ui__статус_7203f7a4")}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_supplies.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-ink-100 dark:border-ink-800/40 last:border-0 hover:bg-ink-50/60 dark:hover:bg-ink-900/30"
                  >
                    <td className="px-3 py-2.5 text-ink-900 dark:text-ink-100">
                      {s.doc_number || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-ink-700 dark:text-ink-300">
                      {new Date(s.supply_date).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-3 py-2.5 text-ink-700 dark:text-ink-300">
                      {s.warehouse_name || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-ink-900 dark:text-ink-100">
                      {fmt(s.total_amount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={STATUS_TONE[s.status] ?? "neutral"}>
                        {statusLabel(s.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card padding="none">
        <CardHeader title={t("ui__история_операций_50_d4183802")} />
        {data.movements.length === 0 ? (
          <div className="text-ink-400 dark:text-ink-500 text-center py-6 text-sm">
            {t("ui__операций_нет_97f2b4ae")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900">
                <tr className="text-ink-500 dark:text-ink-400 text-[11px] uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60">
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
