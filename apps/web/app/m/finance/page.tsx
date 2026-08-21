"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, ArrowDown, ArrowUp, Calendar, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

export default function MobileFinance() {
  const [boxes, setBoxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any[]>("/finance/cashboxes")
      .then((r) => setBoxes(r.data || []))
      .catch((e) => toast.error(getErrorMessage(e, "Kassalarni yuklab bo'lmadi")))
      .finally(() => setLoading(false));
  }, []);

  const totalBalance = boxes.reduce((s, b) => s + (Number(b.balance) || 0), 0);

  return (
    <div className="p-3 space-y-4">
      <h1 className="text-xl font-bold px-1">Moliya</h1>

      <div className="bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-2xl p-5">
        <div className="text-xs opacity-80 uppercase">Umumiy balans</div>
        <div className="text-3xl font-bold font-mono mt-1">{fmt(totalBalance)}</div>
        <div className="text-xs opacity-80 mt-1">{boxes.length} ta kassa</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/m/cashbox" className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <Calendar size={20} className="text-brand-600" />
          <span className="text-sm font-medium">Smena</span>
        </Link>
        <Link href="/m/finance/installments" className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <CreditCard size={20} className="text-teal-600" />
          <span className="text-sm font-medium">Bo'lib to'lash</span>
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 font-semibold">Kassalar</div>
        {loading ? (
          <div className="py-10 text-center text-slate-400 text-sm">Yuklanmoqda...</div>
        ) : boxes.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">Kassalar yo'q</div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {boxes.map((b) => (
              <li key={b.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet size={16} className="text-slate-400" />
                  <span className="text-sm">{b.name}</span>
                </div>
                <span className="font-mono font-semibold text-sm">{fmt(b.balance || 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
