"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type Payment = {
  id: number;
  movement_date: string;
  amount: string;
  customer_name?: string;
  customer_id?: string;
  sale_doc?: string;
  sale_id?: string;
  sale_total?: string;
  description?: string;
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export default function CustomerPaymentsPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: "",
    date_from: monthAgo(),
    date_to: today(),
  });

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("limit", "300");
      if (filters.date_from) p.set("date_from", filters.date_from);
      if (filters.date_to) p.set("date_to", filters.date_to);
      setRows(
        (await api.get<Payment[]>(`/sale/customer-payments?${p}`)).data
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!filters.q) return rows;
    const q = filters.q.toLowerCase();
    return rows.filter((r) =>
      (
        (r.customer_name || "") +
        " " +
        (r.sale_doc || "") +
        " " +
        (r.description || "")
      )
        .toLowerCase()
        .includes(q)
    );
  }, [rows, filters.q]);

  const total = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);
  const byCustomer = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      const k = r.customer_name || "Chakana";
      m.set(k, (m.get(k) || 0) + Number(r.amount || 0));
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const columns: Column<Payment>[] = [
    {
      key: "movement_date",
      header: t("ui__дата_8cdd8bb7"),
      width: "160px",
      render: (r) => new Date(r.movement_date).toLocaleString("ru-RU"),
    },
    {
      key: "customer_name",
      header: t("ui__клиент_4af22f2d"),
      render: (r) => r.customer_name || "Chakana",
    },
    {
      key: "sale_doc",
      header: t("ui__продажа_78b786c5"),
      width: "160px",
      render: (r) => r.sale_doc || r.sale_id?.slice(0, 8) || "—",
    },
    {
      key: "amount",
      header: t("ui__оплачено_6d8c0850"),
      align: "right",
      width: "160px",
      render: (r) => (
        <span className="font-mono text-green-700 dark:text-green-400">
          +{fmt(r.amount)}
        </span>
      ),
    },
    {
      key: "description",
      header: t("ui__примечание_686eb72b"),
      render: (r) => r.description || "—",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__платежи_клиентов_d6f0f5ab")}
        description={t("ui__поступления_оплат_по_продажам_cfa21a31")}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="sm:col-span-2 relative">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_клиент_продажа_заметки_d0c07ddc")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-slate-400"
          />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__поиск_b84a8f87")}
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
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
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
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
        <div className="flex items-end">
          <button
            onClick={load}
            className="w-full px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
          >
            {t("ui__применить_2cd84411")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          label={t("ui__сумма_оплат_803d937e")}
          value={fmt(total)}
          sub={`${filtered.length} ta to'lov`}
          color="text-green-700 dark:text-green-400"
        />
        <Card
          label={t("ui__топ_клиент_7cd1145d")}
          value={byCustomer[0]?.[0] || "—"}
          sub={byCustomer[0] ? fmt(byCustomer[0][1]) : ""}
        />
        <Card
          label={t("ui__клиентов_a8c15ba0")}
          value={String(byCustomer.length)}
          sub="turli"
        />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <DataTable columns={columns} rows={filtered} loading={loading} />
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-3">
        {loading && <li className="text-center text-sm text-slate-400 py-8">{t("ui__загрузка_43e40d49")}</li>}
        {!loading && filtered.length === 0 && <li className="text-center text-sm text-slate-400 py-8">{t("ui__нет_данных_dee9a2d8")}</li>}
        {filtered.map((r) => (
          <li key={r.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{r.customer_name || "Chakana"}</p>
                {r.sale_doc && <p className="text-xs text-slate-500">{t("ui__продажа_78b786c5")}: {r.sale_doc}</p>}
                {r.description && <p className="text-xs text-slate-400 truncate">{r.description}</p>}
                <p className="text-xs text-slate-400">{new Date(r.movement_date).toLocaleString("ru-RU")}</p>
              </div>
              <div className="font-mono font-semibold text-green-700 dark:text-green-400 shrink-0">
                +{fmt(r.amount)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  color = "text-slate-900 dark:text-slate-100",
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-xl font-bold mt-1 font-mono ${color}`}>{value}</div>
      <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        {sub}
      </div>
    </div>
  );
}
