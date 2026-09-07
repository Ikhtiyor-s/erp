"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Users, Coffee, RefreshCw, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Modal, Field, input } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatWidget } from "@/components/ui/stat-widget";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  const [closeTarget, setCloseTarget] = useState<Ticket | null>(null);
  const [closing, setClosing] = useState(false);
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

  async function confirmClose() {
    if (!closeTarget) return;
    setClosing(true);
    try {
      await api.post(`/open-tickets/${closeTarget.id}/close`, {});
      setCloseTarget(null);
      load();
    } finally {
      setClosing(false);
    }
  }

  const totalAmount = tickets.reduce((s, t) => s + Number(t.total_amount || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Ochiq ticketlar"
        description="Restoran/kafe stollari yoki kechiktirilgan buyurtmalar"
        actions={
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={load}>
            Yangilash
          </Button>
        }
        onCreate={() => setOpen(true)} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatWidget label="Ochiq ticketlar" value={tickets.length} icon={Coffee} color="brand" />
        <StatWidget label="Umumiy summa" value={totalAmount} icon={Wallet} color="success" mono />
      </div>

      {tickets.length === 0 ? (
        <Card padding="lg" className="py-16 text-center text-ink-400 dark:text-ink-600">
          <Coffee size={48} className="mx-auto mb-3 opacity-40" />
          <p>Ochiq ticketlar yo'q</p>
          <p className="text-xs mt-1">Yangi stol/buyurtma boshlash uchun "+" tugmasini bosing</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {tickets.map((t) => (
            <Card key={t.id} padding="md" className="hover:border-brand-400 transition">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="font-semibold text-ink-900 dark:text-ink-100">{t.ticket_name}</div>
                  {t.table_number && (
                    <div className="text-xs text-ink-500 mt-0.5">Stol № {t.table_number}</div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  icon={X}
                  onClick={(e) => { e.stopPropagation(); setCloseTarget(t); }}
                  className="text-ink-400 hover:text-danger-600"
                />
              </div>
              {t.guest_count != null && (
                <div className="flex items-center gap-1 text-xs text-ink-500 mb-2">
                  <Users size={12} /> {t.guest_count} mehmon
                </div>
              )}
              <div className="text-xs text-ink-500 mb-2">
                {new Date(t.opened_at).toLocaleString("uz-Cyrl-UZ", { dateStyle: "short", timeStyle: "short" })}
              </div>
              <div className="border-t border-ink-100 dark:border-ink-800 pt-2 flex items-center justify-between">
                <span className="text-xs text-ink-500">{t.item_count} mahsulot</span>
                <span className="font-mono font-semibold text-brand-600 dark:text-brand-400">{fmt(t.total_amount)}</span>
              </div>
              <a href={`/pos/tickets/${t.id}`}
                className="mt-2 block text-center text-xs py-1.5 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 rounded hover:bg-brand-100">
                Ochish
              </a>
            </Card>
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
          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-700">
            <Button type="button" variant="outline" size="md" onClick={() => setOpen(false)}>
              Bekor
            </Button>
            <Button type="button" variant="primary" size="md" icon={Plus} onClick={create}>
              Yaratish
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        onConfirm={confirmClose}
        title="Ticketni yopish"
        message={`«${closeTarget?.ticket_name}» ticketi yopilsinmi?`}
        confirmLabel="Yopish"
        cancelLabel="Bekor"
        variant="warning"
        loading={closing}
      />
    </div>
  );
}
