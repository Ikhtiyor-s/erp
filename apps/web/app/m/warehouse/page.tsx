"use client";

import { useEffect, useState } from "react";
import { Search, Package, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { BarcodeScanner } from "@/components/mobile/barcode-scanner";

type Product = { id: string; name: string; sku?: string; sale_price: string; total_stock?: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function MobileWarehouse() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Product[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: "80" });
      if (q) p.set("q", q);
      const r = await api.get<Product[]>(`/warehouse/products?${p}`);
      setRows(r.data || []);
    } catch (e) {
      toast.error(getErrorMessage(e, "Mahsulotlarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]);

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-xl font-bold px-1">Sklad — Mahsulotlar</h1>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Mahsulot, SKU, shtrix-kod..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm" />
        </div>
        <button onClick={() => setScanOpen(true)}
          aria-label="Shtrix-kod skanerlash"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-brand-600 text-white rounded-md">
          <ScanLine size={20} />
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">Yuklanmoqda...</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <Package size={48} className="mx-auto mb-3 opacity-40" />
          Mahsulot yo'q
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((p) => (
              <li key={p.id} className="px-3 py-2.5 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{p.sku || "—"}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono">{fmt(p.sale_price)}</div>
                  <div className="text-xs text-slate-500 font-mono">Qoldiq: {fmt(p.total_stock)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)}
        onDetect={(code) => { setScanOpen(false); setQ(code); }} />
    </div>
  );
}
