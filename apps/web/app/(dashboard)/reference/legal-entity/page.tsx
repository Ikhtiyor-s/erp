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

type LE = {
  id: number;
  name: string;
  tin?: string;
  oked?: string;
  bank_account?: string;
  bank_name?: string;
  mfo?: string;
  address?: string;
  phone?: string;
  director?: string;
  accountant?: string;
};

const empty = {
  name: "",
  tin: "",
  oked: "",
  bank_account: "",
  bank_name: "",
  mfo: "",
  address: "",
  phone: "",
  director: "",
  accountant: "",
};

export default function LegalEntityPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<LE[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows((await api.get<LE[]>("/reference/legal-entities")).data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!form.name) {
      toast.error(t("ui__��������������_����������������_74a8590b"));
      return;
    }
    try {
      if (editId) await api.put(`/reference/legal-entities/${editId}`, form);
      else await api.post("/reference/legal-entities", form);
      toast.success(t("ui__������������������_54a59b19"));
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }
  async function del(r: LE) {
    if (!confirm(`��${r.name}�� o'chirilsinmi?`)) return;
    await api.delete(`/reference/legal-entities/${r.id}`);
    toast.success(t("ui__��������������_0c450c40"));
    load();
  }

  const filtered = q
    ? rows.filter((r) =>
        (r.name + " " + (r.tin || "") + " " + (r.director || ""))
          .toLowerCase()
          .includes(q.toLowerCase())
      )
    : rows;

  const cols: Column<LE>[] = [
    { key: "name", header: t("ui__����������������_602680ed") },
    { key: "tin", header: t("ui__������_5b0ec543"), width: "130px", render: (r) => r.tin || "���" },
    { key: "oked", header: t("ui__��������_96fe8277"), width: "120px", render: (r) => r.oked || "���" },
    { key: "phone", header: t("ui__��������������_2928e19c"), width: "150px", render: (r) => r.phone || "���" },
    { key: "director", header: t("ui__����������������_7dbaf4be"), width: "180px", render: (r) => r.director || "���" },
    { key: "bank_name", header: t("ui__��������_a8bf94ab"), render: (r) => r.bank_name || "���" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__����������������������_��������_962571d7")}
        description={t("ui__������������������_����_������_87d33437")}
        onCreate={() => {
          setForm(empty);
          setEditId(null);
          setOpen(true);
        }}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 flex gap-3 items-end">
        <div className="relative flex-1 max-w-md">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__����������_bfc95980")}
          </label>
          <Search size={14} className="absolute left-2.5 top-[34px] text-slate-400" />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__����������_b84a8f87")}
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
            name: r.name,
            tin: r.tin || "",
            oked: r.oked || "",
            bank_account: r.bank_account || "",
            bank_name: r.bank_name || "",
            mfo: r.mfo || "",
            address: r.address || "",
            phone: r.phone || "",
            director: r.director || "",
            accountant: r.accountant || "",
          });
          setEditId(r.id);
          setOpen(true);
        }}
        onDelete={del}
      />

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editId ? "Tahrirlash" : "Yangi yur. shaxs"}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label={t("ui__����������������_602680ed")} required>
              <input
                className={input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("ui__������_5b0ec543")}>
            <input className={input} value={form.tin} onChange={(e) => setForm({ ...form, tin: e.target.value })} />
          </Field>
          <Field label={t("ui__��������_96fe8277")}>
            <input className={input} value={form.oked} onChange={(e) => setForm({ ...form, oked: e.target.value })} />
          </Field>
          <Field label={t("ui__������������������_��������_f9d29468")}>
            <input className={input} value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} />
          </Field>
          <Field label={t("ui__��������_a8bf94ab")}>
            <input className={input} value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
          </Field>
          <Field label={t("ui__������_310395ce")}>
            <input className={input} value={form.mfo} onChange={(e) => setForm({ ...form, mfo: e.target.value })} />
          </Field>
          <Field label={t("ui__��������������_2928e19c")}>
            <input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label={t("ui__����������������_7dbaf4be")}>
            <input className={input} value={form.director} onChange={(e) => setForm({ ...form, director: e.target.value })} />
          </Field>
          <Field label={t("ui__������������������_f528abeb")}>
            <input className={input} value={form.accountant} onChange={(e) => setForm({ ...form, accountant: e.target.value })} />
          </Field>
          <div className="col-span-2">
            <Field label={t("ui__����������_80148fa5")}>
              <textarea
                className={input}
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">{t("ui__������������_987b33c6")}</button>
            <button onClick={save} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__������������������_74ea58b6")}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
