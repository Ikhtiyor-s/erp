"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Search, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProductPicker, type PickerItem } from "@/components/warehouse/product-picker";
import { useTranslations } from "next-intl";
import { usePermissions } from "@/lib/permissions";

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

type PickProgress = {
  picked_count: number;
  total_items: number;
};

type Customer = { id: string; name: string };
type Warehouse = { id: number; name: string };
type Currency = { id: number; code: string; is_base: boolean };
type CashboxOption = { id: number; name: string; warehouse_id?: number | null; warehouse_name?: string | null };

type BomComponent = {
  component_id: string;
  component_name: string;
  qty: number;
  unit_name: string | null;
};

type BomCache = Record<string, { loading: boolean; components: BomComponent[] }>;

type Line = {
  product_id: string;
  product_name: string;
  unit_name: string;
  quantity: number;
  price: number;
  discount: number;
};

const empty = () => ({
  customer_id: "",
  cashbox_id: null as number | null,
  warehouse_id: null as number | null,
  warehouse_overridden: false,
  currency_id: null as number | null,
  notes: "",
  items: [] as Line[],
});

const fmt = (v: number | string) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const SALE_STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  confirmed: "info",
  paid: "success",
  partial: "warning",
  cancelled: "danger",
};

const statusLabel = (s: string) =>
  ({
    draft: "Qoralama",
    confirmed: "Tasdiqlandi",
    paid: "To'landi",
    partial: "Qisman",
    cancelled: "Bekor qilindi",
  }[s] || s);

function pickTone(picked: number, total: number): "neutral" | "success" | "primary" | "warning" {
  if (total === 0) return "neutral";
  if (picked >= total) return "success";
  if (picked > total / 2) return "primary";
  return "warning";
}

function pickBarClass(picked: number, total: number): string {
  if (total === 0) return "bg-ink-300";
  if (picked >= total) return "bg-success-500";
  return "bg-brand-500";
}

