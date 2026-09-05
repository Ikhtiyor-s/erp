"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";

type BalanceRow = {
  customer_id: string;
  name: string;
  balance: string;
};

type FilterKey = "all" | "debtor" | "creditor";

const fmt = (v: string | number) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

function SkeletonCard() {
  return (
    <li className="px-4 py-3 animate-pulse">
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-2" />
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
    </li>
  );
}

export default function DebtorsPage() {
  const t = useTranslations("mobile.debtors");
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<BalanceRow[]>("/customer/balance");
      setRows(r.data || []);
    } catch (e) {
      toast.error(getErrorMessage(e, t("err_load")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    const bal = Number(r.balance);
    if (filter === "debtor" && bal >= 0) return false;
    if (filter === "creditor" && bal <= 0) return false;
    if (q.trim()) {
      return r.name.toLowerCase().includes(q.toLowerCase());
    }
    return true;
  });

  const totalDebt = rows
    .filter((r) => Number(r.balance) < 0)
    .reduce((s, r) => s + Math.abs(Number(r.balance)), 0);

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: t("all") },
    { key: "debtor", label: t("only_debtor") },
    { key: "creditor", label: t("only_creditor") },
  ];

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <span className="text-sm font-mono bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded-full">
          {fmt(totalDebt)}
        </span>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-brand-600 text-white"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        {loading ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {[1, 2, 3, 4, 5].map((n) => (
              <SkeletonCard key={n} />
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Users size={48} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">{t("no_debts")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {filtered
              .sort((a, b) => Number(a.balance) - Number(b.balance))
              .map((row) => {
                const bal = Number(row.balance);
                return (
                  <li key={row.customer_id}>
                    <Link
                      href={`/m/finance/debtors/${row.customer_id}`}
                      className="flex items-center justify-between px-4 py-3 active:bg-slate-50 dark:active:bg-slate-700/50 min-h-[56px]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{row.name}</div>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <div
                          className={`font-mono font-bold text-base ${
                            bal < 0
                              ? "text-rose-600 dark:text-rose-400"
                              : bal > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-slate-500"
                          }`}
                        >
                          {bal < 0 ? "-" : bal > 0 ? "+" : ""}
                          {fmt(Math.abs(bal))}
                        </div>
                        {bal !== 0 && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {t("debt_amount")}
                          </div>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </div>
  );
}
