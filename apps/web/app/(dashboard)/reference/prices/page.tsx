"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ListPlus, Star, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type PriceList = {
  id: number;
  name: string;
  currency_id?: number;
  currency_code?: string;
  is_default: boolean;
  item_count: number;
};
type Currency = { id: number; code: string };
type PriceItem = {
  id: number;
  product_id: string;
  product_name: string;
  sku?: string;
  price: string;
};
type Product = { id: string; name: string; sku?: string };

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function PriceListsPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<PriceList[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", currency_id: "" as number | "", is_default: false });
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PriceList | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [itemsFor, setItemsFor] = useState<PriceList | null>(null);
  const [items, setItems] = useState<PriceItem[]>([]);
  const [newItem, setNewItem] = useState({ product_id: "", price: "" });

  async function load() {
    setLoading(true);
    try {
      setRows((await api.get<PriceList[]>("/reference/price-lists")).data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    Promise.all([
      api.get<Currency[]>("/reference/currencies").then((r) => setCurrencies(r.data)),
      api.get<Product[]>("/warehouse/products?limit=500").then((r) => setProducts(r.data)),
    ]).catch(() => {});
    load();
  }, []);

  async function save() {
    if (!form.name) {
      toast.error(t("ui__название_обязательно_4df3db9f"));
      return;
    }
    try {
      const payload = {
        name: form.name,
        currency_id: form.currency_id || null,
        is_default: form.is_default,
      };
      if (editId) await api.put(`/reference/price-lists/${editId}`, payload);
      else await api.post("/reference/price-lists", payload);
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false);
      setForm({ name: "", currency_id: "", is_default: false });
      setEditId(null);
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/reference/price-lists/${deleteTarget.id}`);
      toast.success(t("ui__удалено_0c450c40"));
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function openItems(r: PriceList) {
    setItemsFor(r);
    const { data } = await api.get<PriceItem[]>(`/reference/price-lists/${r.id}/items`);
    setItems(data);
    setNewItem({ product_id: "", price: "" });
  }
  async function addItem() {
    if (!itemsFor || !newItem.product_id || !newItem.price) return;
    try {
      await api.post(`/reference/price-lists/${itemsFor.id}/items`, {
        product_id: newItem.product_id,
        price: Number(newItem.price),
      });
      toast.success(t("ui__добавлено_0e7e5ccb"));
      setNewItem({ product_id: "", price: "" });
      const { data } = await api.get<PriceItem[]>(`/reference/price-lists/${itemsFor.id}/items`);
      setItems(data);
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }
  async function delItem(it: PriceItem) {
    if (!itemsFor) return;
    await api.delete(`/reference/price-lists/${itemsFor.id}/items/${it.id}`);
    const { data } = await api.get<PriceItem[]>(`/reference/price-lists/${itemsFor.id}/items`);
    setItems(data);
  }

  const cols: Column<PriceList>[] = [
    {
      key: "name",
      header: t("ui__название_602680ed"),
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.is_default && (
            <Star size={14} className="text-yellow-500 fill-yellow-500" />
          )}
          <span className="text-ink-900 dark:text-ink-100">{r.name}</span>
        </div>
      ),
    },
    {
      key: "currency_code",
      header: t("ui__валюта_cf55d9a9"),
      width: "100px",
      render: (r) => r.currency_code || "—",
    },
    {
      key: "item_count",
      header: t("ui__позиций_7366e179"),
      align: "right",
      width: "120px",
      render: (r) => (
        <span className="font-mono text-brand-700 dark:text-brand-400">
          {r.item_count}
        </span>
      ),
    },
    {
      key: "id" as any,
      header: "",
      align: "center",
      width: "120px",
      render: (r) => (
        <Button variant="ghost" size="xs" icon={ListPlus} onClick={() => openItems(r)}>
          {t("ui__позиции_3f4e8c19")}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__прайс_листы_85573231")}
        description={t("ui__прайсы_по_сегментам_клиентов_500b80f3")}
        onCreate={() => {
          setForm({ name: "", currency_id: "", is_default: false });
          setEditId(null);
          setOpen(true);
        }}
      />

      <DataTable
        columns={cols}
        rows={rows}
        loading={loading}
        onEdit={(r) => {
          setForm({
            name: r.name,
            currency_id: r.currency_id || "",
            is_default: r.is_default,
          });
          setEditId(r.id);
          setOpen(true);
        }}
        onDelete={(r) => setDeleteTarget(r)}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Narxnomani tahrirlash" : "Yangi narxnoma"}>
        <div className="space-y-3">
          <Field label={t("ui__название_602680ed")} required>
            <input
              className={input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label={t("ui__валюта_cf55d9a9")}>
            <select
              className={input}
              value={form.currency_id || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  currency_id: e.target.value ? Number(e.target.value) : "",
                })
              }
            >
              <option value="">{t("ui__нет_7b07413e")}</option>
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
            />
            {t("ui__по_умолчанию_d3b9e440")}
          </label>
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

      <Modal
        open={!!itemsFor}
        onClose={() => setItemsFor(null)}
        size="lg"
        title={itemsFor ? `Narxlar: ${itemsFor.name}` : ""}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 items-end">
            <div className="sm:col-span-2">
              <Field label={t("ui__товар_8b35db64")}>
                <select
                  className={input}
                  value={newItem.product_id}
                  onChange={(e) => setNewItem({ ...newItem, product_id: e.target.value })}
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
            <Field label={t("ui__цена_682fa8db")}>
              <input
                type="number"
                step="0.01"
                className={input}
                value={newItem.price}
                onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
              />
            </Field>
            <div className="col-span-3">
              <Button onClick={addItem}>{t("ui__добавить_5eba283b")}</Button>
            </div>
          </div>

          <div className="border border-ink-200 dark:border-ink-800 rounded-md max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900/40 text-ink-700 dark:text-ink-300 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">{t("ui__товар_8b35db64")}</th>
                  <th className="px-3 py-2 text-right w-32">{t("ui__цена_682fa8db")}</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-ink-400 dark:text-ink-600">
                      {t("ui__нет_позиций_cc62d9ac")}
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id} className="border-t border-ink-200 dark:border-ink-800">
                      <td className="px-3 py-2 text-ink-900 dark:text-ink-100">{it.product_name}</td>
                      <td className="px-3 py-2 text-right font-mono text-ink-900 dark:text-ink-100">
                        {fmt(it.price)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => delItem(it)}
                          className="text-danger-600 dark:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15 p-1 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="O'chirish"
        message={`«${deleteTarget?.name}» o'chirilsinmi?`}
        variant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
