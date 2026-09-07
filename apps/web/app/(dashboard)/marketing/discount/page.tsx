"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type Discount = {
  id: string;
  name: string;
  discount_type: "percent" | "fixed";
  value: string;
  valid_from?: string;
  valid_to?: string;
  applies_to: string;
  target_id?: string;
  notes?: string;
  is_active: boolean;
};

const empty = {
  name: "",
  discount_type: "percent",
  value: 0,
  valid_from: "",
  valid_to: "",
  applies_to: "all",
  target_id: "",
  notes: "",
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function DiscountPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q) p.set("q", q);
      const qs = p.toString();
      setRows(
        (await api.get<Discount[]>(`/marketing/discounts${qs ? "?" + qs : ""}`))
          .data
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      const payload = {
        ...form,
        value: Number(form.value) || 0,
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
        target_id: form.target_id || null,
      };
      if (editId) await api.put(`/marketing/discounts/${editId}`, payload);
      else await api.post("/marketing/discounts", payload);
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/marketing/discounts/${deleteTarget.id}`);
      toast.success(t("ui__удалено_0c450c40"));
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setDeleteLoading(false);
    }
  }

  const columns: Column<Discount>[] = [
    { key: "name", header: t("ui__название_602680ed") },
    {
      key: "discount_type",
      header: t("ui__тип_345805b8"),
      width: "110px",
      render: (r) =>
        r.discount_type === "percent" ? "Foiz" : "Summa",
    },
    {
      key: "value",
      header: t("ui__значение_7b46d8cc"),
      align: "right",
      width: "120px",
      render: (r) => (
        <span className="font-mono">
          {fmt(r.value)}
          {r.discount_type === "percent" ? "%" : ""}
        </span>
      ),
    },
    {
      key: "applies_to",
      header: t("ui__применяется_c07452f8"),
      width: "140px",
      render: (r) =>
        ({
          all: "Hammasiga",
          product: "Tovarga",
          category: "Kategoriyaga",
          customer_category: "Mijoz kategoriyasiga",
        }[r.applies_to] || r.applies_to),
    },
    {
      key: "valid_from",
      header: t("ui__с_b3f907c0"),
      width: "120px",
      render: (r) =>
        r.valid_from ? new Date(r.valid_from).toLocaleDateString("ru-RU") : "—",
    },
    {
      key: "valid_to",
      header: t("ui__до_c2aa9c0c"),
      width: "120px",
      render: (r) =>
        r.valid_to ? new Date(r.valid_to).toLocaleDateString("ru-RU") : "—",
    },
    {
      key: "is_active",
      header: t("ui__активна_047e75c5"),
      align: "center",
      width: "100px",
      render: (r) =>
        r.is_active ? (
          <span className="text-success-600 dark:text-success-500 text-xs">
            ●
          </span>
        ) : (
          <span className="text-ink-400 text-xs">○</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__скидки_53a096f7")}
        description={t("ui__акции_и_скидки_f25a1d34")}
        onCreate={() => {
          setForm(empty);
          setEditId(null);
          setOpen(true);
        }}
      />

      <Card className="flex gap-3 items-end">
        <div className="relative flex-1 max-w-md">
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__поиск_bfc95980")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-ink-400"
          />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__поиск_b84a8f87")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <Button onClick={load}>{t("ui__фильтр_2f884b41")}</Button>
      </Card>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        onEdit={(r) => {
          setForm({
            name: r.name,
            discount_type: r.discount_type,
            value: r.value,
            valid_from: r.valid_from?.slice(0, 10) || "",
            valid_to: r.valid_to?.slice(0, 10) || "",
            applies_to: r.applies_to,
            target_id: r.target_id || "",
            notes: r.notes || "",
          });
          setEditId(r.id);
          setOpen(true);
        }}
        onDelete={(r) => setDeleteTarget(r)}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Chegirmani tahrirlash" : "Yangi chegirma"}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label={t("ui__название_602680ed")} required>
              <input
                className={input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("ui__тип_скидки_da1b5c48")} required>
            <select
              className={input}
              value={form.discount_type}
              onChange={(e) =>
                setForm({ ...form, discount_type: e.target.value })
              }
            >
              <option value="percent">{t("ui__процент_e6b156d9")}</option>
              <option value="fixed">{t("ui__фиксированная_сумма_af9386de")}</option>
            </select>
          </Field>
          <Field label={t("ui__значение_7b46d8cc")} required>
            <input
              type="number"
              step="0.01"
              className={input}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </Field>
          <Field label={t("ui__применяется_c07452f8")}>
            <select
              className={input}
              value={form.applies_to}
              onChange={(e) =>
                setForm({ ...form, applies_to: e.target.value })
              }
            >
              <option value="all">{t("ui__ко_всем_ff6d54b3")}</option>
              <option value="product">{t("ui__к_товару_d91360bb")}</option>
              <option value="category">{t("ui__к_категории_033bfcd3")}</option>
              <option value="customer_category">{t("ui__к_категории_клиента_d5550e44")}</option>
            </select>
          </Field>
          <Field label={t("ui__id_целевого_объекта_5c92fda8")}>
            <input
              className={input}
              value={form.target_id}
              onChange={(e) =>
                setForm({ ...form, target_id: e.target.value })
              }
            />
          </Field>
          <Field label={t("ui__действует_с_bc305b30")}>
            <input
              type="date"
              className={input}
              value={form.valid_from}
              onChange={(e) =>
                setForm({ ...form, valid_from: e.target.value })
              }
            />
          </Field>
          <Field label={t("ui__действует_до_5192bdb7")}>
            <input
              type="date"
              className={input}
              value={form.valid_to}
              onChange={(e) => setForm({ ...form, valid_to: e.target.value })}
            />
          </Field>
          <div className="col-span-2">
            <Field label={t("ui__заметки_c8866295")}>
              <textarea
                className={input}
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("ui__отмена_987b33c6")}
            </Button>
            <Button type="button" onClick={save}>
              {t("ui__сохранить_74ea58b6")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="O'chirish"
        message={`«${deleteTarget?.name}» chegirmasi o'chirilsinmi?`}
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
