"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar, User, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Modal, Field, input } from "@/components/ui/modal";

type Plan = {
  id: string;
  customer_id: string;
  customer_name: string;
  total_amount: string;
  paid_amount: string;
  months: number;
  interest_pct: string;
  start_date: string;
  status: string;
  schedule_count: number;
  paid_count: number;
};

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const STATUS: Record<string, { l: string; c: string }> = {
  active: { l: "Faol", c: "bg-blue-100 text-blue-700" },
  completed: { l: "Yakunlangan", c: "bg-emerald-100 text-emerald-700" },
  defaulted: { l: "Qarz", c: "bg-rose-100 text-rose-700" },
  cancelled: { l: "Bekor", c: "bg-slate-100 text-slate-600" },
};

export default function InstallmentsPage() {
  const [rows, setRows] = useState<Plan[]>([]);
  const [filter, setFilter] = useState<string>("active");

  async function load() {
    const r = await api.get<Plan[]>(`/installments?status=${filter}&limit=100`);
    setRows(r.data || []);
  }
  useEffect(() => { load(); }, [filter]);

  return (
    <div className="space-y-5">
      <PageHeader title="Bo'lib to'lash"
        description="Mijozlar uchun ochilgan bo'lib to'lash rejalari" />

      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
        <span className="text-sm text-slate-500">Holat:</span>
        {Object.entries(STATUS).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded text-sm ${filter === k ? "bg-brand-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
            {v.l}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400">Bo'lib to'lash yo'q</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Mijoz</th>
                <th className="text-left px-4 py-2.5">Boshlanish</th>
                <th className="text-right px-4 py-2.5">Jami</th>
                <th className="text-right px-4 py-2.5">To'langan</th>
                <th className="text-center px-4 py-2.5">Oy</th>
                <th className="text-center px-4 py-2.5">% foiz</th>
                <th className="text-center px-4 py-2.5">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map((p) => {
                const pct = Number(p.total_amount) ? Math.round((Number(p.paid_amount) / Number(p.total_amount)) * 100) : 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer"
                    onClick={() => location.href = `/finance/installments/${p.id}`}>
                    <td className="px-4 py-2.5">{p.customer_name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{p.start_date}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmt(p.total_amount)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="font-mono">{fmt(p.paid_amount)}</div>
                      <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded mt-1">
                        <div className="h-1 bg-brand-600 rounded" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">{p.paid_count}/{p.months}</td>
                    <td className="px-4 py-2.5 text-center">{p.interest_pct}%</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${STATUS[p.status]?.c || "bg-slate-100"}`}>
                        {STATUS[p.status]?.l || p.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
