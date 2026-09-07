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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

      <Card padding="md" className="space-y-4">
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
      </Card>

      {fromWarehouse !== "" ? (
        <Card padding="md" className="space-y-3">
          <p className="text-[13px] font-medium text-ink-700 dark:text-ink-300">
            {t("items")}
          </p>
          <ProductPicker
            warehouseId={fromWarehouse as number}
            selectedIds={items.map((i) => i.product_id)}
            onAdd={handleAdd}
          />
        </Card>
      ) : (
        <div className="rounded-md border border-dashed border-ink-200 dark:border-ink-800 px-4 py-8 text-center text-[13px] text-ink-400 dark:text-ink-500">
          {t("select_warehouse_first")}
        </div>
      )}

      {items.length > 0 && (
        <Card padding="md" className="space-y-3">
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
                      className={hasError ? "bg-danger-50 dark:bg-danger-500/10" : ""}
                    >
                      <td className="px-3 py-2 text-ink-900 dark:text-ink-100 font-medium">
                        {l.product_name}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={parseFloat(l.on_hand) > 0 ? "success" : "danger"}>
                          {parseFloat(l.on_hand).toLocaleString("ru-RU", {
                            maximumFractionDigits: 3,
                          })}
                        </Badge>
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
                              ? "border-danger-400 bg-danger-50 dark:bg-danger-500/15 focus:border-danger-500"
                              : "border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 focus:border-brand-500"
                          }`}
                        />
                      </td>
                      <td className="px-3 py-2 text-ink-500 dark:text-ink-400">
                        {l.unit_name || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={Trash2}
                          onClick={() => removeItem(l.product_id)}
                          aria-label={tc("delete")}
                          className="text-danger-500 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/15"
                        />
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
                      ? "border-danger-400 dark:border-danger-500/60"
                      : "border-ink-200 dark:border-ink-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-ink-900 dark:text-ink-100">
                      {l.product_name}
                    </p>
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={Trash2}
                      onClick={() => removeItem(l.product_id)}
                      aria-label={tc("delete")}
                      className="text-danger-500 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/15"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={parseFloat(l.on_hand) > 0 ? "success" : "danger"}>
                      {t("available")}{" "}
                      {parseFloat(l.on_hand).toLocaleString("ru-RU", {
                        maximumFractionDigits: 3,
                      })}{" "}
                      {l.unit_name}
                    </Badge>
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
                          ? "border-danger-400 bg-danger-50 dark:bg-danger-500/15 focus:border-danger-500"
                          : "border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 focus:border-brand-500"
                      }`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {items.length === 0 && fromWarehouse !== "" && (
        <div className="text-center py-4 text-[13px] text-ink-400 dark:text-ink-500">
          {t("no_lines")}
        </div>
      )}

      {hasAnyError && (
        <div className="flex items-center gap-2 text-sm text-danger-600 dark:text-danger-500 bg-danger-50 dark:bg-danger-500/15 border border-danger-500/30 rounded-md px-3 py-2">
          <AlertTriangle size={14} />
          {t("qty_exceeds_error")}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => router.push("/warehouse/requests")}>
          {tc("cancel")}
        </Button>
        <Button
          variant="primary"
          onClick={submit}
          disabled={!canSubmit}
          loading={submitting}
          title={hasAnyError ? t("qty_exceeds_error") : undefined}
        >
          {tc("save")}
        </Button>
      </div>
    </div>
  );
}
