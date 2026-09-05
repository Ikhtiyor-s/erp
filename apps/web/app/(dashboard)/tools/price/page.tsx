"use client";

import { useState } from "react";
import { toast } from "sonner";
import { TrendingUp, TrendingDown } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

export default function BulkPricePage() {
  const t = useTranslations("ui");
  const [field, setField] = useState<"sale_price" | "purchase_price">(
    "sale_price"
  );
  const [markup, setMarkup] = useState("10");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply() {
    const m = Number(markup);
    if (!m) {
      toast.error(t("ui__введите_процент_29aa3157"));
      return;
    }
    if (
      !confirm(
        `${m > 0 ? "+" : ""}${m}% qo'llansinmi: ${
          field === "sale_price" ? "sotuv narxiga" : "kelish narxiga"
        }${categoryId ? ` (kategoriya ${categoryId})` : " barcha mahsulotlarga"}?`
      )
    )
      return;
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
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__установить_цену_45d073be")}
        description={t("ui__массовая_смена_цен_товаров_нац_3e840767")}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-6 max-w-2xl">
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

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
            <button
              onClick={apply}
              disabled={busy}
              className="px-5 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {Number(markup) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {busy ? "Qayta ishlanmoqda..." : "Qo'llash"}
            </button>
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
        <p>{t("ui__операция_необратима_рекомендуе_f5927bfc")}</p>
      </div>
    </div>
  );
}
