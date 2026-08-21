"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

export default function PersonSetBalancePage() {
  const t = useTranslations("ui");
  const [form, setForm] = useState({
    subject_id: "",
    plan_amount: "0",
    fact_amount: "0",
    notes: "",
  });

  async function save() {
    if (!form.subject_id) {
      toast.error(t("ui__введите_id_физлица_a3cf51c4"));
      return;
    }
    try {
      await api.post("/finance/entity-set-balance", {
        subject_type: "person",
        subject_id: form.subject_id,
        plan_amount: Number(form.plan_amount) || 0,
        fact_amount: Number(form.fact_amount) || 0,
        notes: form.notes,
      });
      toast.success(t("ui__баланс_установлен_835f27a5"));
      setForm({ subject_id: "", plan_amount: "0", fact_amount: "0", notes: "" });
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__установить_физлицо_6e2c858a")}
        description={t("ui__коррекция_баланса_произвольног_a5e5ee30")}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-6 max-w-2xl">
        <div className="space-y-4">
          <Field label={t("ui__id_физлица_uuid_7fe7cc44")} required>
            <input
              className={input}
              value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
              placeholder={t("ui__например_b3f7d8e2_a8270628")}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("ui__план_ee229f3b")}>
              <input
                type="number"
                step="0.01"
                className={input}
                value={form.plan_amount}
                onChange={(e) => setForm({ ...form, plan_amount: e.target.value })}
              />
            </Field>
            <Field label={t("ui__факт_0a982a27")}>
              <input
                type="number"
                step="0.01"
                className={input}
                value={form.fact_amount}
                onChange={(e) => setForm({ ...form, fact_amount: e.target.value })}
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
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={save}
              className="px-5 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700"
            >
              {t("ui__сохранить_74ea58b6")}
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
        Для проверки балансов физлиц используйте раздел{" "}
        <a
          href="/finance/person-balance"
          className="text-brand-600 dark:text-brand-400 hover:underline"
        >
          /finance/person-balance
        </a>
        . ID можно взять из справочника{" "}
        <a
          href="/reference/natural-person"
          className="text-brand-600 dark:text-brand-400 hover:underline"
        >
          /reference/natural-person
        </a>
        .
      </p>
    </div>
  );
}
