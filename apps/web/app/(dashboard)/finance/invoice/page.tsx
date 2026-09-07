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

type Inv = {
  id: string; doc_number?: string; issue_date: string; due_date?: string;
  total_amount: string; paid_amount: string; status: string; customer_name?: string;
};
type Customer = { id: string; name: string };
type Currency = { id: number; code: string };
type StatusTone = "neutral" | "info" | "success" | "danger";

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const statusTone = (s: string): StatusTone =>
  ({
    draft: "neutral", sent: "info",
    paid: "success", overdue: "danger", cancelled: "danger",
  } as Record<string, StatusTone>)[s] || "neutral";

export default function InvoicePage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Inv[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<Inv | null>(null);

  const empty = {
    customer_id: "", doc_number: "", issue_date: today(), due_date: "",
    total_amount: 0, currency_id: null as number | null,
  };
  const [form, setForm] = useState<any>(empty);

  async function load() {
    setLoading(true);
    try { setRows((await api.get<Inv[]>("/sale/invoices")).data); }
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
    if (!form.customer_id || !form.issue_date) { toast.error(t("ui__заполните_клиента_и_дату_9927a9e0")); return; }
    try {
      const payload = {
        ...form, currency_id: form.currency_id || null,
        total_amount: Number(form.total_amount) || 0,
        due_date: form.due_date || null,
      };
      if (editId) await api.put(`/sale/invoices/${editId}`, payload);
      else await api.post("/sale/invoices", payload);
      toast.success(t("ui__сохранено_54a59b19")); setOpen(false); load();
    } catch (e) { toast.error(getErrorMessage(e, "Xato")); }
  }

  async function del() {
    if (!delTarget) return;
    await api.delete(`/sale/invoices/${delTarget.id}`);
    toast.success(t("ui__отменено_81a04dab"));
    setDelTarget(null);
    load();
  }

  const columns: Column<Inv>[] = [
    { key: "doc_number", header: "№", render: (r) => r.doc_number || r.id.slice(0, 8), width: "140px" },
    { key: "issue_date", header: t("ui__выставлен_e00554e0"), width: "120px" },
    { key: "due_date", header: t("ui__до_c2aa9c0c"), width: "120px", render: (r) => r.due_date || "—" },
    { key: "customer_name", header: t("ui__клиент_4af22f2d") },
    { key: "total_amount", header: t("ui__сумма_cf59ebf9"), align: "right", width: "140px",
      render: (r) => <span className="font-mono">{fmt(r.total_amount)}</span> },
    { key: "paid_amount", header: t("ui__оплачено_6d8c0850"), align: "right", width: "140px",
      render: (r) => <span className="font-mono text-success-700 dark:text-success-500">{fmt(r.paid_amount)}</span> },
    { key: "status", header: t("ui__статус_7203f7a4"), width: "100px",
      render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__счета_фактуры_233c8364")} description={t("ui__выставленные_счета_клиентам_d65b8f5f")}
        onCreate={() => { setForm(empty); setEditId(null); setOpen(true); }} />
      <DataTable columns={columns} rows={rows} loading={loading}
        onEdit={(r) => {
          setForm({
            customer_id: "", doc_number: r.doc_number || "",
            issue_date: r.issue_date, due_date: r.due_date || "",
            total_amount: r.total_amount, currency_id: null,
          });
          setEditId(r.id); setOpen(true);
        }}
        onDelete={(r) => setDelTarget(r)} />

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editId ? "Hisobni tahrirlash" : "Yangi hisob"}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("ui__клиент_4af22f2d")} required>
            <select className={input} value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">{t("ui__выберите_edab92dd")}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t("ui__счёта_bc02a829")}>
            <input className={input} value={form.doc_number}
              onChange={(e) => setForm({ ...form, doc_number: e.target.value })} />
          </Field>
          <Field label={t("ui__дата_выставления_5fa48962")} required>
            <input type="date" className={input} value={form.issue_date}
              onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
          </Field>
          <Field label={t("ui__срок_оплаты_cf3b9c5f")}>
            <input type="date" className={input} value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </Field>
          <Field label={t("ui__сумма_cf59ebf9")} required>
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
        title="Hisobni bekor qilish"
        message={delTarget ? `«${delTarget.doc_number || delTarget.id.slice(0, 8)}» hisobi bekor qilinsinmi?` : ""}
        confirmLabel={t("ui__отменено_81a04dab")}
        variant="danger"
      />
    </div>
  );
}
