"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, User, CheckCircle, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Modal, Field, input } from "@/components/ui/modal";

type Visit = {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  employee_id: string;
  employee_name: string;
  visit_date: string;
  status: "planned" | "in_progress" | "completed" | "skipped";
};
type Customer = { id: string; name: string; phone?: string };
type Employee = { id: string; full_name: string };

const STATUS_LABEL: Record<string, { l: string; c: string }> = {
  planned: { l: "Rejada", c: "bg-slate-100 text-slate-700" },
  in_progress: { l: "Boshlandi", c: "bg-blue-100 text-blue-700" },
  completed: { l: "Yakunlandi", c: "bg-emerald-100 text-emerald-700" },
  skipped: { l: "O'tkazib yuborildi", c: "bg-amber-100 text-amber-700" },
};

export default function DistributionPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [visits, setVisits] = useState<Visit[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [emps, setEmps] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer_id: "", employee_id: "", visit_date: date, sort_order: 0 });

  async function load() {
    const r = await api.get<Visit[]>(`/distribution/planned-visits?visit_date=${date}`);
    setVisits(r.data || []);
  }
  useEffect(() => { load(); }, [date]);
  useEffect(() => {
    api.get<Customer[]>("/customer/customers?limit=500").then((r) => setCustomers(r.data || [])).catch(() => {});
    api.get<Employee[]>("/hr/employees?limit=200").then((r) => setEmps(r.data || [])).catch(() => {});
  }, []);

  async function create() {
    if (!form.customer_id || !form.employee_id) return toast.error("Mijoz va xodim tanlang");
    await api.post("/distribution/planned-visits", form);
    toast.success("Yaratildi");
    setOpen(false);
    load();
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Distribusiya / Vizitlar"
        description="Dala xodimlari uchun marshrut va rejalashtirilgan vizitlar"
        onCreate={() => { setForm({ ...form, visit_date: date }); setOpen(true); }} />

      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
        <span className="text-sm text-slate-500">Sana:</span>
        <input type="date" className={`${input} max-w-xs`} value={date}
          onChange={(e) => setDate(e.target.value)} />
        <a href="/sale/visits" className="ml-auto text-sm text-brand-600 hover:underline">
          Yakunlangan vizitlar →
        </a>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        {visits.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <MapPin size={48} className="mx-auto mb-3 opacity-40" />
            Bu kunda vizitlar rejalashtirilmagan
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {visits.map((v) => (
              <li key={v.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium">{v.customer_name}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                    {v.customer_phone && <span>{v.customer_phone}</span>}
                    <span className="flex items-center gap-1"><User size={11} /> {v.employee_name}</span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_LABEL[v.status]?.c}`}>
                  {STATUS_LABEL[v.status]?.l}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Yangi vizit rejasi">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Mijoz" required>
              <select className={input} value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">— tanlang —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Xodim" required>
              <select className={input} value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                <option value="">— tanlang —</option>
                {emps.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Sana">
            <input type="date" className={input} value={form.visit_date}
              onChange={(e) => setForm({ ...form, visit_date: e.target.value })} />
          </Field>
          <Field label="Tartib">
            <input type="number" className={input} value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} />
          </Field>
          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded">Bekor</button>
            <button onClick={create} className="px-4 py-2 text-sm bg-brand-600 text-white rounded">Saqlash</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
