"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type Ct = {
  id: string; doc_number?: string; start_date?: string; end_date?: string;
  total_amount: string; status: string; customer_name?: string;
};
type Customer = { id: string; name: string };
type Currency = { id: number; code: string };
type StatusTone = "success" | "info" | "danger" | "neutral";

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const statusTone = (s: string): StatusTone =>
  ({
    active: "success", draft: "neutral",
    closed: "info", cancelled: "danger",
  } as Record<string, StatusTone>)[s] || "neutral";

export default function ContractPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Ct[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<Ct | null>(null);

  const empty = {
    customer_id: "", doc_number: "", start_date: "", end_date: "",
    total_amount: 0, currency_id: null as number | null, notes: "",
  };
  const [form, setForm] = useState<any>(empty);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Ct[]>("/sale/contracts")).data); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    Promise.all([
      api.get<Customer[]>("/customer/customers?limit=200").then((r) => setCustomers(r.data)),
      api.get<Currency[]>("/reference/currencies").then((r) => setCurrencies(r.data)),
    ]).catch(() => {});
    load();
  }, []);

  async function save() {
    if (!form.customer_id) { toast.error(t("ui__выберите_клиента_33e0418a")); return; }
    try {
      const payload = {
        ...form, currency_id: form.currency_id || null,
        total_amount: Number(form.total_amount) || 0,
        start_date: form.start_date || null, end_date: form.end_date || null,
      };
      if (editId) await api.put(`/sale/contracts/${editId}`, payload);
      else await api.post("/sale/contracts", payload);
      toast.success(t("ui__сохранено_54a59b19")); setOpen(false); load();
    } catch (e: any) { toast.error(getErrorMessage(e, "Shartnoma saqlashda xato")); }
  }

  async function del() {
    if (!delTarget) return;
    await api.delete(`/sale/contracts/${delTarget.id}`);
    toast.success(t("ui__отменено_81a04dab"));
    setDelTarget(null);
    load();
  }

  const columns: Column<Ct>[] = [
    { key: "doc_number", header: "№", render: (r) => r.doc_number || r.id.slice(0, 8), width: "140px" },
    { key: "customer_name", header: t("ui__клиент_4af22f2d") },
    { key: "start_date", header: t("ui__начало_0d1e0cd7"), width: "120px", render: (r) => r.start_date || "—" },
    { key: "end_date", header: t("ui__окончание_10d72d5e"), width: "120px", render: (r) => r.end_date || "—" },
    { key: "total_amount", header: t("ui__сумма_cf59ebf9"), align: "right", width: "150px",
      render: (r) => <span className="font-mono">{fmt(r.total_amount)}</span> },
    { key: "status", header: t("ui__статус_7203f7a4"), width: "120px",
      render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__договоры_b2b_8a475c83")} description={t("ui__финансовые_торговые_договоры_3ceb2244")}
        onCreate={() => { setForm(empty); setEditId(null); setOpen(true); }} />
      <DataTable columns={columns} rows={rows} loading={loading}
        onEdit={(r) => {
          setForm({
            customer_id: "", doc_number: r.doc_number || "",
            start_date: r.start_date || "", end_date: r.end_date || "",
            total_amount: r.total_amount, currency_id: null, notes: "",
          });
          setEditId(r.id); setOpen(true);
        }}
        onDelete={(r) => setDelTarget(r)} />

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editId ? "Shartnomani tahrirlash" : "Yangi shartnoma"}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("ui__клиент_4af22f2d")} required>
            <select className={input} value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">{t("ui__выберите_edab92dd")}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t("ui__договора_6c609ff5")}>
            <input className={input} value={form.doc_number}
              onChange={(e) => setForm({ ...form, doc_number: e.target.value })} />
          </Field>
          <Field label={t("ui__начало_0d1e0cd7")}>
            <input type="date" className={input} value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </Field>
          <Field label={t("ui__окончание_10d72d5e")}>
            <input type="date" className={input} value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </Field>
          <Field label={t("ui__сумма_cf59ebf9")}>
            <input type="number" step="0.01" className={input} value={form.total_amount}
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
          </Field>
          <Field label={t("ui__валюта_cf55d9a9")}>
            <select className={input} value={form.currency_id || ""}
              onChange={(e) => setForm({ ...form, currency_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t("ui__нет_7b07413e")}</option>
              {currencies.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label={t("ui__примечание_686eb72b")}>
              <textarea className={input} rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("ui__отмена_987b33c6")}</Button>
            <Button type="button" onClick={save}>{t("ui__сохранить_74ea58b6")}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={del}
        title="Shartnomani bekor qilish"
        message={delTarget ? `«${delTarget.doc_number || delTarget.id.slice(0, 8)}» shartnomasi bekor qilinsinmi?` : ""}
        confirmLabel={t("ui__отменено_81a04dab")}
        variant="danger"
      />
    </div>
  );
}
