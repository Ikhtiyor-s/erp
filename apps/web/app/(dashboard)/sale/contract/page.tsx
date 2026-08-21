"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Eye, Search } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Sale = {
  id: string;
  doc_number?: string;
  uuid_label: string;
  sale_date: string;
  total_amount: string;
  paid_amount: string;
  status: string;
  notes?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  org_name?: string;
  warehouse_name?: string;
  created_by_name?: string;
  currency_code?: string;
};
type Customer = { id: string; name: string };
type Warehouse = { id: number; name: string };
type Product = { id: string; name: string; sale_price: string; sku?: string };
type Currency = { id: number; code: string; is_base: boolean };
type Line = {
  product_id: string;
  quantity: number;
  price: number;
  discount: number;
};

const empty = () => ({
  customer_id: "",
  warehouse_id: null as number | null,
  currency_id: null as number | null,
  notes: "",
  items: [{ product_id: "", quantity: 1, price: 0, discount: 0 }] as Line[],
});

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const statusBadge = (s: string) =>
  ({
    draft: "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300",
    confirmed: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    paid: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
    partial: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300",
    cancelled: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  }[s] || "bg-slate-100 text-slate-700");

const statusLabel = (s: string) =>
  ({
    draft: "Qoralama",
    confirmed: "Tasdiqlandi",
    paid: "To'landi",
    partial: "Qisman",
    cancelled: "Bekor qilindi",
  }[s] || s);

