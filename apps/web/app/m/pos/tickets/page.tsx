"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Coffee } from "lucide-react";
import { api } from "@/lib/api";

type Ticket = {
  id: string;
  ticket_name: string;
  table_number?: string;
  total_amount: string;
  item_count: number;
  opened_at: string;
};

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

export default function MobileTickets() {
  const [rows, setRows] = useState<Ticket[]>([]);
  const [newName, setNewName] = useState("");
  const [newTable, setNewTable] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const r = await api.get<Ticket[]>("/open-tickets?status=open");
    setRows(r.data || []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!newName.trim()) return toast.error("Nom kerak");
    await api.post("/open-tickets", { ticket_name: newName, table_number: newTable || null });
    toast.success("Yaratildi");
    setNewName("");
    setNewTable("");
    setCreating(false);
    load();
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ochiq ticketlar</h1>
        <button onClick={() => setCreating(true)}
          className="p-2 bg-brand-600 text-white rounded-md">
          <Plus size={18} />
        </button>
      </div>

      {creating && (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-brand-300 space-y-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Nomi (mijoz/stol)" autoFocus
            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 rounded-md text-sm" />
          <input value={newTable} onChange={(e) => setNewTable(e.target.value)}
            placeholder="Stol № (ixtiyoriy)"
            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 rounded-md text-sm" />
          <div className="flex gap-2">
            <button onClick={create} className="flex-1 py-2 bg-brand-600 text-white rounded-md text-sm">Yaratish</button>
            <button onClick={() => setCreating(false)} className="px-3 py-2 text-sm text-slate-500">Bekor</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <Coffee size={48} className="mx-auto mb-3 opacity-40" />
          Ochiq ticketlar yo'q
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {rows.map((t) => (
            <Link key={t.id} href={`/m/pos/tickets/${t.id}`}
              className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="font-semibold truncate">{t.ticket_name}</div>
              {t.table_number && <div className="text-xs text-slate-500">Stol № {t.table_number}</div>}
              <div className="border-t border-slate-100 dark:border-slate-700 mt-2 pt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">{t.item_count}</span>
                <span className="font-mono text-sm font-semibold">{fmt(t.total_amount)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
