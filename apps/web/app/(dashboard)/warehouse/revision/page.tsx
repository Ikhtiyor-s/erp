"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

type InventoryStatus =
  | "draft"
  | "in_progress"
  | "paused"
  | "pending_confirmation"
  | "completed"
  | "cancelled";

type Inv = {
  id: string;
  doc_number?: string;
  status: InventoryStatus;
  started_at?: string;
  warehouse_name?: string;
  blind_count?: boolean;
};

type Wh = { id: number; name: string };
type Product = { id: string; name: string; sku?: string };

const STATUS_TONE: Record<InventoryStatus, "neutral" | "warning" | "info" | "purple" | "success" | "danger"> = {
  draft: "neutral",
  in_progress: "warning",
  paused: "info",
  pending_confirmation: "purple",
  completed: "success",
  cancelled: "danger",
};

export default function RevisionPage() {
  const t = useTranslations("warehouse.inventory");
  const router = useRouter();

  const [rows, setRows] = useState<Inv[]>([]);
  const [warehouses, setWarehouses] = useState<Wh[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [whId, setWhId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [blindCount, setBlindCount] = useState(false);
  const [items, setItems] = useState<{ product_id: string; product_name: string; actual_qty: string }[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows((await api.get<Inv[]>("/warehouse/inventories")).data);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api
      .get<Wh[]>("/warehouse/warehouses")
      .then((r) => setWarehouses(r.data))
      .catch(() => {});
    load();
  }, []);

  useEffect(() => {
    if (productSearch.length < 2) { setProductOptions([]); return; }
    const timer = setTimeout(() => {
      api
        .get<Product[]>(`/warehouse/products?q=${encodeURIComponent(productSearch)}`)
        .then((r) => setProductOptions(r.data.slice(0, 10)))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [productSearch]);

  function addItem(p: Product) {
    if (items.some((i) => i.product_id === p.id)) return;
    setItems([...items, { product_id: p.id, product_name: p.name, actual_qty: "0" }]);
    setProductSearch("");
    setProductOptions([]);
  }

  function openCreate() {
    setWhId("");
    setNotes("");
    setBlindCount(false);
    setItems([]);
    setProductSearch("");
    setProductOptions([]);
    setOpen(true);
  }

  async function create() {
    if (!whId) { toast.error(t("validation_warehouse")); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        warehouse_id: Number(whId),
        notes,
        blind_count: blindCount,
      };
      if (items.length > 0) {
        payload.items = items.map((i) => ({
          product_id: i.product_id,
          actual_qty: Number(i.actual_qty) || 0,
        }));
      }
      const { data } = await api.post<{ id: string }>("/warehouse/inventories", payload);
      toast.success(t("created_ok"));
      setOpen(false);
      router.push(`/warehouse/revision/${data.id}`);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, t("load_error")));
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<Inv>[] = [
    {
      key: "doc_number",
      header: t("col_doc"),
      width: "120px",
      render: (r) => r.doc_number || r.id.slice(0, 8),
    },
    { key: "warehouse_name", header: t("col_warehouse") },
    {
      key: "status",
      header: t("col_status"),
      width: "160px",
      render: (r) => (
        <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
          {t(`status_${r.status}` as Parameters<typeof t>[0])}
        </Badge>
      ),
    },
    {
      key: "blind_count" as keyof Inv,
      header: t("blind_count"),
      width: "100px",
      render: (r) =>
        r.blind_count ? (
          <Badge tone="neutral">{t("blind_count_badge")}</Badge>
        ) : null,
    },
    {
      key: "started_at",
      header: t("col_started"),
      width: "160px",
      render: (r) =>
        r.started_at ? new Date(r.started_at).toLocaleString("ru-RU") : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        onCreate={openCreate}
        createLabel={t("new_btn")}
      />

      {!loading && rows.length === 0 ? (
        <p className="text-sm text-ink-400 dark:text-ink-500 text-center py-10">{t("empty")}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          onEdit={(r) => router.push(`/warehouse/revision/${r.id}`)}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={t("new_btn")}>
        <div className="space-y-3">
          <Field label={t("warehouse_label")} required>
            <select
              className={input}
              value={whId}
              onChange={(e) => setWhId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">{t("select_warehouse")}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("notes_label")}>
            <input
              className={input}
              placeholder={t("notes_placeholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          <div className="flex items-start gap-3 rounded-md border border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-900/40 p-3">
            <input
              type="checkbox"
              id="blind_count_chk"
              checked={blindCount}
              onChange={(e) => setBlindCount(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="blind_count_chk" className="cursor-pointer">
              <div className="text-sm font-medium text-ink-900 dark:text-ink-100">
                {t("blind_count")}
              </div>
              <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                {t("blind_count_hint")}
              </div>
            </label>
          </div>

          <Field label={t("product_search")}>
            <div className="relative">
              <input
                className={input}
                placeholder={t("product_search")}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              {productOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-md shadow-lg max-h-48 overflow-auto">
                  {productOptions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addItem(p)}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-800"
                    >
                      {p.name}{" "}
                      {p.sku && <span className="text-ink-400">({p.sku})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {items.length > 0 && (
            <div className="border rounded-md max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 dark:bg-ink-900/40">
                  <tr>
                    <th className="px-3 py-2 text-left">{t("col_product")}</th>
                    <th className="px-3 py-2 text-right w-32">{t("col_actual")}</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.product_id} className="border-t">
                      <td className="px-3 py-2">{it.product_name}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.001"
                          value={it.actual_qty}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...next[idx], actual_qty: e.target.value };
                            setItems(next);
                          }}
                          className="w-24 border border-ink-200 dark:border-ink-700 rounded px-2 py-1 text-right text-sm bg-white dark:bg-ink-950"
                        />
                      </td>
                      <td className="text-center">
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={Trash2}
                          onClick={() => setItems(items.filter((_, i) => i !== idx))}
                          className="text-danger-500 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/15"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("action_cancel")}
            </Button>
            <Button type="button" variant="primary" disabled={saving} loading={saving} onClick={create}>
              {t("new_btn")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
