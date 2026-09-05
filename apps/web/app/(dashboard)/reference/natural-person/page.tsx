"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type NP = {
  id: number;
  full_name: string;
  passport?: string;
  pinfl?: string;
  phone?: string;
  address?: string;
  notes?: string;
};

const empty = {
  full_name: "",
  passport: "",
  pinfl: "",
  phone: "",
  address: "",
  notes: "",
};

export default function NaturalPersonPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<NP[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows((await api.get<NP[]>("/reference/natural-persons")).data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!form.full_name) {
      toast.error(t("ui__введите_фио_58066c0f"));
      return;
    }
    try {
      if (editId) await api.put(`/reference/natural-persons/${editId}`, form);
      else await api.post("/reference/natural-persons", form);
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }
  async function del(r: NP) {
    if (!confirm(`��${r.full_name}�� o'chirilsinmi?`)) return;
    await api.delete(`/reference/natural-persons/${r.id}`);
    toast.success(t("ui__удалено_0c450c40"));
    load();
  }

  const filtered = q
    ? rows.filter((r) =>
        (r.full_name + " " + (r.passport || "") + " " + (r.pinfl || ""))
          .toLowerCase()
          .includes(q.toLowerCase())
      )
    : rows;

  const cols: Column<NP>[] = [
    { key: "full_name", header: t("ui__фио_72d974de") },
    { key: "passport", header: t("ui__паспорт_d25f6619"), width: "150px", render: (r) => r.passport || "���" },
    { key: "pinfl", header: t("ui__пинфл_69a74a6d"), width: "150px", render: (r) => r.pinfl || "���" },
    { key: "phone", header: t("ui__телефон_2928e19c"), width: "150px", render: (r) => r.phone || "���" },
    { key: "address", header: t("ui__адрес_80148fa5"), render: (r) => r.address || "���" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__физические_лица_2b8c8c50")}
        description={t("ui__реквизиты_физ_лиц_3e2e624a")}
        onCreate={() => {
          setForm(empty);
          setEditId(null);
          setOpen(true);
        }}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 flex gap-3 items-end">
        <div className="relative flex-1 max-w-md">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_bfc95980")}
          </label>
          <Search size={14} className="absolute left-2.5 top-[34px] text-slate-400" />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__фио_паспорт_пинфл_45c46e75")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <DataTable
        columns={cols}
        rows={filtered}
        loading={loading}
        onEdit={(r) => {
          setForm({
            full_name: r.full_name,
            passport: r.passport || "",
            pinfl: r.pinfl || "",
            phone: r.phone || "",
            address: r.address || "",
            notes: r.notes || "",
          });
          setEditId(r.id);
          setOpen(true);
        }}
        onDelete={del}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Tahrirlash" : "Yangi jis. shaxs"}>
        <div className="space-y-3">
          <Field label={t("ui__фио_72d974de")} required>
            <input
              className={input}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ui__паспорт_d25f6619")}>
              <input className={input} value={form.passport} onChange={(e) => setForm({ ...form, passport: e.target.value })} />
            </Field>
            <Field label={t("ui__пинфл_69a74a6d")}>
              <input className={input} value={form.pinfl} onChange={(e) => setForm({ ...form, pinfl: e.target.value })} />
            </Field>
            <Field label={t("ui__телефон_2928e19c")}>
              <input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <Field label={t("ui__адрес_80148fa5")}>
            <input className={input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label={t("ui__заметки_c8866295")}>
            <textarea className={input} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">{t("ui__отмена_987b33c6")}</button>
            <button onClick={save} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__сохранить_74ea58b6")}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
