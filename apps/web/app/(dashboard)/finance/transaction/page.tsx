"use client";

import { useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Search, Scale } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatWidget } from "@/components/ui/stat-widget";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Movement = {
  id: number;
  cashbox_id: number;
  cashbox_name?: string;
  direction: "in" | "out";
  amount: string;
  currency_id?: number;
  currency_code?: string;
  description?: string;
  movement_date: string;
  payment_type_id?: number;
  payment_type_name?: string;
  customer_id?: string;
  customer_name?: string;
  supplier_id?: string;
  supplier_name?: string;
  employee_id?: string;
  employee_name?: string;
  sale_id?: string;
  sale_doc_number?: string;
  created_by_name?: string;
};
type Cashbox = { id: number; name: string };
type PaymentType = { id: number; name: string };

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export default function TransactionsPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Movement[]>([]);
  const [boxes, setBoxes] = useState<Cashbox[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: "",
    cashbox_id: "" as number | "",
    direction: "",
    payment_type_id: "" as number | "",
    date_from: monthAgo(),
    date_to: today(),
  });

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.q) p.set("q", filters.q);
      if (filters.cashbox_id) p.set("cashbox_id", String(filters.cashbox_id));
      if (filters.direction) p.set("direction", filters.direction);
      if (filters.payment_type_id)
        p.set("payment_type_id", String(filters.payment_type_id));
      if (filters.date_from) p.set("date_from", filters.date_from);
      if (filters.date_to) p.set("date_to", filters.date_to);
      p.set("limit", "300");
      setRows((await api.get<Movement[]>(`/finance/movements?${p}`)).data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      api
        .get<Cashbox[]>("/finance/cashboxes")
        .then((r) => setBoxes(r.data))
        .catch(() => {}),
      api
        .get<PaymentType[]>("/reference/payment-types")
        .then((r) => setPaymentTypes(r.data))
        .catch(() => {}),
    ]);
    load();
  }, []);

  const totalIn = rows
    .filter((r) => r.direction === "in")
    .reduce((s, r) => s + Number(r.amount), 0);
  const totalOut = rows
    .filter((r) => r.direction === "out")
    .reduce((s, r) => s + Number(r.amount), 0);

  function counterparty(r: Movement) {
    if (r.customer_name) return `Mijoz: ${r.customer_name}`;
    if (r.supplier_name) return `Yetkazib beruvchi: ${r.supplier_name}`;
    if (r.employee_name) return `Xodim: ${r.employee_name}`;
    if (r.sale_doc_number) return `Sotuv №${r.sale_doc_number}`;
    return "—";
  }

  const cols: Column<Movement>[] = [
    {
      key: "movement_date",
      header: t("ui__дата_8cdd8bb7"),
      width: "160px",
      render: (r) => new Date(r.movement_date).toLocaleString("ru-RU"),
    },
    {
      key: "cashbox_id",
      header: t("ui__касса_c85fd621"),
      width: "160px",
      render: (r) => r.cashbox_name || `#${r.cashbox_id}`,
    },
    {
      key: "direction",
      header: t("ui__тип_345805b8"),
      align: "center",
      width: "120px",
      render: (r) =>
        r.direction === "in" ? (
          <span className="text-success-600 dark:text-success-500 inline-flex items-center gap-1">
            <ArrowDownCircle size={14} /> {t("ui__приход_ebf29487")}
          </span>
        ) : (
          <span className="text-danger-600 dark:text-danger-500 inline-flex items-center gap-1">
            <ArrowUpCircle size={14} /> {t("ui__расход_6068400a")}
          </span>
        ),
    },
    {
      key: "amount",
      header: t("ui__сумма_cf59ebf9"),
      align: "right",
      width: "160px",
      render: (r) => (
        <span
          className={`font-mono ${
            r.direction === "in"
              ? "text-success-700 dark:text-success-500"
              : "text-danger-700 dark:text-danger-500"
          }`}
        >
          {r.direction === "in" ? "+" : "−"}
          {fmt(r.amount)} {r.currency_code || ""}
        </span>
      ),
    },
    {
      key: "payment_type_name",
      header: t("ui__способ_c5fe4929"),
      width: "120px",
      render: (r) => r.payment_type_name || "—",
    },
    {
      key: "customer_id" as any,
      header: t("ui__контрагент_aad01fb1"),
      width: "200px",
      render: (r) => counterparty(r),
    },
    {
      key: "description",
      header: t("ui__описание_38ca0af8"),
      render: (r) => r.description || "—",
    },
    {
      key: "created_by_name",
      header: t("ui__создал_3a6d92d4"),
      width: "140px",
      render: (r) => r.created_by_name || "—",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__транзакции_6f99d235")} description={t("ui__все_движения_по_кассам_388e8147")} />

      <Card padding="md">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="sm:col-span-2 relative">
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
              {t("ui__поиск_описание_контрагент_a94826f7")}
            </label>
            <Search
              size={14}
              className="absolute left-2.5 top-[34px] text-ink-400"
            />
            <input
              className={`${input} pl-8`}
              placeholder={t("ui__поиск_b84a8f87")}
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
          <div>
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
              {t("ui__касса_c85fd621")}
            </label>
            <select
              className={input}
              value={filters.cashbox_id}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  cashbox_id: e.target.value ? Number(e.target.value) : "",
                })
              }
            >
              <option value="">{t("ui__все_a07b234e")}</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
              {t("ui__тип_345805b8")}
            </label>
            <select
              className={input}
              value={filters.direction}
              onChange={(e) =>
                setFilters({ ...filters, direction: e.target.value })
              }
            >
              <option value="">{t("ui__все_a07b234e")}</option>
              <option value="in">{t("ui__приход_ebf29487")}</option>
              <option value="out">{t("ui__расход_6068400a")}</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
              {t("ui__способ_оплаты_4dbf0c67")}
            </label>
            <select
              className={input}
              value={filters.payment_type_id}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  payment_type_id: e.target.value ? Number(e.target.value) : "",
                })
              }
            >
              <option value="">{t("ui__все_a07b234e")}</option>
              {paymentTypes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
              {t("ui__с_даты_09fc6619")}
            </label>
            <input
              type="date"
              className={input}
              value={filters.date_from}
              onChange={(e) =>
                setFilters({ ...filters, date_from: e.target.value })
              }
            />
          </div>
          <div>
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
              {t("ui__по_дату_760bcfc8")}
            </label>
            <input
              type="date"
              className={input}
              value={filters.date_to}
              onChange={(e) =>
                setFilters({ ...filters, date_to: e.target.value })
              }
            />
          </div>
          <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-6 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setFilters({
                  q: "",
                  cashbox_id: "",
                  direction: "",
                  payment_type_id: "",
                  date_from: monthAgo(),
                  date_to: today(),
                });
                setTimeout(load, 0);
              }}
            >
              {t("ui__сброс_1b421ddb")}
            </Button>
            <Button onClick={load}>
              {t("ui__применить_2cd84411")}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <StatWidget
          label={t("ui__приход_ebf29487")}
          value={fmt(totalIn)}
          icon={ArrowDownCircle}
          color="success"
          mono
        />
        <StatWidget
          label={t("ui__расход_6068400a")}
          value={fmt(totalOut)}
          icon={ArrowUpCircle}
          color="danger"
          mono
        />
        <StatWidget
          label={t("ui__сальдо_508d1e7a")}
          value={fmt(totalIn - totalOut)}
          icon={Scale}
          color={totalIn >= totalOut ? "success" : "danger"}
          mono
        />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <DataTable columns={cols} rows={rows} loading={loading} />
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-3">
        {loading && <li className="text-center text-sm text-ink-400 py-8">{t("ui__загрузка_43e40d49")}</li>}
        {!loading && rows.length === 0 && <li className="text-center text-sm text-ink-400 py-8">{t("ui__нет_данных_dee9a2d8")}</li>}
        {rows.map((r) => (
          <li key={r.id} className="bg-white dark:bg-ink-950 rounded-xl border border-ink-200/60 dark:border-ink-800/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {r.direction === "in" ? (
                    <span className="text-success-600 dark:text-success-500 inline-flex items-center gap-1 text-sm">
                      <ArrowDownCircle size={14} /> {t("ui__приход_ebf29487")}
                    </span>
                  ) : (
                    <span className="text-danger-600 dark:text-danger-500 inline-flex items-center gap-1 text-sm">
                      <ArrowUpCircle size={14} /> {t("ui__расход_6068400a")}
                    </span>
                  )}
                  <span className="text-xs text-ink-400">{r.cashbox_name || `#${r.cashbox_id}`}</span>
                </div>
                <p className={`font-mono font-semibold text-base mt-0.5 ${r.direction === "in" ? "text-success-700 dark:text-success-500" : "text-danger-700 dark:text-danger-500"}`}>
                  {r.direction === "in" ? "+" : "−"}{fmt(r.amount)} {r.currency_code || ""}
                </p>
                {r.description && <p className="text-xs text-ink-500 dark:text-ink-400 truncate">{r.description}</p>}
                <p className="text-xs text-ink-400 mt-0.5">{counterparty(r)}</p>
              </div>
              <div className="text-right text-xs text-ink-400 shrink-0">
                <div className="font-mono">{new Date(r.movement_date).toLocaleDateString("ru-RU")}</div>
                {r.payment_type_name && <div>{r.payment_type_name}</div>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
