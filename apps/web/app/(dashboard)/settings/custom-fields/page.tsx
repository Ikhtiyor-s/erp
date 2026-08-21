"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Modal, Field, input } from "@/components/ui/modal";

type CF = {
  id: number;
  entity_type: string;
  name: string;
  field_type: "text" | "number" | "date" | "select" | "bool";
  options: string[];
  required: boolean;
  sort_order: number;
};

const ENTITY_TYPES = [
  { v: "product", l: "Mahsulot" },
  { v: "customer", l: "Mijoz" },
  { v: "supplier", l: "Ta'minotchi" },
  { v: "sale", l: "Sotuv" },
  { v: "employee", l: "Xodim" },
];

const FIELD_TYPES = [
  { v: "text", l: "Matn" },
  { v: "number", l: "Raqam" },
  { v: "date", l: "Sana" },
  { v: "select", l: "Tanlash" },
  { v: "bool", l: "Ha/Yo'q" },
];

const empty = { entity_type: "product", name: "", field_type: "text" as const, options: "", required: false, sort_order: 0 };

export default function CustomFieldsPage() {
  const [rows, setRows] = useState<CF[]>([]);
  const [filter, setFilter] = useState("product");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  async function load() {
    const r = await api.get<CF[]>(`/custom-fields?entity_type=${filter}`);
    setRows(r.data || []);
  }
  useEffect(() => { load(); }, [filter]);

  async function save() {
    const payload = {
      ...form,
      options: form.field_type === "select" ? form.options.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
    };
    await api.post("/custom-fields", payload);
    toast.success("Saqlandi");
    setOpen(false);
    setForm(empty);
    load();
  }

  async function del(id: number) {
    if (!confirm("O'chirilsinmi?")) return;
    await api.delete(`/custom-fields/${id}`);
    load();
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Qo'shimcha maydonlar"
        description="Mahsulot, mijoz va boshqa modullarga maxsus maydonlar qo'shing"
        onCreate={() => { setForm({ ...empty, entity_type: filter }); setOpen(true); }} />

      <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
        <span className="text-sm text-slate-500">Modul:</span>
        {ENTITY_TYPES.map((e) => (
          <button key={e.v} onClick={() => setFilter(e.v)}
            className={`px-3 py-1.5 rounded text-sm ${filter === e.v ? "bg-brand-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
            {e.l}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        {rows.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">Maydonlar yo'q</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 uppercase">
              <tr><th className="text-left px-4 py-2.5">Nomi</th><th className="text-left px-4 py-2.5">Tur</th><th className="text-left px-4 py-2.5">Variantlar</th><th className="text-center w-20 px-4 py-2.5">Majburiy</th><th className="w-10"></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">{r.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{FIELD_TYPES.find(t => t.v === r.field_type)?.l}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{(r.options || []).join(", ") || "—"}</td>
                  <td className="px-4 py-2.5 text-center">{r.required ? "✓" : "—"}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => del(r.id)} className="text-rose-600 hover:text-rose-700">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Yangi maydon">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Modul">
            <select className={input} value={form.entity_type}
              onChange={(e) => setForm({ ...form, entity_type: e.target.value })}>
              {ENTITY_TYPES.map((e) => <option key={e.v} value={e.v}>{e.l}</option>)}
            </select>
          </Field>
          <Field label="Tur">
            <select className={input} value={form.field_type}
              onChange={(e) => setForm({ ...form, field_type: e.target.value })}>
              {FIELD_TYPES.map((e) => <option key={e.v} value={e.v}>{e.l}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Maydon nomi" required>
              <input className={input} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          </div>
          {form.field_type === "select" && (
            <div className="col-span-2">
              <Field label="Variantlar (vergul bilan ajrating)">
                <input className={input} value={form.options}
                  placeholder="Variant 1, Variant 2, Variant 3"
                  onChange={(e) => setForm({ ...form, options: e.target.value })} />
              </Field>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.required}
              onChange={(e) => setForm({ ...form, required: e.target.checked })} />
            Majburiy
          </label>
          <Field label="Tartib">
            <input type="number" className={input} value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} />
          </Field>
          <div className="col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600">Bekor</button>
            <button onClick={save} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white">Saqlash</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
