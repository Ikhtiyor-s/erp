"use client";

import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { api } from "@/lib/api";

type Sale = {
  id: string;
  doc_number?: string;
  date: string;
  total: string;
  paid: string;
  debt: string;
  status: string;
  customer_name?: string;
};

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

const STATUS: Record<string, { l: string; c: string }> = {
  paid: { l: "To'langan", c: "bg-emerald-100 text-emerald-700" },
  partial: { l: "Qisman", c: "bg-amber-100 text-amber-700" },
  confirmed: { l: "Tasdiqlangan", c: "bg-teal-100 text-teal-700" },
  draft: { l: "Qoralama", c: "bg-slate-100 text-slate-600" },
  cancelled: { l: "Bekor", c: "bg-rose-100 text-rose-700" },
};

export default function MobileSales() {
  const [rows, setRows] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<Sale[]>("/sale/sales?limit=50");
      setRows(r.data || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-xl font-bold px-1">Sotuvlar</h1>

      {loading ? (
        <div className="py-10 text-center text-slate-400">Yuklanmoqda...</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <ShoppingCart size={48} className="mx-auto mb-3 opacity-40" />
          Sotuvlar yo'q
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((s) => (
              <li key={s.id} className="px-3 py-2.5 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    № {s.doc_number || s.id.slice(0, 8)}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {new Date(s.date).toLocaleString("uz-Cyrl-UZ", { dateStyle: "short", timeStyle: "short" })}
                    {s.customer_name && <> • {s.customer_name}</>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-sm">{fmt(s.total)}</div>
                  <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded ${STATUS[s.status]?.c || "bg-slate-100"}`}>
                    {STATUS[s.status]?.l || s.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
