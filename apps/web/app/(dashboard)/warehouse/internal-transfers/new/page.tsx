"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProductPicker, PickerItem } from "@/components/warehouse/product-picker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

type Warehouse = { id: number; name: string };

type LineItem = {
  product_id: string;
  product_name: string;
  qty: string;
  unit_name: string;
  on_hand: string;
  on_hand_loading: boolean;
};

export default function NewTransferPage() {
  const t = useTranslations("warehouse.transfers");
  const router = useRouter();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [fromWh, setFromWh] = useState<number | "">("");
  const [toWh, setToWh] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmWhChange, setConfirmWhChange] = useState(false);
  const [pendingFromWh, setPendingFromWh] = useState<number | "">("");

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
        qty: "1",
        unit_name: item.unitName,
        on_hand: String(item.onHand),
        on_hand_loading: false,
      },
    ]);
  }

  function handleFromWhChange(val: string) {
    const id = val ? Number(val) : "";
    if (id !== fromWh && items.length > 0) {
      setPendingFromWh(id);
      setConfirmWhChange(true);
      return;
    }
    setFromWh(id);
  }

  function applyWhChange() {
    setFromWh(pendingFromWh);
    setItems([]);
    setConfirmWhChange(false);
  }

  function updateQty(idx: number, val: string) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, qty: val } : it)));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function hasQtyError(item: LineItem) {
    const qty = parseFloat(item.qty);
    const oh = parseFloat(item.on_hand);
    return isNaN(qty) || qty <= 0 || (!isNaN(oh) && qty > oh);
  }

  const hasAnyError = items.some(hasQtyError);

  async function handleSave() {
    if (!fromWh || !toWh) {
      toast.error(t("validation_warehouses"));
      return;
    }
    if (fromWh === toWh) {
      toast.error(t("validation_same_wh"));
      return;
    }
    if (items.length === 0) {
      toast.error(t("validation_items"));
      return;
    }
    if (hasAnyError) {
      toast.error(t("validation_qty"));
      return;
    }

    setSaving(true);
    try {
      const res = await api.post<{ id: string; doc_number: string }>(
        "/warehouse/transfers",
        {
          from_warehouse: fromWh,
          to_warehouse: toWh,
          notes: notes || null,
          items: items.map((it) => ({
            product_id: it.product_id,
            qty: it.qty,
            unit_id: null,
          })),
        }
      );
      toast.success(t("created_ok"));
      router.push(`/warehouse/internal-transfers/${res.data.id}`);
    } catch (e) {
      toast.error(getErrorMessage(e, t("error_load")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => router.back()} />
        <PageHeader title={t("create_title")} />
      </div>

      <Card padding="lg" className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("from_wh_label")} required>
            <select
              className={input}
              value={fromWh}
              onChange={(e) => handleFromWhChange(e.target.value)}
            >
              <option value="">{t("select_wh")}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("to_wh_label")} required>
            <select
              className={input}
              value={toWh}
              onChange={(e) => setToWh(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">{t("select_wh")}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t("notes_label")}>
          <input
            className={input}
            placeholder={t("notes_placeholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </Card>

      {items.length > 0 && (
        <Card padding="lg" className="space-y-4">
          <h2 className="text-[14px] font-semibold text-ink-900 dark:text-ink-100">
            {t("selected_items_title")}
          </h2>

          <div className="overflow-x-auto rounded-md border border-ink-200 dark:border-ink-800">
            <table className="w-full text-[13px]">
              <thead className="bg-ink-50 dark:bg-ink-900/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400">
                    {t("col_product")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400 w-28">
                    {t("col_on_hand")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400 w-32">
                    {t("col_qty")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400 w-24">
                    {t("col_unit")}
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200/60 dark:divide-ink-800/60">
                {items.map((it, idx) => {
                  const qtyErr = hasQtyError(it);
                  const onHandNum = parseFloat(it.on_hand);
                  return (
                    <tr
                      key={it.product_id}
                      className={qtyErr ? "bg-danger-50 dark:bg-danger-500/10" : ""}
                    >
                      <td className="px-3 py-2 text-ink-900 dark:text-ink-100">
                        {it.product_name}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={onHandNum > 0 ? "success" : "danger"}>
                          {onHandNum.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={it.qty}
                          onChange={(e) => updateQty(idx, e.target.value)}
                          className={`w-24 border rounded px-2 py-1 text-right text-[13px] focus:outline-none transition-colors ${
                            qtyErr
                              ? "border-danger-400 bg-danger-50 dark:bg-danger-500/15 focus:border-danger-500"
                              : "border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-950 focus:border-brand-500"
                          }`}
                        />
                        {qtyErr && parseFloat(it.qty) > parseFloat(it.on_hand) && (
                          <p className="text-[11px] text-danger-600 dark:text-danger-500 mt-0.5">
                            {t("qty_exceeds")}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-ink-500 dark:text-ink-400">
                        {it.unit_name || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="xs"
                          icon={Trash2}
                          onClick={() => removeItem(idx)}
                          className="text-danger-500 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/15"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card padding="lg" className="space-y-4">
        <h2 className="text-[14px] font-semibold text-ink-900 dark:text-ink-100">
          {t("items_title")}
        </h2>

        {!fromWh ? (
          <p className="text-[13px] text-ink-400 dark:text-ink-500 py-4 text-center">
            {t("select_src_wh_hint")}
          </p>
        ) : (
          <ProductPicker
            warehouseId={fromWh as number}
            selectedIds={items.map((i) => i.product_id)}
            onAdd={handleAdd}
          />
        )}
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>
          {t("cancel_btn")}
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving || hasAnyError}
          loading={saving}
        >
          {t("save_btn")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmWhChange}
        onClose={() => setConfirmWhChange(false)}
        onConfirm={applyWhChange}
        title={t("change_wh_title")}
        message={t("change_wh_msg")}
        confirmLabel={t("confirm_label")}
        cancelLabel={t("cancel_label")}
        variant="warning"
      />
    </div>
  );
}
