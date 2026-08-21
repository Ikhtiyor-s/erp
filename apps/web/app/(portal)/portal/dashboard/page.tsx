"use client";

import { useEffect, useState } from "react";
import { Wallet, ShoppingCart, AlertCircle, TrendingUp } from "lucide-react";
import { getPortalToken } from "../../portal-auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

type Balance = {
  total_purchases: number;
  total_paid: number;
  debt: number;
  sale_count: number;
};

type Sale = {
  id: string;
  doc_number: string | null;
  date: string;
  total: number;
  paid: number;
  debt: number;
  status: string;
  warehouse: string;
  currency: string;
};

const fmt = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 0 });

export default function PortalDashboard() {
  const [bal, setBal] = useState<Balance | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const tok = getPortalToken();
    if (!tok) return;
    try {
      const [b, s] = await Promise.all([
        fetch(`${API_BASE}/customer-portal/me/balance`, {
          headers: { Authorization: `Bearer ${tok}` },
          signal: AbortSignal.timeout(10000),
        }).then((r) => r.json()),
        fetch(`${API_BASE}/customer-portal/me/sales?limit=5`, {
          headers: { Authorization: `Bearer ${tok}` },
          signal: AbortSignal.timeout(10000),
        }).then((r) => r.json()),
      ]);
      setBal(b);
      setSales(Array.isArray(s) ? s : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="py-20 text-center text-slate-400">Yuklanmoqda...</div>;
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Asosiy</h1>

      {/* Balance cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card icon={<ShoppingCart size={16} />} label="Jami xaridlar"
              value={fmt(bal?.total_purchases || 0)} color="text-blue-600 dark:text-blue-400" />
        <Card icon={<TrendingUp size={16} />} label="Jami to'langan"
              value={fmt(bal?.total_paid || 0)} color="text-green-600 dark:text-green-400" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card icon={<Wallet size={16} />} label="Qarz"
              value={fmt(bal?.debt || 0)}
              color={bal && bal.debt > 0 ? "text-red-600 dark:text-red-400" : "text-slate-500"} />
        <Card icon={<AlertCircle size={16} />} label="Sotuvlar soni"
              value={String(bal?.sale_count || 0)} color="text-slate-700 dark:text-slate-300" />
      </div>

      {/* Recent sales */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">So'nggi sotuvlar</h2>
          <a href="/portal/sales" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
            Hammasi →
          </a>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {sales.length === 0 && (
            <div className="px-4 py-10 text-center text-slate-400">Sotuvlar yo'q</div>
          )}
          {sales.map((s) => (
            <div key={s.id} className="px-4 py-3 flex items-start justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {s.doc_number ? `№ ${s.doc_number}` : `№ ${s.id.slice(0, 8)}`}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {new Date(s.date).toLocaleString("uz-Cyrl-UZ", {
                    year: "numeric", month: "2-digit", day: "2-digit",
                    hour: "2-digit", minute: "2-digit",
                  })} • {s.warehouse}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {fmt(s.total)}
                </div>
                <StatusBadge status={s.status} debt={s.debt} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({ icon, label, value, color }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4">
      <div className={`flex items-center gap-1.5 text-xs ${color}`}>
        {icon}
        <span className="text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className={`text-xl font-bold mt-1 font-mono ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status, debt }: { status: string; debt: number }) {
  const map: Record<string, { bg: string; label: string }> = {
    paid: { bg: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", label: "To'langan" },
    partial: { bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300", label: `Qarz: ${debt.toLocaleString("ru-RU")}` },
    confirmed: { bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", label: "Tasdiqlangan" },
    draft: { bg: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300", label: "Qoralama" },
    cancelled: { bg: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", label: "Bekor" },
  };
  const cfg = map[status] ?? { bg: "bg-slate-100 text-slate-600", label: status };

  return <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg}`}>{cfg.label}</span>;
}
