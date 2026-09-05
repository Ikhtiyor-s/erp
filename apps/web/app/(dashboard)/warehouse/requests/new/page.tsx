"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ProductPicker, PickerItem } from "@/components/warehouse/product-picker";

type Warehouse = { id: number; name: string };

type LineItem = {
  product_id: string;
  product_name: string;
  category_id: null;
  qty_requested: string;
  unit_name: string;
  on_hand: string;
};

export default function NewProductRequestPage() {
  const t = useTranslations("request");
  const tc = useTranslations("common");
  const router = useRouter();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [fromWarehouse, setFromWarehouse] = useState<number | "">("");
  const [toWarehouse, setToWarehouse] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<Warehouse[]>("/warehouse/warehouses")
      .then((r) => setWarehouses(r.data))
      .catch(() => {});
  }, []);

  function handleAdd(item: PickerItem) {
    if (items.some((i) => i.product_id === item.productId)) return;
    setItems((prev) => [
      ...prev,
      {
        product_id: item.productId,
        product_name: item.productName,
        category_id: null,
        qty_requested: "1",
        unit_name: item.unitName,
        on_hand: String(item.onHand),
      },
    ]);
  }

  function updateQty(productId: string, value: string) {
    setItems((prev) =>
      prev.map((l) => (l.product_id === productId ? { ...l, qty_requested: value } : l))
    );
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((l) => l.product_id !== productId));
  }

  function lineHasError(l: LineItem): boolean {
    if (!l.qty_requested) return false;
    const requested = parseFloat(l.qty_requested);
    const available = parseFloat(l.on_hand);
    return requested > available;
  }

  const hasAnyError = items.some(lineHasError);

  const canSubmit =
    !hasAnyError &&
    !submitting &&
    fromWarehouse !== "" &&
    items.length > 0 &&
    items.every((l) => l.qty_requested && parseFloat(l.qty_requested) > 0);

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data } = await api.post<{ id: string; doc_number: string }>(
        "/warehouse/requests",
        {
          from_warehouse: Number(fromWarehouse),
          to_warehouse: toWarehouse !== "" ? Number(toWarehouse) : null,
          notes: notes || null,
          items: items.map((l) => ({
            product_id: l.product_id,
            category_id: l.category_id,
            qty_requested: l.qty_requested,
          })),
        }
      );
      toast.success(`${t("created")} ${data.doc_number}`);
      router.push("/warehouse/requests");
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader title={t("new_title")} description={t("new_description")} />

      <div className="bg-white dark:bg-ink-950 rounded-md border border-ink-200/60 dark:border-ink-800/60 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t("from_warehouse")} required>
            <select
              className={input}
              value={fromWarehouse}
              onChange={(e) => {
                setFromWarehouse(e.target.value ? Number(e.target.value) : "");
                setItems([]);
              }}
            >
              <option value="">{tc("select")}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("to_warehouse")}>
            <select
              className={input}
              value={toWarehouse}
              onChange={(e) => setToWarehouse(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">{tc("none")}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={tc("notes")}>
          <textarea
            className={`${input} resize-none`}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("notes_placeholder")}
          />
        </Field>
      </div>

      {fromWarehouse !== "" ? (
        <div className="bg-white dark:bg-ink-950 rounded-md border border-ink-200/60 dark:border-ink-800/60 p-4 space-y-3">
          <p className="text-[13px] font-medium text-ink-700 dark:text-ink-300">
            {t("items")}
          </p>
          <ProductPicker
            warehouseId={fromWarehouse as number}
            selectedIds={items.map((i) => i.product_id)}
            onAdd={handleAdd}
          />
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-ink-200 dark:border-ink-800 px-4 py-8 text-center text-[13px] text-ink-400 dark:text-ink-500">
          {t("select_warehouse_first")}
        </div>
      )}

      {items.length > 0 && (
        <div className="bg-white dark:bg-ink-950 rounded-md border border-ink-200/60 dark:border-ink-800/60 p-4 space-y-3">
          <p className="text-[13px] font-medium text-ink-700 dark:text-ink-300">
            {t("selected_title")}
          </p>

          <div className="hidden md:block overflow-x-auto rounded-md border border-ink-200 dark:border-ink-800">
            <table className="w-full text-[13px]">
              <thead className="bg-ink-50 dark:bg-ink-900/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400">
                    {t("product")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400 w-28">
                    {t("qty_on_hand")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400 w-32">
                    {t("qty_requested")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400 w-20">
                    {t("unit")}
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200/60 dark:divide-ink-800/60">
                {items.map((l) => {
                  const hasError = lineHasError(l);
                  return (
                    <tr
                      key={l.product_id}
                      className={hasError ? "bg-rose-50 dark:bg-rose-900/10" : ""}
                    >
                      <td className="px-3 py-2 text-ink-900 dark:text-ink-100 font-medium">
                        {l.product_name}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                            parseFloat(l.on_hand) > 0
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                          }`}
                        >
                          {parseFloat(l.on_hand).toLocaleString("ru-RU", {
                            maximumFractionDigits: 3,
                          })}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={l.qty_requested}
                          onChange={(e) => updateQty(l.product_id, e.target.value)}
                          className={`w-24 border rounded px-2 py-1 text-right text-[13px] focus:outline-none transition-colors ${
                            hasError
                              ? "border-rose-400 bg-rose-50 dark:bg-rose-900/20 focus:border-rose-500"
                              : "border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 focus:border-brand-500"
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2 text-ink-500 dark:text-ink-400">
                        {l.unit_name || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(l.product_id)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                          aria-label={tc("delete")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-2">
            {items.map((l) => {
              const hasError = lineHasError(l);
              return (
                <li
                  key={l.product_id}
                  className={`p-3 rounded-lg border bg-white dark:bg-ink-900 space-y-2 ${
                    hasError
                      ? "border-rose-400 dark:border-rose-700"
                      : "border-ink-200 dark:border-ink-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-ink-900 dark:text-ink-100">
                      {l.product_name}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItem(l.product_id)}
                      className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                      aria-label={tc("delete")}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                        parseFloat(l.on_hand) > 0
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                      }`}
                    >
                      {t("available")}{" "}
                      {parseFloat(l.on_hand).toLocaleString("ru-RU", {
                        maximumFractionDigits: 3,
                      })}{" "}
                      {l.unit_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[12px] text-ink-500 dark:text-ink-400">
                      {t("qty_requested")}:
                    </label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={l.qty_requested}
                      onChange={(e) => updateQty(l.product_id, e.target.value)}
                      className={`w-28 border rounded px-2 py-1 text-right text-[13px] focus:outline-none transition-colors ${
                        hasError
                          ? "border-rose-400 bg-rose-50 dark:bg-rose-900/20 focus:border-rose-500"
                          : "border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 focus:border-brand-500"
                      }`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {items.length === 0 && fromWarehouse !== "" && (
        <div className="text-center py-4 text-[13px] text-ink-400 dark:text-ink-500">
          {t("no_lines")}
        </div>
      )}

      {hasAnyError && (
        <div className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-md px-3 py-2">
          <AlertTriangle size={14} />
          {t("qty_exceeds_error")}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={() => router.push("/warehouse/requests")}
          className="px-4 py-2 text-sm rounded-md border border-ink-200 dark:border-ink-800 hover:bg-ink-50 dark:hover:bg-ink-900/40 text-ink-700 dark:text-ink-300"
        >
          {tc("cancel")}
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit}
          title={hasAnyError ? t("qty_exceeds_error") : undefined}
          className="px-4 py-2 text-sm rounded-md bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "..." : tc("save")}
        </button>
      </div>
    </div>
  );
}
