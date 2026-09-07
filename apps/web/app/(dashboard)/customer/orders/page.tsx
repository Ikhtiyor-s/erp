"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type Order = {
  id: string;
  doc_number: number;
  order_date: string;
  delivery_date?: string;
  status: string;
  total_amount: string;
  notes?: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
};
type Customer = { id: string; name: string };
type Product = { id: string; name: string; sale_price: string };

type Line = { product_id: string; quantity: number; price: number };

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

const statusLabel = (s: string) =>
  ({
    new: "Yangi",
    confirmed: "Tasdiqlandi",
    shipped: "Yuborildi",
    delivered: "Yetkazildi",
    cancelled: "Bekor qilindi",
  }[s] || s);

const statusColor = (s: string) =>
  ({
    new: "text-ink-700 dark:text-ink-300",
    confirmed: "text-info-700 dark:text-info-500",
    shipped: "text-warn-700 dark:text-warn-500",
    delivered: "text-success-700 dark:text-success-500",
    cancelled: "text-danger-700 dark:text-danger-500",
  }[s] || "");

export default function CustomerOrdersPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    delivery_date: "",
    notes: "",
    items: [{ product_id: "", quantity: 1, price: 0 }] as Line[],
  });

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.q) p.set("q", filters.q);
      if (filters.status) p.set("status", filters.status);
      const qs = p.toString();
      setRows((await api.get<Order[]>(`/customer/orders${qs ? "?" + qs : ""}`)).data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      api.get<Customer[]>("/customer/customers?limit=500").then((r) => setCustomers(r.data)),
      api.get<Product[]>("/warehouse/products?limit=500").then((r) => setProducts(r.data)),
    ]).catch(() => {});
    load();
  }, []);

  function setLine(idx: number, k: keyof Line, v: any) {
    const n = [...form.items];
    (n[idx] as any)[k] = v;
    if (k === "product_id") {
      const p = products.find((x) => x.id === v);
      if (p) n[idx].price = Number(p.sale_price) || 0;
    }
    setForm({ ...form, items: n });
  }

  async function save() {
    if (!form.customer_id) {
      toast.error(t("ui__выберите_клиента_33e0418a"));
      return;
    }
    const items = form.items
      .filter((i) => i.product_id && Number(i.quantity) > 0)
      .map((i) => ({
        product_id: i.product_id,
        quantity: Number(i.quantity),
        price: Number(i.price) || 0,
      }));
    if (items.length === 0) {
      toast.error(t("ui__добавьте_товары_959fc936"));
      return;
    }
    try {
      await api.post("/customer/orders", {
        customer_id: form.customer_id,
        delivery_date: form.delivery_date || null,
        notes: form.notes || null,
        items,
      });
      toast.success(t("ui__заказ_создан_4dc0ec43"));
      setOpen(false);
      setForm({
        customer_id: "",
        delivery_date: "",
        notes: "",
        items: [{ product_id: "", quantity: 1, price: 0 }],
      });
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  async function setStatus(r: Order, status: string) {
    try {
      await api.put(`/customer/orders/${r.id}/status?status=${status}`);
      toast.success(t("ui__статус_обновлён_60431b86"));
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  function del(r: Order) {
    setDeleteTarget(r);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/customer/orders/${deleteTarget.id}`);
      toast.success(t("ui__удалено_0c450c40"));
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setDeleting(false);
    }
  }

  const cols: Column<Order>[] = [
    { key: "doc_number", header: "№", width: "90px" },
    {
      key: "order_date",
      header: t("ui__дата_заказа_e312c6ff"),
      width: "130px",
      render: (r) => new Date(r.order_date).toLocaleDateString("ru-RU"),
    },
    { key: "customer_name", header: t("ui__клиент_4af22f2d"), render: (r) => r.customer_name || "—" },
    {
      key: "customer_phone",
      header: t("ui__телефон_2928e19c"),
      width: "140px",
      render: (r) => r.customer_phone || "—",
    },
    {
      key: "delivery_date",
      header: t("ui__доставка_b973ee86"),
      width: "130px",
      render: (r) =>
        r.delivery_date ? new Date(r.delivery_date).toLocaleDateString("ru-RU") : "—",
    },
    {
      key: "total_amount",
      header: t("ui__сумма_cf59ebf9"),
      align: "right",
      width: "150px",
      render: (r) => (
        <span className="font-mono text-ink-900 dark:text-ink-100">
          {fmt(r.total_amount)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("ui__статус_7203f7a4"),
      width: "140px",
      render: (r) => (
        <select
          value={r.status}
          onChange={(e) => setStatus(r, e.target.value)}
          className={`${statusColor(r.status)} bg-transparent border border-ink-300 dark:border-ink-700 rounded px-2 py-1 text-xs`}
        >
          <option value="new">{statusLabel("new")}</option>
          <option value="confirmed">{statusLabel("confirmed")}</option>
          <option value="shipped">{statusLabel("shipped")}</option>
          <option value="delivered">{statusLabel("delivered")}</option>
          <option value="cancelled">{statusLabel("cancelled")}</option>
        </select>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__заказы_клиентов_34e800fb")}
        description={t("ui__заявки_на_покупку_от_клиентов_ec62c9cf")}
        onCreate={() => setOpen(true)}
        createLabel={t("ui__новый_заказ_9a1a009d")}
      />

      <Card className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="col-span-2 relative">
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__поиск_или_клиент_a47c4d31")}
          </label>
          <Search size={14} className="absolute left-2.5 top-[34px] text-ink-400" />
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
            <option value="new">{t("ui__новый_97ae6e0b")}</option>
            <option value="confirmed">{t("ui__подтверждён_7d7773b3")}</option>
            <option value="shipped">{t("ui__отгружен_2d197375")}</option>
            <option value="delivered">{t("ui__доставлен_2e4c7783")}</option>
            <option value="cancelled">{t("ui__отменён_79dcd7ca")}</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={load} fullWidth>
            {t("ui__фильтр_2f884b41")}
          </Button>
        </div>
      </Card>

      <DataTable columns={cols} rows={rows} loading={loading} onDelete={del} />

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={t("ui__новый_заказ_9a1a009d")}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ui__клиент_4af22f2d")} required>
              <select
                className={input}
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
              >
                <option value="">{t("ui__выбрать_fbbc1d13")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ui__дата_доставки_97d04376")}>
              <input
                type="date"
                className={input}
                value={form.delivery_date}
                onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
              />
            </Field>
          </div>

          <div className="border border-ink-200 dark:border-ink-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900/40 text-ink-700 dark:text-ink-300">
                <tr>
                  <th className="text-left px-3 py-2">{t("ui__товар_8b35db64")}</th>
                  <th className="text-right px-3 py-2 w-28">{t("ui__кол_во_302e2bd6")}</th>
                  <th className="text-right px-3 py-2 w-32">{t("ui__цена_682fa8db")}</th>
                  <th className="text-right px-3 py-2 w-32">{t("ui__сумма_cf59ebf9")}</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, idx) => (
                  <tr key={idx} className="border-t border-ink-200 dark:border-ink-800">
                    <td className="px-3 py-2">
                      <select
                        className={input}
                        value={it.product_id}
                        onChange={(e) => setLine(idx, "product_id", e.target.value)}
                      >
                        <option value="">{t("ui__товар_8c2c36d6")}</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.001"
                        value={it.quantity}
                        onChange={(e) => setLine(idx, "quantity", e.target.value)}
                        className={`${input} w-24 text-right`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={it.price}
                        onChange={(e) => setLine(idx, "price", e.target.value)}
                        className={`${input} w-28 text-right`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-ink-900 dark:text-ink-100">
                      {fmt(Number(it.quantity) * Number(it.price))}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() =>
                          setForm({
                            ...form,
                            items: form.items.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-danger-600 dark:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15 p-1 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={() =>
                setForm({
                  ...form,
                  items: [...form.items, { product_id: "", quantity: 1, price: 0 }],
                })
              }
              className="text-xs text-brand-600 dark:text-brand-400 px-3 py-2 inline-flex items-center gap-1"
            >
              <Plus size={12} /> {t("ui__добавить_строку_d70236f2")}
            </button>
          </div>

          <Field label={t("ui__заметки_c8866295")}>
            <textarea
              className={input}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
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
        onConfirm={confirmDelete}
        title={t("ui__удалено_0c450c40")}
        message={`Buyurtma №${deleteTarget?.doc_number} o'chirilsinmi?`}
        loading={deleting}
      />
    </div>
  );
}
