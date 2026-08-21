"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Users, Coffee, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Modal, Field, input } from "@/components/ui/modal";

type Ticket = {
  id: string;
  ticket_name: string;
  table_number?: string;
  guest_count?: number;
  customer_name?: string;
  warehouse_name?: string;
  notes?: string;
  status: "open" | "closed";
  total_amount: string;
  item_count: number;
  opened_at: string;
};
type Warehouse = { id: number; name: string };
type Cashbox = { id: number; name: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function OpenTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [whs, setWhs] = useState<Warehouse[]>([]);
  const [boxes, setBoxes] = useState<Cashbox[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    ticket_name: "", table_number: "", guest_count: 1,
    warehouse_id: null as number | null, cashbox_id: null as number | null, notes: "",
  });

  async function load() {
    const r = await api.get<Ticket[]>("/open-tickets?status=open");
    setTickets(r.data || []);
  }
  useEffect(() => {
    load();
    api.get<Warehouse[]>("/warehouse/warehouses").then((r) => setWhs(r.data || [])).catch(() => {});
    api.get<Cashbox[]>("/finance/cashboxes").then((r) => setBoxes(r.data || [])).catch(() => {});
  }, []);

  async function create() {
    if (!form.ticket_name.trim()) return toast.error("Nom kerak");
    await api.post("/open-tickets", form);
    toast.success("Yaratildi");
    setOpen(false);
    setForm({ ...form, ticket_name: "", table_number: "" });
    load();
  }

  async function close(tid: string) {
    if (!confirm("Ticket yopilsinmi?")) return;
    await api.post(`/open-tickets/${tid}/close`, {});
    load();
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Ochiq ticketlar"
        description="Restoran/kafe stollari yoki kechiktirilgan buyurtmalar"
        onCreate={() => setOpen(true)} />

      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
        <span className="text-sm text-slate-500">Jami: {tickets.length} ta ochiq</span>
        <button onClick={load} className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded flex items-center gap-1">
          <RefreshCw size={14} /> Yangilash
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 py-16 text-center text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700">
          <Coffee size={48} className="mx-auto mb-3 opacity-40" />
          <p>Ochiq ticketlar yo'q</p>
          <p className="text-xs mt-1">Yangi stol/buyurtma boshlash uchun "+" tugmasini bosing</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {tickets.map((t) => (
            <div key={t.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-brand-400 transition">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{t.ticket_name}</div>
                  {t.table_number && (
                    <div className="text-xs text-slate-500 mt-0.5">Stol № {t.table_number}</div>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); close(t.id); }}
                  className="text-slate-400 hover:text-rose-600 p-1">
                  <X size={16} />
                </button>
              </div>
              {t.guest_count != null && (
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                  <Users size={12} /> {t.guest_count} mehmon
                </div>
              )}
              <div className="text-xs text-slate-500 mb-2">
                {new Date(t.opened_at).toLocaleString("uz-Cyrl-UZ", { dateStyle: "short", timeStyle: "short" })}
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700 pt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">{t.item_count} mahsulot</span>
                <span className="font-mono font-semibold text-brand-600 dark:text-brand-400">{fmt(t.total_amount)}</span>
              </div>
              <a href={`/pos/tickets/${t.id}`}
                className="mt-2 block text-center text-xs py-1.5 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 rounded hover:bg-brand-100">
                Ochish
              </a>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Yangi ticket">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Nomi (mijoz/stol)" required>
              <input className={input} value={form.ticket_name}
                onChange={(e) => setForm({ ...form, ticket_name: e.target.value })}
                placeholder="Stol 5 / Aliyev" />
            </Field>
          </div>
          <Field label="Stol №">
            <input className={input} value={form.table_number}
              onChange={(e) => setForm({ ...form, table_number: e.target.value })} />
          </Field>
          <Field label="Mehmon soni">
            <input type="number" className={input} value={form.guest_count}
              onChange={(e) => setForm({ ...form, guest_count: Number(e.target.value) || 1 })} />
          </Field>
          <Field label="Sklad">
            <select className={input} value={form.warehouse_id || ""}
              onChange={(e) => setForm({ ...form, warehouse_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Tanlanmagan</option>
              {whs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <Field label="Kassa">
            <select className={input} value={form.cashbox_id || ""}
              onChange={(e) => setForm({ ...form, cashbox_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Tanlanmagan</option>
              {boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Izoh">
              <textarea className={`${input} h-16`} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded">Bekor</button>
            <button onClick={create} className="px-4 py-2 text-sm bg-brand-600 text-white rounded flex items-center gap-1">
              <Plus size={14} /> Yaratish
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
