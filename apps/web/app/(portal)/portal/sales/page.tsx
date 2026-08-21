"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { getPortalToken } from "../../portal-auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

type Sale = {
  id: string;
  doc_number: string | null;
  date: string;
  total: number;
  paid: number;
  debt: number;
  status: string;
  warehouse: string;
};

const fmt = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 0 });

export default function PortalSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const tok = getPortalToken();
    try {
      const r = await fetch(`${API_BASE}/customer-portal/me/sales?limit=100`, {
        headers: { Authorization: `Bearer ${tok}` },
        signal: AbortSignal.timeout(10000),
      });
      const data = await r.json();
      setSales(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id: string) {
    const tok = getPortalToken();
    const r = await fetch(`${API_BASE}/customer-portal/me/sales/${id}`, {
      headers: { Authorization: `Bearer ${tok}` },
      signal: AbortSignal.timeout(10000),
    });
    setSelected(await r.json());
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="py-20 text-center text-slate-400">Yuklanmoqda...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
        Sotuvlar tarixi ({sales.length})
      </h1>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        {sales.length === 0 && (
          <div className="px-4 py-12 text-center text-slate-400">Sotuvlar yo'q</div>
        )}
        {sales.map((s) => (
          <button
            key={s.id}
            onClick={() => openDetail(s.id)}
            className="w-full px-4 py-3 flex items-start justify-between hover:bg-slate-50 dark:hover:bg-slate-900/30 text-left"
          >
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {s.doc_number ? `№ ${s.doc_number}` : `№ ${s.id.slice(0, 8)}`}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {new Date(s.date).toLocaleDateString("uz-Cyrl-UZ")} • {s.warehouse}
              </div>
              <StatusBadge status={s.status} debt={s.debt} />
            </div>
            <div className="text-right ml-3">
              <div className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">
                {fmt(s.total)}
              </div>
              {s.debt > 0 && (
                <div className="text-xs text-red-600 dark:text-red-400 font-mono">
                  Qarz: {fmt(s.debt)}
                </div>
              )}
              <ChevronRight size={14} className="inline text-slate-400 mt-1" />
            </div>
          </button>
        ))}
      </div>

      {/* Detail modal */}
      <Modal
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected ? `Buyurtma tafsiloti — № ${selected.head.doc_number || selected.head.id.slice(0, 8)}` : "Buyurtma tafsiloti"}
        size="md"
      >
        {selected && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">Sana</div>
                <div>{new Date(selected.head.sale_date).toLocaleString("uz-Cyrl-UZ")}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Ombor</div>
                <div>{selected.head.warehouse_name || "—"}</div>
              </div>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
              <div className="text-xs text-slate-500 mb-2">MAHSULOTLAR</div>
              {selected.items.map((it: any, i: number) => (
                <div key={i} className="flex items-start justify-between py-1.5 text-sm">
                  <div className="flex-1">
                    <div className="text-slate-900 dark:text-slate-100">{it.product_name}</div>
                    <div className="text-xs text-slate-500">
                      {it.quantity} x {fmt(Number(it.price))}
                    </div>
                  </div>
                  <div className="font-mono text-slate-900 dark:text-slate-100">
                    {fmt(Number(it.amount))}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Jami:</span>
                <span className="font-mono font-semibold">{fmt(Number(selected.head.total_amount))}</span>
              </div>
              <div className="flex justify-between text-green-700 dark:text-green-400">
                <span>To'langan:</span>
                <span className="font-mono">{fmt(Number(selected.head.paid_amount))}</span>
              </div>
              {Number(selected.head.total_amount) - Number(selected.head.paid_amount) > 0 && (
                <div className="flex justify-between text-red-600 dark:text-red-400 font-semibold">
                  <span>Qarz:</span>
                  <span className="font-mono">
                    {fmt(Number(selected.head.total_amount) - Number(selected.head.paid_amount))}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatusBadge({ status, debt }: { status: string; debt: number }) {
  const map: Record<string, { bg: string; label: string }> = {
    paid: { bg: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", label: "To'langan" },
    partial: { bg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300", label: "Qisman" },
    confirmed: { bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", label: "Tasdiqlangan" },
    draft: { bg: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300", label: "Qoralama" },
    cancelled: { bg: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", label: "Bekor" },
  };
  const cfg = map[status] ?? { bg: "bg-slate-100 text-slate-600", label: status };
  // debt currently unused in this view, kept for prop compatibility
  void debt;
  return <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg}`}>{cfg.label}</span>;
}
