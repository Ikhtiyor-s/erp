"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type Expected = {
  id: string;
  product_id: string;
  product_name: string;
  sku?: string;
  supplier_id?: string;
  supplier_name?: string;
  expected_qty: string;
  expected_date: string;
  status: "pending" | "received" | "cancelled";
  notes?: string;
};
type Product = { id: string; name: string; sku?: string };
type Supplier = { id: string; name: string };

const empty = {
  product_id: "",
  supplier_id: "",
  expected_qty: 0,
  expected_date: new Date().toISOString().slice(0, 10),
  notes: "",
};
const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

const statusLabel = (s: string) =>
  ({ pending: "Kutilmoqda", received: "Olindi", cancelled: "Bekor qilindi" }[s] ||
    s);
const statusTone = (s: string) =>
  ({
    pending: "warning" as const,
    received: "success" as const,
    cancelled: "danger" as const,
  }[s] || "neutral" as const);

export default function ExpectedProductsPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Expected[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [deleteTarget, setDeleteTarget] = useState<Expected | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.q) p.set("q", filters.q);
      if (filters.status) p.set("status", filters.status);
      const qs = p.toString();
      setRows(
        (
          await api.get<Expected[]>(
            `/marketing/expected-products${qs ? "?" + qs : ""}`
          )
        ).data
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    Promise.all([
      api
        .get<Product[]>("/warehouse/products?limit=500")
        .then((r) => setProducts(r.data)),
      api
        .get<Supplier[]>("/supplier/suppliers")
        .then((r) => setSuppliers(r.data)),
    ]).catch(() => {});
    load();
  }, []);

  async function save() {
    if (!form.product_id) {
      toast.error(t("ui__выберите_товар_3c27df96"));
      return;
    }
    try {
      await api.post("/marketing/expected-products", {
        ...form,
        supplier_id: form.supplier_id || null,
        expected_qty: Number(form.expected_qty) || 0,
      });
      toast.success(t("ui__добавлено_0e7e5ccb"));
      setOpen(false);
      setForm(empty);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }
  async function setStatus(r: Expected, status: string) {
    try {
      await api.put(
        `/marketing/expected-products/${r.id}/status?status=${status}`
      );
      toast.success(t("ui__обновлено_d1227a44"));
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/marketing/expected-products/${deleteTarget.id}`);
      toast.success(t("ui__удалено_0c450c40"));
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setDeleteLoading(false);
    }
  }

  const columns: Column<Expected>[] = [
    {
      key: "expected_date",
      header: t("ui__ожидается_ddd06519"),
      width: "130px",
      render: (r) => new Date(r.expected_date).toLocaleDateString("ru-RU"),
    },
    { key: "product_name", header: t("ui__товар_8b35db64") },
    {
      key: "sku",
      header: "SKU",
      width: "100px",
      render: (r) => r.sku || "—",
    },
    {
      key: "supplier_name",
      header: t("ui__поставщик_b8fbf748"),
      width: "180px",
      render: (r) => r.supplier_name || "—",
    },
    {
      key: "expected_qty",
      header: t("ui__кол_во_302e2bd6"),
      align: "right",
      width: "120px",
      render: (r) => <span className="font-mono">{fmt(r.expected_qty)}</span>,
    },
    {
      key: "status",
      header: t("ui__статус_7203f7a4"),
      width: "130px",
      render: (r) => (
        <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
      ),
    },
    {
      key: "id" as any,
      header: "",
      align: "center",
      width: "120px",
      render: (r) =>
        r.status === "pending" ? (
          <div className="flex gap-1 justify-center">
            <button
              onClick={() => setStatus(r, "received")}
              className="p-1 text-success-600 dark:text-success-500 hover:bg-success-50 dark:hover:bg-success-500/15 rounded"
              title={t("ui__получено_470c2b83")}
              aria-label="Qabul qilindi deb belgilash"
            >
              <Check size={14} aria-hidden="true" />
            </button>
            <button
              onClick={() => setStatus(r, "cancelled")}
              className="p-1 text-danger-600 dark:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15 rounded"
              title={t("ui__отменить_ecdbdc8b")}
              aria-label="Bekor qilish"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__ожидаемые_товары_c933eebe")}
        description={t("ui__список_ожидаемых_поступлений_bdbceb21")}
        onCreate={() => {
          setForm(empty);
          setOpen(true);
        }}
      />

      <Card className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__поиск_товар_поставщик_01ee0aba")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-ink-400"
          />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__поиск_b84a8f87")}
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__статус_7203f7a4")}
          </label>
          <select
            className={input}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            <option value="pending">{t("ui__ожидается_ddd06519")}</option>
            <option value="received">{t("ui__получено_470c2b83")}</option>
            <option value="cancelled">{t("ui__отменено_81a04dab")}</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={load} fullWidth>
            {t("ui__фильтр_2f884b41")}
          </Button>
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        onDelete={(r) => setDeleteTarget(r)}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("ui__ожидаемое_поступление_8e14d0ee")}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label={t("ui__товар_8b35db64")} required>
              <select
                className={input}
                value={form.product_id}
                onChange={(e) =>
                  setForm({ ...form, product_id: e.target.value })
                }
              >
                <option value="">{t("ui__выбрать_fbbc1d13")}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.sku ? `(${p.sku})` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t("ui__поставщик_b8fbf748")}>
            <select
              className={input}
              value={form.supplier_id}
              onChange={(e) =>
                setForm({ ...form, supplier_id: e.target.value })
              }
            >
              <option value="">{t("ui__нет_7b07413e")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("ui__кол_во_302e2bd6")} required>
            <input
              type="number"
              step="0.001"
              className={input}
              value={form.expected_qty}
              onChange={(e) =>
                setForm({ ...form, expected_qty: e.target.value })
              }
            />
          </Field>
          <Field label={t("ui__ожидаемая_дата_985a37d2")} required>
            <input
              type="date"
              className={input}
              value={form.expected_date}
              onChange={(e) =>
                setForm({ ...form, expected_date: e.target.value })
              }
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
        message="Yozuvni o'chirasizmi?"
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
