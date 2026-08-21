"use client";

import { useEffect, useState } from "react";
import { Search, Phone, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";

type Customer = { id: string; name: string; phone?: string; debt?: string; cashback_balance?: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

export default function MobileCustomers() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: "100" });
      if (q.trim()) p.set("q", q);
      const r = await api.get<Customer[]>(`/customer/customers?${p}`);
      setRows(r.data || []);
    } catch (e) {
      toast.error(getErrorMessage(e, "Mijozlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]);

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-xl font-bold px-1">Mijozlar</h1>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Mijoz qidirish..."
          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm" />
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">Yuklanmoqda...</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <Users size={48} className="mx-auto mb-3 opacity-40" />
          Mijoz topilmadi
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((c) => (
              <li key={c.id} className="px-3 py-3 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="text-xs text-brand-600 flex items-center gap-1 mt-0.5">
                      <Phone size={11} /> {c.phone}
                    </a>
                  )}
                </div>
                <div className="text-right">
                  {Number(c.debt || 0) > 0 && (
                    <div className="text-xs text-rose-600 font-mono">Qarz: {fmt(c.debt)}</div>
                  )}
                  {Number(c.cashback_balance || 0) > 0 && (
                    <div className="text-xs text-emerald-600 font-mono">Cashback: {fmt(c.cashback_balance)}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