export default function SaleContractPage() {
  const t = useTranslations("ui");
  const router = useRouter();
  const [rows, setRows] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ReturnType<typeof empty>>(empty());

  const [filters, setFilters] = useState({
    q: "",
    customer_id: "",
    status: "",
    date_from: "",
    date_to: "",
  });

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("limit", "200");
      if (filters.q) p.set("q", filters.q);
      if (filters.customer_id) p.set("customer_id", filters.customer_id);
      if (filters.status) p.set("status", filters.status);
      if (filters.date_from) p.set("date_from", filters.date_from);
      if (filters.date_to) p.set("date_to", filters.date_to);
      setRows((await api.get<Sale[]>(`/sale/sales?${p}`)).data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      api
        .get<Customer[]>("/customer/customers?limit=200")
        .then((r) => setCustomers(r.data))
        .catch(() => {}),
      api
        .get<Warehouse[]>("/warehouse/warehouses")
        .then((r) => setWarehouses(r.data))
        .catch(() => {}),
      api
        .get<Product[]>("/warehouse/products?limit=300")
        .then((r) => setProducts(r.data))
        .catch(() => {}),
      api
        .get<Currency[]>("/reference/currencies")
        .then((r) => setCurrencies(r.data))
        .catch(() => {}),
    ]);
    load();
  }, []);

  function addLine() {
    setForm({
      ...form,
      items: [
        ...form.items,
        { product_id: "", quantity: 1, price: 0, discount: 0 },
      ],
    });
  }
  function removeLine(idx: number) {
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  }
  function setLine(idx: number, k: keyof Line, v: any) {
    const items = [...form.items];
    (items[idx] as any)[k] = v;
    if (k === "product_id") {
      const p = products.find((x) => x.id === v);
      if (p) items[idx].price = Number(p.sale_price) || 0;
    }
    setForm({ ...form, items });
  }

  const total = form.items.reduce(
    (s, i) => s + (i.quantity * i.price - i.discount),
    0
  );

  async function save() {
    if (!form.warehouse_id) return toast.error(t("ui__выберите_склад_b9bc3ffe"));
    if (!form.currency_id) return toast.error(t("ui__выберите_валюту_99fe6d8b"));
    if (form.items.some((i) => !i.product_id))
      return toast.error(t("ui__выберите_товар_во_всех_строках_c53b1724"));

    try {
      await api.post("/sale/sales", {
        customer_id: form.customer_id || null,
        warehouse_id: form.warehouse_id,
        currency_id: form.currency_id,
        notes: form.notes,
        items: form.items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          price: i.price,
          discount: i.discount,
        })),
      });
      toast.success(t("ui__продажа_создана_4b75175b"));
      setOpen(false);
      setForm(empty());
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Sotuv yaratishda xato"));
    }
  }

  const columns: Column<Sale>[] = [
    {
      key: "doc_number",
      header: t("ui__номер_d6d264ff"),
      width: "100px",
      render: (r) => r.doc_number || r.id.slice(0, 8),
    },
    {
      key: "uuid_label",
      header: t("ui__id_номер_e669322b"),
      width: "120px",
      render: (r) => (
        <code className="text-xs text-slate-600 dark:text-slate-400">
          {r.uuid_label}
        </code>
      ),
    },
    {
      key: "org_name",
      header: t("ui__организация_5e591067"),
      width: "150px",
      render: (r) => r.org_name || "—",
    },
    {
      key: "created_by_name",
      header: t("ui__создано_кем_594548b1"),
      width: "160px",
      render: (r) => r.created_by_name || "—",
    },
    {
      key: "sale_date",
      header: t("ui__дата_8cdd8bb7"),
      width: "160px",
      render: (r) => new Date(r.sale_date).toLocaleString("ru-RU"),
    },
    {
      key: "customer_name",
      header: t("ui__клиент_4af22f2d"),
      render: (r) => r.customer_name || "Chakana",
    },
    {
      key: "customer_phone",
      header: t("ui__телефон_2928e19c"),
      width: "150px",
      render: (r) => r.customer_phone || "—",
    },
    {
      key: "total_amount",
      header: t("ui__сумма_cf59ebf9"),
      align: "right",
      width: "150px",
      render: (r) => (
        <span className="font-mono">
          {fmt(r.total_amount)} {r.currency_code}
        </span>
      ),
    },
    {
      key: "paid_amount",
      header: t("ui__оплачено_6d8c0850"),
      align: "right",
      width: "130px",
      render: (r) => (
        <span className="font-mono text-green-700 dark:text-green-400">
          {fmt(r.paid_amount)}
        </span>
      ),
    },
    {
      key: "status",
      header: t("ui__статус_7203f7a4"),
      align: "center",
      width: "130px",
      render: (r) => (
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${statusBadge(
            r.status
          )}`}
        >
          {statusLabel(r.status)}
        </span>
      ),
    },
    {
      key: "id" as any,
      header: "",
      align: "center",
      width: "60px",
      render: (r) => (
        <button
          onClick={() => router.push(`/sale/contract/${r.id}`)}
          className="text-brand-600 hover:text-brand-700 dark:text-brand-400"
          title={t("ui__открыть_e946df6c")}
        >
          <Eye size={14} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__продажи_контракты_148232c8")}
        description={t("ui__реестр_продаж_40274008")}
        onCreate={() => {
          setForm(empty());
          setOpen(true);
        }}
        createLabel={t("ui__новая_продажа_4fbfd3e3")}
      />

      {/* Filters panel */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="sm:col-span-2 relative">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_клиент_телефон_7d318763")}
          </label>
          <Search
            size={14}
            className="absolute left-2.5 top-[34px] text-slate-400"
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
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__клиент_4af22f2d")}
          </label>
          <select
            className={input}
            value={filters.customer_id}
            onChange={(e) =>
              setFilters({ ...filters, customer_id: e.target.value })
            }
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__статус_7203f7a4")}
          </label>
          <select
            className={input}
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value })
            }
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            <option value="draft">{t("ui__черновик_30ab6155")}</option>
            <option value="confirmed">{t("ui__подтверждено_fe630d99")}</option>
            <option value="paid">{t("ui__оплачено_6d8c0850")}</option>
            <option value="partial">{t("ui__частично_5f397585")}</option>
            <option value="cancelled">{t("ui__отменено_81a04dab")}</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__с_даты_09fc6619")}
          </label>
          <input
            type="date"
            className={input}
            value={filters.date_from}
            onChange={(e) =>
              setFilters({ ...filters, date_from: e.target.value })
            }
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__по_дату_760bcfc8")}
          </label>
          <input
            type="date"
            className={input}
            value={filters.date_to}
            onChange={(e) =>
              setFilters({ ...filters, date_to: e.target.value })
            }
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={load}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm"
          >
            {t("ui__фильтр_2f884b41")}
          </button>
          <button
            onClick={() => {
              setFilters({
                q: "",
                customer_id: "",
                status: "",
                date_from: "",
                date_to: "",
              });
              setTimeout(load, 0);
            }}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {t("ui__сброс_1b421ddb")}
          </button>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("ui__новая_продажа_4fbfd3e3")}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <Field label={t("ui__клиент_4af22f2d")}>
              <select
                className={input}
                value={form.customer_id}
                onChange={(e) =>
                  setForm({ ...form, customer_id: e.target.value })
                }
              >
                <option value="">{t("ui__розничный_db755a2a")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ui__склад_e8bf999f")} required>
              <select
                className={input}
                value={form.warehouse_id || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    warehouse_id: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              >
                <option value="">{t("ui__выбрать_fbbc1d13")}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ui__валюта_cf55d9a9")} required>
              <select
                className={input}
                value={form.currency_id || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    currency_id: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              >
                <option value="">{t("ui__выбрать_fbbc1d13")}</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2">{t("ui__товар_8b35db64")}</th>
                  <th className="text-right px-3 py-2 w-24">{t("ui__кол_во_302e2bd6")}</th>
                  <th className="text-right px-3 py-2 w-32">{t("ui__цена_682fa8db")}</th>
                  <th className="text-right px-3 py-2 w-28">{t("ui__скидка_d9039617")}</th>
                  <th className="text-right px-3 py-2 w-32">{t("ui__сумма_cf59ebf9")}</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, idx) => (
                  <tr
                    key={idx}
                    className="border-t border-slate-200 dark:border-slate-700"
                  >
                    <td className="px-3 py-2">
                      <select
                        className={input}
                        value={it.product_id}
                        onChange={(e) =>
                          setLine(idx, "product_id", e.target.value)
                        }
                      >
                        <option value="">{t("ui__товар_8c2c36d6")}</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.sku ? ` (${p.sku})` : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.001"
                        className={`${input} text-right`}
                        value={it.quantity}
                        onChange={(e) =>
                          setLine(idx, "quantity", Number(e.target.value))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        className={`${input} text-right`}
                        value={it.price}
                        onChange={(e) =>
                          setLine(idx, "price", Number(e.target.value))
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        className={`${input} text-right`}
                        value={it.discount}
                        onChange={(e) =>
                          setLine(idx, "discount", Number(e.target.value))
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {fmt(it.quantity * it.price - it.discount)}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => removeLine(idx)}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/40 p-1 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-900/40 font-semibold">
                  <td className="px-3 py-2" colSpan={4}>
                    {t("ui__итого_edcf3920")}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {fmt(total)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <button
            onClick={addLine}
            className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            <Plus size={14} /> {t("ui__добавить_строку_d70236f2")}
          </button>

          <Field label={t("ui__заметки_c8866295")}>
            <textarea
              className={input}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {t("ui__отмена_987b33c6")}
            </button>
            <button
              onClick={save}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700"
            >
              {t("ui__провести_продажу_3564388d")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
