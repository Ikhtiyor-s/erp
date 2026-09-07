"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, ArrowLeft, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { input } from "@/components/ui/modal";

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
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);

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

  async function confirmClose() {
    setClosing(true);
    try {
      await api.post(`/open-tickets/${id}/close`, {});
      toast.success("Yopildi");
      router.push("/pos/tickets");
    } finally {
      setClosing(false);
    }
  }

  if (!t) return <div className="py-20 text-center text-ink-400">Yuklanmoqda...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => router.push("/pos/tickets")}>
          Ortga
        </Button>
        <Button variant="success" size="md" icon={CheckCircle} onClick={() => setCloseOpen(true)}>
          Yopish va to'lov
        </Button>
      </div>

      <Card padding="md">
        <div className="font-bold text-lg text-ink-900 dark:text-ink-100">{t.ticket_name}</div>
        {t.table_number && <div className="text-sm text-ink-500">Stol № {t.table_number}</div>}
      </Card>

      <Card padding="md">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Mahsulot qidirish..."
          className={input} />
        {results.length > 0 && (
          <div className="mt-2 max-h-60 overflow-auto border border-ink-200 dark:border-ink-800 rounded-md divide-y divide-ink-100 dark:divide-ink-800">
            {results.map((p) => (
              <button key={p.id} type="button" onClick={() => addItem(p)}
                className="w-full px-3 py-2 text-left hover:bg-ink-50 dark:hover:bg-ink-800 flex items-center justify-between">
                <span className="text-sm text-ink-900 dark:text-ink-100">{p.name}</span>
                <span className="font-mono text-sm text-brand-600">{fmt(p.sale_price)}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card padding="none">
        <CardHeader title="Buyurtma" />
        {t.items.length === 0 ? (
          <div className="py-10 text-center text-ink-400 text-sm">Bo'sh</div>
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {t.items.map((it) => (
              <li key={it.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-ink-900 dark:text-ink-100">{it.product_name}</div>
                  <div className="text-xs text-ink-500 font-mono mt-0.5">
                    {it.quantity} x {fmt(it.price)} = {fmt(Number(it.quantity) * Number(it.price))}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  icon={Trash2}
                  onClick={() => remove(it.id)}
                  className="text-danger-600 dark:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15"
                />
              </li>
            ))}
          </ul>
        )}
        <div className="px-4 py-3 border-t border-ink-200 dark:border-ink-800 flex justify-between font-semibold text-ink-900 dark:text-ink-100">
          <span>Jami:</span>
          <span className="font-mono">{fmt(t.total_amount)}</span>
        </div>
      </Card>

      <ConfirmDialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        onConfirm={confirmClose}
        title="Ticketni yopish"
        message="Ticket yopilsinmi va to'lov amalga oshirilsinmi?"
        confirmLabel="Yopish"
        cancelLabel="Bekor"
        variant="warning"
        loading={closing}
      />
    </div>
  );
}
