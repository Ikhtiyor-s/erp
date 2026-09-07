"use client";

import { useState } from "react";
import { toast } from "sonner";
import { TrendingUp, TrendingDown } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

export default function BulkPricePage() {
  const t = useTranslations("ui");
  const [field, setField] = useState<"sale_price" | "purchase_price">(
    "sale_price"
  );
  const [markup, setMarkup] = useState("10");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function apply() {
    const m = Number(markup);
    if (!m) {
      toast.error(t("ui__введите_процент_29aa3157"));
      return;
    }
    setConfirmOpen(true);
  }

  async function doApply() {
    const m = Number(markup);
    setBusy(true);
    try {
      const { data } = await api.post<{ updated: number }>(
        "/tools/price/markup",
        {
          markup_pct: m,
          field,
          category_id: categoryId ? Number(categoryId) : null,
        }
      );
      toast.success(`Yangilangan mahsulotlar: ${data.updated}`);
      setConfirmOpen(false);
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setBusy(false);
    }
  }

  const m = Number(markup);
  const confirmMessage = `${m > 0 ? "+" : ""}${m}% qo'llansinmi: ${
    field === "sale_price" ? "sotuv narxiga" : "kelish narxiga"
  }${categoryId ? ` (kategoriya ${categoryId})` : " barcha mahsulotlarga"}?`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__установить_цену_45d073be")}
        description={t("ui__массовая_смена_цен_товаров_нац_3e840767")}
      />

      <Card padding="lg" className="max-w-2xl">
        <div className="space-y-4">
          <Field label={t("ui__какое_поле_менять_66af109c")}>
            <select
              className={input}
              value={field}
              onChange={(e) => setField(e.target.value as any)}
            >
              <option value="sale_price">{t("ui__цена_продажи_b379afd3")}</option>
              <option value="purchase_price">{t("ui__цена_закупа_9ae1384c")}</option>
            </select>
          </Field>

          <Field label={t("ui__процент_изменения_10_повышение_778fed41")}>
            <input
              type="number"
              step="0.01"
              className={input}
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
            />
          </Field>

          <Field label={t("ui__id_категории_опционально_иначе_5973eef0")}>
            <input
              type="number"
              className={input}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            />
          </Field>

          <div className="pt-4 border-t border-ink-200 dark:border-ink-700 flex gap-3">
            <Button
              variant="primary"
              size="lg"
              icon={Number(markup) >= 0 ? TrendingUp : TrendingDown}
              loading={busy}
              onClick={apply}
            >
              {busy ? "Qayta ishlanmoqda..." : "Qo'llash"}
            </Button>
          </div>
        </div>
      </Card>

      <div className="text-xs text-ink-500 dark:text-ink-400 max-w-2xl">
        <p>{t("ui__операция_необратима_рекомендуе_f5927bfc")}</p>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doApply}
        title="Narxlarni yangilashni tasdiqlang"
        message={confirmMessage}
        confirmLabel="Qo'llash"
        cancelLabel="Bekor"
        variant="warning"
        loading={busy}
      />
    </div>
  );
}
