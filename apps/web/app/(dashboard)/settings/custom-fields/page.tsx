"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Modal, Field, input } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  const [deleteTarget, setDeleteTarget] = useState<CF | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/custom-fields/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  const cols: Column<CF>[] = [
    { key: "name", header: "Nomi" },
    { key: "field_type", header: "Tur", render: (r) => FIELD_TYPES.find((t) => t.v === r.field_type)?.l },
    { key: "options", header: "Variantlar", render: (r) => (r.options || []).join(", ") || "—" },
    { key: "required", header: "Majburiy", align: "center", render: (r) => (r.required ? "✓" : "—") },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Qo'shimcha maydonlar"
        description="Mahsulot, mijoz va boshqa modullarga maxsus maydonlar qo'shing"
        onCreate={() => { setForm({ ...empty, entity_type: filter }); setOpen(true); }} />

      <Card padding="sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-ink-500 dark:text-ink-400">Modul:</span>
          {ENTITY_TYPES.map((e) => (
            <Button
              key={e.v}
              type="button"
              variant={filter === e.v ? "primary" : "ghost"}
              size="sm"
              onClick={() => setFilter(e.v)}
            >
              {e.l}
            </Button>
          ))}
        </div>
      </Card>

      <DataTable
        columns={cols}
        rows={rows}
        onDelete={(r) => setDeleteTarget(r)}
        emptyText="Maydonlar yo'q"
      />

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
          <div className="col-span-2 flex justify-end gap-2 pt-3 border-t border-ink-200/60 dark:border-ink-800/60">
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor</Button>
            <Button onClick={save}>Saqlash</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Maydonni o'chirish"
        message={`"${deleteTarget?.name ?? ""}" maydonini o'chirishni tasdiqlaysizmi?`}
        loading={deleting}
      />
    </div>
  );
}
