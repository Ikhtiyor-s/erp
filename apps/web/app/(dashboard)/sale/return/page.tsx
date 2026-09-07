"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Trash2, Search } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "next-intl";

type Ret = {
  id: string;
  doc_number?: string;
  uuid_label: string;
  return_date: string;
  total_amount: string;
  status: string;
  invoice_number?: string;
  paid_amount: string;
  sale_doc?: string;
  reason_name?: string;
  return_type?: string;
  org_name?: string;
  responsible_name?: string;
  created_by_name?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
};

type Sale = {
  id: string;
  doc_number?: string;
  total_amount: string;
  customer_name?: string;
};
type Reason = { id: number; name: string; return_type: string };
type Wh = { id: number; name: string };
type Emp = { id: string; full_name: string };
type Customer = { id: string; name: string };
type Currency = { id: number; code: string };

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const RETURN_STATUS_TONE: Record<string, "success" | "neutral" | "danger"> = {
  completed: "success",
  draft: "neutral",
  cancelled: "danger",
};
const statusLabel = (s: string) =>
  ({ completed: "Bajarildi", draft: "Qoralama", cancelled: "Bekor qilindi" }[s] || s);

export default function ReturnPage() {
  const t = useTranslations("ui");
  const router = useRouter();
  const [rows, setRows] = useState<Ret[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [warehouses, setWarehouses] = useState<Wh[]>([]);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    q: "",
    customer_id: "",
    responsible_id: "",
    reason_id: "",
    return_type: "",
    date_from: "",
    date_to: "",
  });

  // Create form
  const empty = {
    sale_id: "",
    warehouse_id: "" as number | "",
    reason_id: "" as number | "",
    responsible_id: "",
    posrednik_id: "",
    currency_id: "" as number | "",
    invoice_number: "",
    status: "completed",
    notes: "",
    sync_date: "",
  };
  const [form, setForm] = useState<any>(empty);
  const [items, setItems] = useState<
    {
      product_id: string;
      product_name: string;
      unit_id: number | null;
      warehouse_id: number | null;
      quantity: string;
      price: string;
      discount: string;
      tax_included: string;
      tax_added: string;
      extra_price: string;
      notes: string;
    }[]
  >([]);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filters.q) p.set("q", filters.q);
      if (filters.customer_id) p.set("customer_id", filters.customer_id);
      if (filters.responsible_id) p.set("responsible_id", filters.responsible_id);
      if (filters.reason_id) p.set("reason_id", filters.reason_id);
      if (filters.return_type) p.set("return_type", filters.return_type);
      if (filters.date_from) p.set("date_from", filters.date_from);
      if (filters.date_to) p.set("date_to", filters.date_to);
      const url = p.toString()
        ? `/sale/returns?${p}`
        : "/sale/returns";
      setRows((await api.get<Ret[]>(url)).data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      api.get<Sale[]>("/sale/sales?limit=200").then((r) => setSales(r.data)),
      api
        .get<Reason[]>("/sale/return-reasons?only_active=true")
        .then((r) => setReasons(r.data)),
      api.get<Wh[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)),
      api.get<Emp[]>("/hr/employees").then((r) => setEmployees(r.data)),
      api
        .get<Customer[]>("/customer/customers?limit=200")
        .then((r) => setCustomers(r.data)),
      api
        .get<Currency[]>("/reference/currencies")
        .then((r) => setCurrencies(r.data)),
    ]).catch(() => {});
    load();
  }, []);

  async function pickSale(sid: string) {
    setForm({ ...form, sale_id: sid });
    if (!sid) {
      setItems([]);
      return;
    }
    const { data } = await api.get(`/sale/sales/${sid}`);
    setForm((f: any) => ({
      ...f,
      sale_id: sid,
      warehouse_id: data.head.warehouse_id,
      currency_id: data.head.currency_id,
    }));
    setItems(
      data.items.map((i: any) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        unit_id: null,
        warehouse_id: data.head.warehouse_id,
        quantity: String(i.quantity),
        price: String(i.price),
        discount: "0",
        tax_included: "0",
        tax_added: "0",
        extra_price: "0",
        notes: "",
      }))
    );
  }

  async function create() {
    if (!form.warehouse_id || items.length === 0) {
      toast.error(t("ui__выберите_склад_и_товары_a4794cc5"));
      return;
    }
    try {
      const payload: any = {
        warehouse_id: Number(form.warehouse_id),
        sale_id: form.sale_id || null,
        reason_id: form.reason_id ? Number(form.reason_id) : null,
        responsible_id: form.responsible_id || null,
        posrednik_id: form.posrednik_id || null,
        currency_id: form.currency_id ? Number(form.currency_id) : null,
        invoice_number: form.invoice_number || null,
        status: form.status,
        notes: form.notes || null,
        sync_date: form.sync_date || null,
        items: items.map((i) => ({
          product_id: i.product_id,
          unit_id: i.unit_id || null,
          warehouse_id: i.warehouse_id || null,
          quantity: Number(i.quantity) || 0,
          price: Number(i.price) || 0,
          discount: Number(i.discount) || 0,
          tax_included: Number(i.tax_included) || 0,
          tax_added: Number(i.tax_added) || 0,
          extra_price: Number(i.extra_price) || 0,
          notes: i.notes || null,
        })),
      };
      const { data } = await api.post("/sale/returns", payload);
      toast.success(`Qaytarish №${data.id.slice(0, 8)} yaratildi, summa ${fmt(data.total_amount)}`);
      setOpen(false);
      setForm(empty);
      setItems([]);
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Qaytarish yaratishda xato"));
    }
  }

  const cols: Column<Ret>[] = [
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
        <code className="text-xs text-ink-600 dark:text-ink-300">{r.uuid_label}</code>
      ),
    },
    {
      key: "org_name",
      header: t("ui__организация_5e591067"),
      width: "160px",
      render: (r) => r.org_name || "—",
    },
    {
      key: "responsible_name",
      header: t("ui__ответственный_ab60703b"),
      width: "180px",
      render: (r) => r.responsible_name || "—",
    },
    {
      key: "created_by_name",
      header: t("ui__создано_кем_594548b1"),
      width: "180px",
      render: (r) => r.created_by_name || "—",
    },
    {
      key: "return_date",
      header: t("ui__дата_8cdd8bb7"),
      width: "150px",
      render: (r) => new Date(r.return_date).toLocaleString("ru-RU"),
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
      width: "130px",
      render: (r) => <span className="font-mono">{fmt(r.total_amount)}</span>,
    },
    {
      key: "status",
      header: t("ui__статус_7203f7a4"),
      align: "center",
      width: "120px",
      render: (r) => (
        <Badge tone={RETURN_STATUS_TONE[r.status] || "neutral"}>
          {statusLabel(r.status)}
        </Badge>
      ),
    },
    {
      key: "id" as any,
      header: "",
      align: "center",
      width: "60px",
      render: (r) => (
        <Button
          variant="ghost"
          size="xs"
          icon={Eye}
          onClick={() => router.push(`/sale/return/${r.id}`)}
          title={t("ui__открыть_e946df6c")}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__возвраты_продаж_86e816cc")}
        description={t("ui__реестр_возвратов_от_клиентов_2eddee84")}
        onCreate={() => {
          setForm(empty);
          setItems([]);
          setOpen(true);
        }}
        createLabel={t("ui__новый_возврат_2c4f391a")}
      />

      {/* Filters */}
      <Card padding="md">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">{t("ui__поиск_клиент_телефон_7d318763")}</label>
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
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">{t("ui__тип_возврата_80dd2b37")}</label>
          <select
            className={input}
            value={filters.return_type}
            onChange={(e) =>
              setFilters({ ...filters, return_type: e.target.value })
            }
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            <option value="valid">{t("ui__действительный_adb84d7c")}</option>
            <option value="invalid">{t("ui__недействительный_cb867986")}</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">{t("ui__причина_d88300c7")}</label>
          <select
            className={input}
            value={filters.reason_id}
            onChange={(e) =>
              setFilters({ ...filters, reason_id: e.target.value })
            }
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">{t("ui__клиент_4af22f2d")}</label>
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
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">{t("ui__ответственный_ab60703b")}</label>
          <select
            className={input}
            value={filters.responsible_id}
            onChange={(e) =>
              setFilters({ ...filters, responsible_id: e.target.value })
            }
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">{t("ui__с_даты_09fc6619")}</label>
          <input
            type="date"
            className={input}
            value={filters.date_from}
            onChange={(e) =>
              setFilters({ ...filters, date_from: e.target.value })
            }
          />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">{t("ui__по_дату_760bcfc8")}</label>
            <input
              type="date"
              className={input}
              value={filters.date_to}
              onChange={(e) =>
                setFilters({ ...filters, date_to: e.target.value })
              }
            />
          </div>
          <Button size="md" onClick={load}>
            {t("ui__фильтр_2f884b41")}
          </Button>
        </div>
      </div>
      </Card>

      <DataTable columns={cols} rows={rows} loading={loading} />

      {/* Create Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={t("ui__новый_возврат_2c4f391a")}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <Field label={t("ui__продажа_78b786c5")}>
              <select
                className={input}
                value={form.sale_id}
                onChange={(e) => pickSale(e.target.value)}
              >
                <option value="">{t("ui__без_продажи_bc08307a")}</option>
                {sales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.doc_number || s.id.slice(0, 8)} — {fmt(s.total_amount)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ui__склад_возврата_92cddda5")} required>
              <select
                className={input}
                value={form.warehouse_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    warehouse_id: e.target.value
                      ? Number(e.target.value)
                      : "",
                  })
                }
              >
                <option value="">{t("ui__выберите_edab92dd")}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ui__валюта_cf55d9a9")}>
              <select
                className={input}
                value={form.currency_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    currency_id: e.target.value
                      ? Number(e.target.value)
                      : "",
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
            <Field label={t("ui__причина_d88300c7")}>
              <select
                className={input}
                value={form.reason_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reason_id: e.target.value ? Number(e.target.value) : "",
                  })
                }
              >
                <option value="">{t("ui__нет_7b07413e")}</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ui__ответственный_ab60703b")}>
              <select
                className={input}
                value={form.responsible_id}
                onChange={(e) =>
                  setForm({ ...form, responsible_id: e.target.value })
                }
              >
                <option value="">{t("ui__нет_7b07413e")}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ui__посредник_26986062")}>
              <select
                className={input}
                value={form.posrednik_id}
                onChange={(e) =>
                  setForm({ ...form, posrednik_id: e.target.value })
                }
              >
                <option value="">{t("ui__нет_7b07413e")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("ui__счёт_фактуры_bd709911")}>
              <input
                className={input}
                value={form.invoice_number}
                onChange={(e) =>
                  setForm({ ...form, invoice_number: e.target.value })
                }
              />
            </Field>
            <Field label={t("ui__статус_7203f7a4")}>
              <select
                className={input}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="completed">{t("ui__выполнено_c665d401")}</option>
                <option value="draft">{t("ui__черновик_30ab6155")}</option>
              </select>
            </Field>
            <Field label={t("ui__дата_синхронизации_98411631")}>
              <input
                type="datetime-local"
                className={input}
                value={form.sync_date}
                onChange={(e) =>
                  setForm({ ...form, sync_date: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label={t("ui__примечание_686eb72b")}>
            <textarea
              className={input}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          {items.length > 0 && (
            <div className="border rounded-md max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 dark:bg-ink-900/40 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left">{t("ui__товар_8b35db64")}</th>
                    <th className="px-2 py-2 text-right w-20">{t("ui__кол_во_302e2bd6")}</th>
                    <th className="px-2 py-2 text-right w-24">{t("ui__цена_682fa8db")}</th>
                    <th className="px-2 py-2 text-right w-20">{t("ui__скидка_d9039617")}</th>
                    <th className="px-2 py-2 text-right w-20">{t("ui__налог_58688e2f")}</th>
                    <th className="px-2 py-2 text-right w-20">{t("ui__доп_цена_8f010b4a")}</th>
                    <th className="px-2 py-2 text-right w-24">{t("ui__итого_edcf3920")}</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const lineTotal =
                      Number(it.quantity) * Number(it.price) +
                      Number(it.extra_price) -
                      Number(it.discount);
                    return (
                      <tr key={idx} className="border-t">
                        <td className="px-2 py-1">{it.product_name}</td>
                        <td className="px-2 py-1 text-right">
                          <input
                            type="number"
                            step="0.001"
                            value={it.quantity}
                            onChange={(e) => {
                              const n = [...items];
                              n[idx].quantity = e.target.value;
                              setItems(n);
                            }}
                            className="w-16 border rounded px-1 py-0.5 text-right text-xs"
                          />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={it.price}
                            onChange={(e) => {
                              const n = [...items];
                              n[idx].price = e.target.value;
                              setItems(n);
                            }}
                            className="w-20 border rounded px-1 py-0.5 text-right text-xs"
                          />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={it.discount}
                            onChange={(e) => {
                              const n = [...items];
                              n[idx].discount = e.target.value;
                              setItems(n);
                            }}
                            className="w-16 border rounded px-1 py-0.5 text-right text-xs"
                          />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={it.tax_added}
                            onChange={(e) => {
                              const n = [...items];
                              n[idx].tax_added = e.target.value;
                              setItems(n);
                            }}
                            className="w-16 border rounded px-1 py-0.5 text-right text-xs"
                          />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={it.extra_price}
                            onChange={(e) => {
                              const n = [...items];
                              n[idx].extra_price = e.target.value;
                              setItems(n);
                            }}
                            className="w-16 border rounded px-1 py-0.5 text-right text-xs"
                          />
                        </td>
                        <td className="px-2 py-1 text-right font-mono">
                          {fmt(lineTotal)}
                        </td>
                        <td className="text-center">
                          <Button
                            variant="ghost"
                            size="xs"
                            icon={Trash2}
                            onClick={() =>
                              setItems(items.filter((_, i) => i !== idx))
                            }
                            className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("ui__отмена_987b33c6")}
            </Button>
            <Button onClick={create}>
              {t("ui__оформить_возврат_d843855e")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
