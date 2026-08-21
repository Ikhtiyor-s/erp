"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { TagsInput } from "@/components/ui/tags-input";
import { CustomFieldsEditor } from "@/components/ui/custom-fields";
import { useTranslations } from "next-intl";

type Product = {
  id: string;
  sku?: string;
  barcode?: string;
  mxik?: string | null;
  name: string;
  sale_price: string;
  purchase_price: string;
  currency_id?: number;
  currency_code?: string;
  unit_id?: number;
  unit_name?: string;
  category_id?: number;
  category_name?: string;
  is_service: boolean;
  is_produced?: boolean;
  total_stock?: string;
};
type Ref = { id: number; name: string; code?: string };

const empty = {
  name: "",
  sku: "",
  barcode: "",
  mxik: "",
  category_id: null,
  unit_id: null,
  purchase_price: 0,
  sale_price: 0,
  currency_id: null,
  is_service: false,
  is_material: false,
  is_semi_product: false,
  is_marked: false,
  has_expiration: false,
  image_url: "",
  box_qty: "",
  box_barcode: "",
  dim_length: "",
  dim_width: "",
  dim_height: "",
  dim_weight: "",
  description: "",
  extra_barcodes: [] as string[],
  tag_ids: [] as number[],
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function ProductsPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Product[]>([]);
  const [cats, setCats] = useState<Ref[]>([]);
  const [units, setUnits] = useState<Ref[]>([]);
  const [currencies, setCurrencies] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: "",
    category_id: "",
    is_service: "",
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("limit", "200");
      if (filters.q) p.set("q", filters.q);
      if (filters.category_id) p.set("category_id", filters.category_id);
      if (filters.is_service) p.set("is_service", filters.is_service);
      setRows((await api.get<Product[]>(`/warehouse/products?${p}`)).data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      api.get<Ref[]>("/warehouse/categories").then((r) => setCats(r.data)).catch(() => {}),
      api.get<Ref[]>("/reference/units").then((r) => setUnits(r.data)).catch(() => {}),
      api.get<Ref[]>("/reference/currencies").then((r) => setCurrencies(r.data)).catch(() => {}),
    ]);
    load();
  }, []);

  async function save() {
    try {
      const toNum = (v: any) => (v === "" || v == null ? null : Number(v));
      const payload = {
        ...form,
        purchase_price: Number(form.purchase_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        category_id: form.category_id || null,
        unit_id: form.unit_id || null,
        currency_id: form.currency_id || null,
        mxik: form.mxik?.trim() || null,
        box_qty: toNum(form.box_qty),
        dim_length: toNum(form.dim_length),
        dim_width: toNum(form.dim_width),
        dim_height: toNum(form.dim_height),
        dim_weight: toNum(form.dim_weight),
        extra_barcodes: form.extra_barcodes?.filter(Boolean) || [],
        tag_ids: form.tag_ids || [],
      };
      if (editId) await api.put(`/warehouse/products/${editId}`, payload);
      else await api.post("/warehouse/products", payload);
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false);
      load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "MXIK xato"));
    }
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    await api.delete(`/warehouse/products/${deleteTarget.id}`);
    toast.success(t("ui__удалено_0c450c40"));
    setDeleteTarget(null);
    load();
  }

  const columns: Column<Product>[] = [
    { key: "sku", header: "SKU", width: "120px", render: (r) => r.sku || "—" },
    { key: "barcode", header: t("ui__штрих_код_067fa0f2"), width: "140px", render: (r) => r.barcode || "—" },
    { key: "mxik", header: t("mxik"), width: "130px",
      render: (r) => <span className="font-mono text-xs">{r.mxik || "—"}</span> },
    { key: "name", header: t("ui__название_602680ed") },
    { key: "category_name", header: t("ui__категория_c95a1e2d"), width: "140px", render: (r) => r.category_name || "—" },
    { key: "unit_name", header: t("ui__ед_11f95ddc"), width: "80px", render: (r) => r.unit_name || "—" },
    { key: "purchase_price", header: t("ui__закуп_57c36fc5"), align: "right", width: "120px",
      render: (r) => <span className="font-mono">{fmt(r.purchase_price)}</span> },
    { key: "sale_price", header: t("ui__продажа_78b786c5"), align: "right", width: "140px",
      render: (r) => <span className="font-mono">{fmt(r.sale_price)} {r.currency_code}</span> },
    { key: "total_stock", header: t("ui__остаток_9a6054b1"), align: "right", width: "100px",
      render: (r) => <span className="font-mono">{r.is_service ? "—" : fmt(r.total_stock)}</span> },
    { key: "is_service", header: t("ui__тип_345805b8"), align: "center", width: "100px",
      render: (r) =>
        r.is_service ? <span className="text-xs text-blue-700 dark:text-blue-400">{t("ui__услуга_8bf3c249")}</span>
        : r.is_produced ? <span className="text-xs text-purple-700 dark:text-purple-400">{t("ui__произв_ea4594a1")}</span>
        : <span className="text-xs text-slate-600 dark:text-slate-400">{t("ui__товар_8b35db64")}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__товары_2ccd69a3")} description={t("ui__каталог_товаров_и_услуг_b8c9dd1f")}
        onCreate={() => { setForm(empty); setEditId(null); setOpen(true); }} />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="col-span-2 relative">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">{t("ui__поиск_название_sku_штрих_код_369d9946")}</label>
          <Search size={14} className="absolute left-2.5 top-[34px] text-slate-400" />
          <input className={`${input} pl-8`} placeholder={t("ui__поиск_b84a8f87")}
            value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && load()} />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">{t("ui__категория_c95a1e2d")}</label>
          <select className={input} value={filters.category_id}
            onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}>
            <option value="">{t("ui__все_a07b234e")}</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <select className={input} value={filters.is_service}
            onChange={(e) => setFilters({ ...filters, is_service: e.target.value })}>
            <option value="">{t("ui__все_типы_eb6499ca")}</option>
            <option value="false">{t("ui__товары_2ccd69a3")}</option>
            <option value="true">{t("ui__услуги_4e1a0e95")}</option>
          </select>
          <button onClick={load} className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700">{t("ui__фильтр_2f884b41")}</button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <DataTable columns={columns} rows={rows} loading={loading}
          onEdit={async (r) => {
            // Load full record (with extra_barcodes + tags)
            try {
              const full = await api.get<any>(`/warehouse/products/${r.id}/full`);
              const d = full.data;
              setForm({
                ...empty,
                name: d.name, sku: d.sku || "", barcode: d.barcode || "",
                mxik: d.mxik || "",
                category_id: d.category_id || null, unit_id: d.unit_id || null,
                purchase_price: d.purchase_price, sale_price: d.sale_price,
                currency_id: d.currency_id || null,
                is_service: !!d.is_service, is_material: !!d.is_material,
                is_semi_product: !!d.is_semi_product, is_marked: !!d.is_marked,
                has_expiration: !!d.has_expiration,
                image_url: d.image_url || "", box_qty: d.box_qty || "",
                box_barcode: d.box_barcode || "",
                dim_length: d.dim_length || "", dim_width: d.dim_width || "",
                dim_height: d.dim_height || "", dim_weight: d.dim_weight || "",
                description: d.description || "",
                extra_barcodes: (d.extra_barcodes || []).map((b: any) => b.barcode),
                tag_ids: (d.tags || []).map((t: any) => t.id),
              });
            } catch {
              setForm({
                ...empty, name: r.name, sku: r.sku || "", barcode: r.barcode || "",
                category_id: r.category_id || null, unit_id: r.unit_id || null,
                purchase_price: r.purchase_price, sale_price: r.sale_price,
                currency_id: r.currency_id || null, is_service: r.is_service,
              });
            }
            setEditId(r.id); setOpen(true);
          }}
          onDelete={(r) => setDeleteTarget(r)} />
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-2">
        {loading && (
          <li className="text-center text-sm text-slate-400 py-8">{t("ui__загрузка_43e40d49")}</li>
        )}
        {!loading && rows.length === 0 && (
          <li className="text-center text-sm text-slate-400 py-8">{t("ui__нет_данных_dee9a2d8")}</li>
        )}
        {rows.map((r) => (
          <li key={r.id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{r.name}</div>
                {r.sku && <div className="text-xs text-slate-500 font-mono truncate">SKU: {r.sku}</div>}
                {r.mxik && <div className="text-xs text-slate-500 font-mono truncate">{t("mxik")}: {r.mxik}</div>}
                {r.barcode && <div className="text-xs text-slate-500 font-mono truncate">Barcode: {r.barcode}</div>}
                {r.category_name && <div className="text-xs text-slate-400 truncate">{r.category_name}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-sm">{fmt(r.sale_price)} {r.currency_code}</div>
                <div className="text-xs text-slate-500">{r.unit_name || "—"}</div>
                {!r.is_service && (
                  <div className="text-xs text-slate-400">{t("ui__остаток_9a6054b1")}: {fmt(r.total_stock)}</div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                aria-label="Tahrirlash"
                onClick={async () => {
                  try {
                    const full = await api.get<any>(`/warehouse/products/${r.id}/full`);
                    const d = full.data;
                    setForm({
                      ...empty,
                      name: d.name, sku: d.sku || "", barcode: d.barcode || "",
                      mxik: d.mxik || "",
                      category_id: d.category_id || null, unit_id: d.unit_id || null,
                      purchase_price: d.purchase_price, sale_price: d.sale_price,
                      currency_id: d.currency_id || null,
                      is_service: !!d.is_service, is_material: !!d.is_material,
                      is_semi_product: !!d.is_semi_product, is_marked: !!d.is_marked,
                      has_expiration: !!d.has_expiration,
                      image_url: d.image_url || "", box_qty: d.box_qty || "",
                      box_barcode: d.box_barcode || "",
                      dim_length: d.dim_length || "", dim_width: d.dim_width || "",
                      dim_height: d.dim_height || "", dim_weight: d.dim_weight || "",
                      description: d.description || "",
                      extra_barcodes: (d.extra_barcodes || []).map((b: any) => b.barcode),
                      tag_ids: (d.tags || []).map((t: any) => t.id),
                    });
                  } catch {
                    setForm({
                      ...empty, name: r.name, sku: r.sku || "", barcode: r.barcode || "",
                      category_id: r.category_id || null, unit_id: r.unit_id || null,
                      purchase_price: r.purchase_price, sale_price: r.sale_price,
                      currency_id: r.currency_id || null, is_service: r.is_service,
                    });
                  }
                  setEditId(r.id); setOpen(true);
                }}
                className="text-xs text-brand-600 hover:text-brand-700"
              >
                Tahrir
              </button>
              <button
                aria-label="O'chirish"
                onClick={() => setDeleteTarget(r)}
                className="text-xs text-rose-600 hover:text-rose-700"
              >
                O&apos;chir
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Modal open={open} onClose={() => setOpen(false)}
        title={editId ? "Mahsulotni tahrirlash" : "Yangi mahsulot"} size="lg">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label={t("ui__название_602680ed")} required>
              <input className={input} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          </div>
          <Field label="SKU">
            <input className={input} value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </Field>
          <Field label={t("mxik")}>
            <input
              className={input}
              inputMode="numeric"
              placeholder={t("mxik_placeholder")}
              value={form.mxik || ""}
              onChange={(e) =>
                setForm({ ...form, mxik: e.target.value.replace(/\D/g, "").slice(0, 17) })
              }
            />
          </Field>
          <Field label={t("ui__штрих_код_067fa0f2")}>
            <input className={input} value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          </Field>
          <Field label={t("ui__категория_c95a1e2d")}>
            <select className={input} value={form.category_id || ""}
              onChange={(e) => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t("ui__нет_7b07413e")}</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t("ui__единица_c0ffee84")}>
            <select className={input} value={form.unit_id || ""}
              onChange={(e) => setForm({ ...form, unit_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t("ui__нет_7b07413e")}</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label={t("ui__цена_закупа_9ae1384c")}>
            <input type="number" step="0.01" className={input} value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
          </Field>
          <Field label={t("ui__цена_продажи_b379afd3")}>
            <input type="number" step="0.01" className={input} value={form.sale_price}
              onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
          </Field>
          <Field label={t("ui__валюта_cf55d9a9")}>
            <select className={input} value={form.currency_id || ""}
              onChange={(e) => setForm({ ...form, currency_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">{t("ui__нет_7b07413e")}</option>
              {currencies.map((c) => <option key={c.id} value={c.id}>{(c as any).code || c.name}</option>)}
            </select>
          </Field>
          <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded border border-slate-200 dark:border-slate-700">
            <div className="col-span-3 text-xs font-semibold text-slate-500 uppercase">Tur va flag'lar</div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_service}
                onChange={(e) => setForm({ ...form, is_service: e.target.checked })} />
              Xizmat (sklad yo'q)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_material}
                onChange={(e) => setForm({ ...form, is_material: e.target.checked })} />
              Xom-ashyo (material)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_semi_product}
                onChange={(e) => setForm({ ...form, is_semi_product: e.target.checked })} />
              Yarim tayyor mahsulot
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_marked}
                onChange={(e) => setForm({ ...form, is_marked: e.target.checked })} />
              Markirovkali (Soliq.uz)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.has_expiration}
                onChange={(e) => setForm({ ...form, has_expiration: e.target.checked })} />
              Yaroqlilik muddati bor
            </label>
          </div>

          <div className="col-span-2 grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase">Qo'shimcha shtrix-kodlar</div>
            <div className="col-span-2">
              <textarea className={`${input} h-16 font-mono text-xs`}
                placeholder="Har qatorda bitta shtrix-kod"
                value={(form.extra_barcodes || []).join("\n")}
                onChange={(e) => setForm({ ...form, extra_barcodes: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
            </div>
            <Field label="Quti shtrix-kodi">
              <input className={input} value={form.box_barcode}
                onChange={(e) => setForm({ ...form, box_barcode: e.target.value })} />
            </Field>
            <Field label="Quti hajmi (ta)">
              <input type="number" className={input} value={form.box_qty}
                onChange={(e) => setForm({ ...form, box_qty: e.target.value })} />
            </Field>
          </div>

          <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 text-xs font-semibold text-slate-500 uppercase">O'lcham va vazn</div>
            <Field label="Uzunlik (sm)">
              <input type="number" step="0.1" className={input} value={form.dim_length}
                onChange={(e) => setForm({ ...form, dim_length: e.target.value })} />
            </Field>
            <Field label="Eni (sm)">
              <input type="number" step="0.1" className={input} value={form.dim_width}
                onChange={(e) => setForm({ ...form, dim_width: e.target.value })} />
            </Field>
            <Field label="Bo'yi (sm)">
              <input type="number" step="0.1" className={input} value={form.dim_height}
                onChange={(e) => setForm({ ...form, dim_height: e.target.value })} />
            </Field>
            <Field label="Vazn (kg)">
              <input type="number" step="0.001" className={input} value={form.dim_weight}
                onChange={(e) => setForm({ ...form, dim_weight: e.target.value })} />
            </Field>
          </div>

          <div className="col-span-2 mt-2">
            <Field label="Rasm URL">
              <input className={input} value={form.image_url} placeholder="https://..."
                onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
            </Field>
          </div>

          <div className="col-span-2 mt-2">
            <Field label="Tavsif">
              <textarea className={`${input} h-16`} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>

          <div className="col-span-2 mt-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">Teglar</label>
            <TagsInput value={form.tag_ids} onChange={(ids) => setForm({ ...form, tag_ids: ids })} />
          </div>

          {editId && <CustomFieldsEditor entityType="product" entityId={editId} />}

          <div className="col-span-2 flex justify-end gap-2 pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700">{t("ui__отмена_987b33c6")}</button>
            <button onClick={save}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__сохранить_74ea58b6")}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="O'chirishni tasdiqlang"
        message={`«${deleteTarget?.name}» mahsulotini o'chirishni tasdiqlaysizmi?`}
      />
    </div>
  );
}
