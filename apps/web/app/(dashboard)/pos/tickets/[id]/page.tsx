"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";

type Item = {
  id: number;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: string;
  price: string;
  discount: string;
  notes?: string;
};
type Ticket = {
  id: string;
  ticket_name: string;
  table_number?: string;
  total_amount: string;
  status: string;
  items: Item[];
};
type Product = { id: string; name: string; sku?: string; sale_price: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [t, setT] = useState<Ticket | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);

  async function load() {
    const r = await api.get<Ticket>(`/open-tickets/${id}`);
    setT(r.data);
  }
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const tm = setTimeout(async () => {
      const r = await api.get<Product[]>(`/warehouse/products?q=${encodeURIComponent(q)}&limit=10`);
      setResults(r.data || []);
    }, 250);
    return () => clearTimeout(tm);
  }, [q]);

  async function addItem(p: Product) {
    await api.post(`/open-tickets/${id}/items`, {
      product_id: p.id, quantity: 1, price: p.sale_price, discount: 0,
    });
    setQ("");
    setResults([]);
    load();
  }

  async function remove(iid: number) {
    await api.delete(`/open-tickets/${id}/items/${iid}`);
    load();
  }

  async function close() {
    if (!confirm("Ticket yopilsinmi?")) return;
    await api.post(`/open-tickets/${id}/close`, {});
    toast.success("Yopildi");
    router.push("/pos/tickets");
  }

  if (!t) return <div className="py-20 text-center text-slate-400">Yuklanmoqda...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push("/pos/tickets")} className="text-sm text-slate-500 flex items-center gap-1">
          <ArrowLeft size={14} /> Ortga
        </button>
        <button onClick={close} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm flex items-center gap-1">
          <CheckCircle size={14} /> Yopish va to'lov
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <div className="font-bold text-lg">{t.ticket_name}</div>
        {t.table_number && <div className="text-sm text-slate-500">Stol № {t.table_number}</div>}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Mahsulot qidirish..."
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md text-sm" />
        {results.length > 0 && (
          <div className="mt-2 max-h-60 overflow-auto border border-slate-200 dark:border-slate-700 rounded-md divide-y divide-slate-100 dark:divide-slate-700">
            {results.map((p) => (
              <button key={p.id} onClick={() => addItem(p)}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between">
                <span className="text-sm">{p.name}</span>
                <span className="font-mono text-sm text-brand-600">{fmt(p.sale_price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 font-semibold">Buyurtma</div>
        {t.items.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">Bo'sh</div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {t.items.map((it) => (
              <li key={it.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium">{it.product_name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    {it.quantity} x {fmt(it.price)} = {fmt(Number(it.quantity) * Number(it.price))}
                  </div>
                </div>
                <button onClick={() => remove(it.id)} className="text-rose-600 p-1">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-between font-semibold">
          <span>Jami:</span>
          <span className="font-mono">{fmt(t.total_amount)}</span>
        </div>
      </div>
    </div>
  );
}