function PickProgressCell({ data }: { data: PickProgress | null }) {
  if (!data || data.total_items === 0) {
    return <span className="text-ink-400 text-xs">—</span>;
  }
  const pct = Math.round((data.picked_count / data.total_items) * 100);
  return (
    <div className="min-w-[72px]">
      <Badge tone={pickTone(data.picked_count, data.total_items)} className="mb-1">
        {data.picked_count}/{data.total_items}
      </Badge>
      <div className="h-1 rounded-full bg-ink-100 dark:bg-ink-800">
        <div className={`h-full rounded-full transition-all ${pickBarClass(data.picked_count, data.total_items)}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MobilePickBadge({ data }: { data: PickProgress | null }) {
  if (!data || data.total_items === 0) return null;
  const pct = Math.round((data.picked_count / data.total_items) * 100);
  return (
    <div className="mt-1">
      <Badge tone={pickTone(data.picked_count, data.total_items)}>
        {data.picked_count}/{data.total_items}
      </Badge>
      <div className="h-1 rounded-full bg-ink-100 dark:bg-ink-800 mt-0.5">
        <div className={`h-full rounded-full ${pickBarClass(data.picked_count, data.total_items)}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function SaleContractPage() {
  const t = useTranslations("ui");
  const tSale = useTranslations("sale.contract");
  const tPick = useTranslations("order.pick");
  const router = useRouter();
  const { can } = usePermissions();
  const showPick = can("order.pick.view");

  const [rows, setRows] = useState<Sale[]>([]);
  const [pickMap, setPickMap] = useState<Record<string, PickProgress>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [cashboxes, setCashboxes] = useState<CashboxOption[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ReturnType<typeof empty>>(empty());
  const [saving, setSaving] = useState(false);

  const [warehouseChangeTarget, setWarehouseChangeTarget] = useState<number | null>(null);
  const [confirmWarehouseOpen, setConfirmWarehouseOpen] = useState(false);

  const bomCacheRef = useRef<BomCache>({});
  const [bomCache, setBomCache] = useState<BomCache>({});
  const [expandedBom, setExpandedBom] = useState<Record<string, boolean>>({});

  const [filters, setFilters] = useState({
    q: "",
    customer_id: "",
    status: "",
    date_from: "",
    date_to: "",
  });

  const fetchPickSummary = useCallback(async (saleIds: string[]) => {
    if (!showPick || saleIds.length === 0) return;
    const CHUNK = 100;
    const map: Record<string, PickProgress> = {};
    for (let i = 0; i < saleIds.length; i += CHUNK) {
      const chunk = saleIds.slice(i, i + CHUNK);
      try {
        const r = await api.get<{ order_id: string; picked_count: number; total_items: number }[]>(
          `/orders/pick-summary?ids=${chunk.join(",")}`
        );
        for (const item of r.data) {
          map[item.order_id] = { picked_count: item.picked_count, total_items: item.total_items };
        }
      } catch {
        // non-fatal — pick summary is supplementary
      }
    }
    setPickMap(map);
  }, [showPick]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("limit", "200");
      if (filters.q) p.set("q", filters.q);
      if (filters.customer_id) p.set("customer_id", filters.customer_id);
      if (filters.status) p.set("status", filters.status);
      if (filters.date_from) p.set("date_from", filters.date_from);
      if (filters.date_to) p.set("date_to", filters.date_to);
      const salesData = (await api.get<Sale[]>(`/sale/sales?${p}`)).data;
      setRows(salesData);
      fetchPickSummary(salesData.map((s) => s.id));
    } finally {
      setLoading(false);
    }
  }, [filters, fetchPickSummary]);

  useEffect(() => {
    Promise.all([
      api.get<Customer[]>("/customer/customers?limit=200").then((r) => setCustomers(r.data)).catch(() => {}),
      api.get<Warehouse[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)).catch(() => {}),
      api.get<Currency[]>("/reference/currencies").then((r) => setCurrencies(r.data)).catch(() => {}),
      api.get<CashboxOption[]>("/finance/cashboxes").then((r) => setCashboxes(r.data || [])).catch(() => {}),
    ]);
    load();
  }, []);

  function fetchBom(productId: string) {
    if (bomCacheRef.current[productId]) return;
    const loading = { loading: true, components: [] };
    bomCacheRef.current = { ...bomCacheRef.current, [productId]: loading };
    setBomCache((prev) => ({ ...prev, [productId]: loading }));
    api
      .get<{ items: BomComponent[] }>(`/warehouse/products/${productId}/bom`)
      .then((r) => {
        const done = { loading: false, components: r.data?.items ?? [] };
        bomCacheRef.current = { ...bomCacheRef.current, [productId]: done };
        setBomCache((prev) => ({ ...prev, [productId]: done }));
      })
      .catch(() => {
        const done = { loading: false, components: [] };
        bomCacheRef.current = { ...bomCacheRef.current, [productId]: done };
        setBomCache((prev) => ({ ...prev, [productId]: done }));
      });
  }

  function handleAdd(item: PickerItem) {
    if (form.items.some((i) => i.product_id === item.productId)) return;
    const line: Line = {
      product_id: item.productId,
      product_name: item.productName,
      unit_name: item.unitName,
      quantity: 1,
      price: 0,
      discount: 0,
    };
    setForm((f) => ({ ...f, items: [...f.items, line] }));
    fetchBom(item.productId);
  }

  function removeItem(productId: string) {
    setForm((f) => ({ ...f, items: f.items.filter((i) => i.product_id !== productId) }));
  }

  function setLineField(productId: string, key: "quantity" | "price" | "discount", value: number) {
    setForm((f) => ({
      ...f,
      items: f.items.map((i) => (i.product_id === productId ? { ...i, [key]: value } : i)),
    }));
  }

  function handleCashboxChange(cid: number | null) {
    const cb = cid ? cashboxes.find((c) => c.id === cid) : null;
    if (cb?.warehouse_id) {
      if (form.items.length > 0 && cb.warehouse_id !== form.warehouse_id) {
        setWarehouseChangeTarget(cb.warehouse_id);
        setConfirmWarehouseOpen(true);
        setForm((f) => ({ ...f, cashbox_id: cid }));
      } else {
        setForm((f) => ({ ...f, cashbox_id: cid, warehouse_id: cb.warehouse_id!, warehouse_overridden: false, items: [] }));
        bomCacheRef.current = {};
        setBomCache({});
        setExpandedBom({});
      }
    } else {
      setForm((f) => ({ ...f, cashbox_id: cid }));
    }
  }

  function handleWarehouseChange(newWid: number | null) {
    if (form.items.length > 0 && newWid !== form.warehouse_id) {
      setWarehouseChangeTarget(newWid);
      setConfirmWarehouseOpen(true);
    } else {
      setForm((f) => ({ ...f, warehouse_id: newWid, items: [] }));
      bomCacheRef.current = {};
      setBomCache({});
      setExpandedBom({});
    }
  }

  function confirmWarehouseChange() {
    setForm((f) => ({ ...f, warehouse_id: warehouseChangeTarget, items: [], warehouse_overridden: f.cashbox_id ? false : f.warehouse_overridden }));
    bomCacheRef.current = {};
    setBomCache({});
    setExpandedBom({});
    setConfirmWarehouseOpen(false);
    setWarehouseChangeTarget(null);
  }

  function toggleBom(productId: string) {
    setExpandedBom((prev) => ({ ...prev, [productId]: !prev[productId] }));
  }

  const hasInvalidQty = form.items.some((i) => i.quantity <= 0);
  const total = form.items.reduce((s, i) => s + i.quantity * i.price - i.discount, 0);

  async function save() {
    if (!form.warehouse_id) return toast.error(t("ui__выберите_склад_b9bc3ffe"));
    if (!form.currency_id) return toast.error(t("ui__выберите_валюту_99fe6d8b"));
    if (form.items.length === 0) return toast.error(t("ui__выберите_товар_во_всех_строках_c53b1724"));
    if (hasInvalidQty) return toast.error(tSale("qty_error"));
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        customer_id: form.customer_id || null,
        currency_id: form.currency_id,
        notes: form.notes,
        items: form.items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          price: i.price,
          discount: i.discount,
        })),
      };
      if (form.cashbox_id) {
        payload.cashbox_id = form.cashbox_id;
        if (form.warehouse_overridden && form.warehouse_id) {
          payload.warehouse_id = form.warehouse_id;
        }
      } else {
        payload.warehouse_id = form.warehouse_id;
      }
      await api.post("/sale/sales", payload);
      toast.success(t("ui__продажа_создана_4b75175b"));
      setOpen(false);
      setForm(empty());
      bomCacheRef.current = {};
      setBomCache({});
      setExpandedBom({});
      load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Sotuv yaratishda xato"));
    } finally {
      setSaving(false);
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
        <code className="text-xs text-ink-600 dark:text-ink-400">{r.uuid_label}</code>
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
      render: (r) => (
        <div>
          <div>{r.customer_name || "Chakana"}</div>
          <div className="md:hidden">
            {showPick && <MobilePickBadge data={pickMap[r.id] ?? null} />}
          </div>
        </div>
      ),
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
        <span className="font-mono text-success-700 dark:text-success-500">{fmt(r.paid_amount)}</span>
      ),
    },
    {
      key: "status",
      header: t("ui__статус_7203f7a4"),
      align: "center",
      width: "130px",
      render: (r) => (
        <Badge tone={SALE_STATUS_TONE[r.status] || "neutral"}>{statusLabel(r.status)}</Badge>
      ),
    },
    ...(showPick
      ? [
          {
            key: "pick" as keyof Sale,
            header: tPick("column_header"),
            align: "center" as const,
            width: "100px",
            render: (r: Sale) => (
              <div className="hidden md:block">
                <PickProgressCell data={pickMap[r.id] ?? null} />
              </div>
            ),
          },
        ]
      : []),
    {
      key: "id" as keyof Sale,
      header: "",
      align: "center",
      width: "60px",
      render: (r) => (
        <Button
          variant="ghost"
          size="xs"
          icon={Eye}
          onClick={() => router.push(`/sale/contract/${r.id}`)}
          title={t("ui__открыть_e946df6c")}
        />
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
          bomCacheRef.current = {};
          setBomCache({});
          setExpandedBom({});
          setOpen(true);
        }}
        createLabel={t("ui__новая_продажа_4fbfd3e3")}
      />

      <Card padding="md">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="sm:col-span-2 relative">
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__поиск_клиент_телефон_7d318763")}
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
            {t("ui__клиент_4af22f2d")}
          </label>
          <select
            className={input}
            value={filters.customer_id}
            onChange={(e) => setFilters({ ...filters, customer_id: e.target.value })}
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
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
            <option value="draft">{t("ui__черновик_30ab6155")}</option>
            <option value="confirmed">{t("ui__подтверждено_fe630d99")}</option>
            <option value="paid">{t("ui__оплачено_6d8c0850")}</option>
            <option value="partial">{t("ui__частично_5f397585")}</option>
            <option value="cancelled">{t("ui__отменено_81a04dab")}</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__с_даты_09fc6619")}
          </label>
          <input
            type="date"
            className={input}
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">
            {t("ui__по_дату_760bcfc8")}
          </label>
          <input
            type="date"
            className={input}
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button size="md" onClick={load}>
            {t("ui__фильтр_2f884b41")}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setFilters({ q: "", customer_id: "", status: "", date_from: "", date_to: "" });
              setTimeout(load, 0);
            }}
          >
            {t("ui__сброс_1b421ddb")}
          </Button>
        </div>
      </div>
      </Card>

      <DataTable columns={columns} rows={rows} loading={loading} />

      <ConfirmDialog
        open={confirmWarehouseOpen}
        onClose={() => {
          setConfirmWarehouseOpen(false);
          setWarehouseChangeTarget(null);
        }}
        onConfirm={confirmWarehouseChange}
        title={tSale("warehouse_change_title")}
        message={tSale("warehouse_change_msg")}
        variant="warning"
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("ui__новая_продажа_4fbfd3e3")}
        size="xl"
      >
        <div className="space-y-5">
          {/* Top fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Field label={t("ui__клиент_4af22f2d")}>
              <select
                className={input}
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
              >
                <option value="">{t("ui__розничный_db755a2a")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            {cashboxes.length > 0 && (
              <Field label={tSale("cashbox_label")}>
                <select
                  className={input}
                  value={form.cashbox_id || ""}
                  onChange={(e) => handleCashboxChange(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{tSale("cashbox_placeholder")}</option>
                  {cashboxes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={t("ui__склад_e8bf999f")} required>
              {form.cashbox_id && !can("sale.change_warehouse") ? (
                <div className={`${input} bg-ink-50 dark:bg-ink-900/40 text-ink-600 dark:text-ink-400 cursor-not-allowed`}>
                  {cashboxes.find((c) => c.id === form.cashbox_id)?.warehouse_name
                    || warehouses.find((w) => w.id === form.warehouse_id)?.name
                    || t("ui__выбрать_fbbc1d13")}
                  <span className="block text-xs text-ink-400 mt-0.5">{tSale("warehouse_auto_hint")}</span>
                </div>
              ) : (
                <select
                  className={input}
                  value={form.warehouse_id || ""}
                  onChange={(e) => {
                    const wid = e.target.value ? Number(e.target.value) : null;
                    if (form.cashbox_id) {
                      setForm((f) => ({ ...f, warehouse_overridden: true }));
                    }
                    handleWarehouseChange(wid);
                  }}
                >
                  <option value="">{t("ui__выбрать_fbbc1d13")}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t("ui__валюта_cf55d9a9")} required>
              <select
                className={input}
                value={form.currency_id || ""}
                onChange={(e) => setForm({ ...form, currency_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">{t("ui__выбрать_fbbc1d13")}</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>{c.code}</option>
                ))}
              </select>
            </Field>
            <Field label={t("ui__заметки_c8866295")}>
              <textarea
                className={input}
                rows={1}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>

          {/* ProductPicker */}
          <div className="border border-ink-200 dark:border-ink-700 rounded-lg p-3 space-y-2">
            {form.warehouse_id ? (
              <ProductPicker
                warehouseId={form.warehouse_id}
                selectedIds={form.items.map((i) => i.product_id)}
                onAdd={handleAdd}
                mode="multi"
              />
            ) : (
              <p className="text-sm text-ink-500 dark:text-ink-400 py-4 text-center">
                {tSale("pick_warehouse_first")}
              </p>
            )}
          </div>

          {/* Selected items */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-600 dark:text-ink-300 uppercase tracking-wide">
              {tSale("selected_products")}
            </p>

            {form.items.length === 0 ? (
              <p className="text-sm text-ink-400 dark:text-ink-500 py-3 text-center">
                {tSale("no_items_yet")}
              </p>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto rounded-md border border-ink-200 dark:border-ink-700">
                  <table className="w-full text-[13px]">
                    <thead className="bg-ink-50 dark:bg-ink-900/40 text-ink-600 dark:text-ink-300">
                      <tr>
                        <th className="text-left px-3 py-2">{tSale("product")}</th>
                        <th className="px-3 py-2 w-20 text-center">{tSale("unit")}</th>
                        <th className="px-3 py-2 w-28 text-right">{tSale("qty")}</th>
                        <th className="px-3 py-2 w-32 text-right">{tSale("price")}</th>
                        <th className="px-3 py-2 w-28 text-right">{tSale("discount")}</th>
                        <th className="px-3 py-2 w-32 text-right">{tSale("total")}</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((it) => {
                        const bom = bomCache[it.product_id];
                        const hasBom = bom && !bom.loading && bom.components.length > 0;
                        const isExpanded = expandedBom[it.product_id];
                        const qtyInvalid = it.quantity <= 0;

                        return (
                          <>
                            <tr key={it.product_id} className="border-t border-ink-200 dark:border-ink-700 hover:bg-ink-50/40 dark:hover:bg-ink-800/20">
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-ink-900 dark:text-ink-100">{it.product_name}</span>
                                  {hasBom && (
                                    <Badge tone="purple">{tSale("bom_badge")}</Badge>
                                  )}
                                  {bom?.loading && (
                                    <span className="inline-block w-3 h-3 rounded-full border-2 border-ink-300 border-t-brand-500 animate-spin" />
                                  )}
                                  {hasBom && (
                                    <button
                                      type="button"
                                      onClick={() => toggleBom(it.product_id)}
                                      className="inline-flex items-center gap-0.5 text-[11px] text-brand-600 hover:text-brand-700 dark:text-brand-400"
                                    >
                                      {isExpanded ? (
                                        <><ChevronUp size={12} />{tSale("hide_bom")}</>
                                      ) : (
                                        <><ChevronDown size={12} />{tSale("show_bom")}</>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center text-ink-500 dark:text-ink-400">{it.unit_name}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0.001"
                                  className={`${input} text-right ${qtyInvalid ? "border-danger-500 focus:border-danger-500 focus:ring-danger-500/30" : ""}`}
                                  value={it.quantity}
                                  onChange={(e) => setLineField(it.product_id, "quantity", Number(e.target.value))}
                                  placeholder={tSale("qty_placeholder")}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  className={`${input} text-right`}
                                  value={it.price}
                                  onChange={(e) => setLineField(it.product_id, "price", Number(e.target.value))}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  className={`${input} text-right`}
                                  value={it.discount}
                                  onChange={(e) => setLineField(it.product_id, "discount", Number(e.target.value))}
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-ink-800 dark:text-ink-200">
                                {fmt(it.quantity * it.price - it.discount)}
                              </td>
                              <td className="text-center px-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  icon={Trash2}
                                  onClick={() => removeItem(it.product_id)}
                                  title={tSale("remove")}
                                  className="text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15"
                                />
                              </td>
                            </tr>
                            {isExpanded && hasBom && (
                              <tr key={`${it.product_id}-bom`} className="bg-violet-50 dark:bg-violet-900/10 border-t border-violet-100 dark:border-violet-800/40">
                                <td colSpan={7} className="px-5 py-2">
                                  <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 mb-1.5">
                                    {tSale("bom_preview_title")}
                                  </p>
                                  <table className="w-full text-[12px]">
                                    <thead>
                                      <tr className="text-ink-500 dark:text-ink-400">
                                        <th className="text-left pb-1 font-medium">{tSale("bom_component")}</th>
                                        <th className="text-right pb-1 font-medium w-20">{tSale("bom_qty")}</th>
                                        <th className="text-left pb-1 font-medium w-20 pl-2">{tSale("bom_unit")}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {bom.components.map((c) => (
                                        <tr key={c.component_id} className="border-t border-violet-100 dark:border-violet-800/30">
                                          <td className="py-1 text-ink-800 dark:text-ink-200">{c.component_name}</td>
                                          <td className="py-1 text-right font-mono">{c.qty}</td>
                                          <td className="py-1 pl-2 text-ink-500 dark:text-ink-400">{c.unit_name ?? "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-ink-50 dark:bg-ink-900/40 font-semibold border-t border-ink-200 dark:border-ink-700">
                        <td className="px-3 py-2" colSpan={5}>{t("ui__итого_edcf3920")}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmt(total)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile cards */}
                <ul className="md:hidden space-y-3">
                  {form.items.map((it) => {
                    const bom = bomCache[it.product_id];
                    const hasBom = bom && !bom.loading && bom.components.length > 0;
                    const isExpanded = expandedBom[it.product_id];
                    const qtyInvalid = it.quantity <= 0;

                    return (
                      <li key={it.product_id} className="rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-[13px] font-medium text-ink-900 dark:text-ink-100">{it.product_name}</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[11px] text-ink-500 dark:text-ink-400">{it.unit_name}</span>
                              {hasBom && (
                                <Badge tone="purple">{tSale("bom_badge")}</Badge>
                              )}
                              {bom?.loading && (
                                <span className="inline-block w-3 h-3 rounded-full border-2 border-ink-300 border-t-brand-500 animate-spin" />
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            icon={Trash2}
                            onClick={() => removeItem(it.product_id)}
                            className="shrink-0 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-ink-500 dark:text-ink-400 block mb-0.5">{tSale("qty")}</label>
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              className={`${input} text-right text-[12px] ${qtyInvalid ? "border-danger-500" : ""}`}
                              value={it.quantity}
                              onChange={(e) => setLineField(it.product_id, "quantity", Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-ink-500 dark:text-ink-400 block mb-0.5">{tSale("price")}</label>
                            <input
                              type="number"
                              step="0.01"
                              className={`${input} text-right text-[12px]`}
                              value={it.price}
                              onChange={(e) => setLineField(it.product_id, "price", Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-ink-500 dark:text-ink-400 block mb-0.5">{tSale("discount")}</label>
                            <input
                              type="number"
                              step="0.01"
                              className={`${input} text-right text-[12px]`}
                              value={it.discount}
                              onChange={(e) => setLineField(it.product_id, "discount", Number(e.target.value))}
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[12px]">
                          <span className="text-ink-500 dark:text-ink-400">{tSale("total")}:</span>
                          <span className="font-mono font-semibold">{fmt(it.quantity * it.price - it.discount)}</span>
                        </div>

                        {hasBom && (
                          <button
                            type="button"
                            onClick={() => toggleBom(it.product_id)}
                            className="flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 dark:text-brand-400"
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {isExpanded ? tSale("hide_bom") : tSale("show_bom")}
                          </button>
                        )}

                        {isExpanded && hasBom && (
                          <div className="bg-violet-50 dark:bg-violet-900/10 rounded-md p-2 space-y-1">
                            <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">{tSale("bom_preview_title")}</p>
                            {bom.components.map((c) => (
                              <div key={c.component_id} className="flex items-center justify-between text-[12px]">
                                <span className="text-ink-800 dark:text-ink-200">{c.component_name}</span>
                                <span className="font-mono text-ink-500 dark:text-ink-400">{c.qty} {c.unit_name ?? ""}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}

                  <div className="flex justify-between items-center px-1 py-1 font-semibold text-[13px]">
                    <span>{t("ui__итого_edcf3920")}</span>
                    <span className="font-mono">{fmt(total)}</span>
                  </div>
                </ul>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-700">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("ui__отмена_987b33c6")}
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={hasInvalidQty || form.items.length === 0}
              loading={saving}
            >
              {tSale("save_btn")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
