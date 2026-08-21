"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Cashbox = { id: number; name: string; balance: string; currency_id: number };
type Currency = { id: number; code: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function CashboxSetBalancePage() {
  const t = useTranslations("ui");
  const [boxes, setBoxes] = useState<Cashbox[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [selected, setSelected] = useState<Cashbox | null>(null);
  const [open, setOpen] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [reason, setReason] = useState("");

  async function load() {
    const { data } = await api.get<Cashbox[]>("/finance/cashboxes");
    setBoxes(data);
  }
  useEffect(() => {
    api.get<Currency[]>("/reference/currencies").then((r) => setCurrencies(r.data)).catch(() => {});
    load();
  }, []);

  const curCode = (id: number) => currencies.find((c) => c.id === id)?.code || "";

  async function save() {
    if (!selected) return;
    const v = Number(newBalance);
    if (Number.isNaN(v)) { toast.error(t("ui__введите_число_653f5fe4")); return; }
    try {
      const { data } = await api.post("/finance/cashbox-set-balance",
        { cashbox_id: selected.id, new_balance: v, reason });
      toast.success(`Balans o'zgardi: ${fmt(data.old_balance)} → ${fmt(data.new_balance)}`);
      setOpen(false); setReason(""); load();
    } catch (e) { toast.error(getErrorMessage(e, "Xato")); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__установить_кассы_a310b047")} description={t("ui__прямая_коррекция_баланса_кассы_4cc9999e")} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {boxes.map((b) => (
          <button
            key={b.id}
            onClick={() => {
              setSelected(b);
              setNewBalance(String(b.balance));
              setOpen(true);
            }}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5 hover:border-brand-400 dark:hover:border-brand-500 hover:shadow text-left transition"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">
              {curCode(b.currency_id)}
            </div>
            <div className="font-semibold text-lg mt-1 text-slate-900 dark:text-slate-100">
              {b.name}
            </div>
            <div
              className={`text-3xl font-bold mt-2 font-mono ${
                Number(b.balance) < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-700 dark:text-green-400"
              }`}
            >
              {fmt(b.balance)}
            </div>
            <div className="text-xs text-brand-600 dark:text-brand-400 mt-3">
              {t("ui__нажмите_для_коррекции_23c69376")}
            </div>
          </button>
        ))}
        {boxes.length === 0 && <div className="text-slate-400 col-span-3 text-center py-10">{t("ui__касс_нет_0681b6ff")}</div>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)}
        title={selected ? `Balansni o'rnatish — ${selected.name}` : ""}>
        <div className="space-y-3">
          <Field label={t("ui__текущий_баланс_ec5dc477")}>
            <input className={`${input} bg-slate-50 dark:bg-slate-900/40`} value={fmt(selected?.balance)} readOnly />
          </Field>
          <Field label={t("ui__новый_баланс_3eb5499e")} required>
            <input type="number" step="0.01" className={input}
              value={newBalance} onChange={(e) => setNewBalance(e.target.value)} />
          </Field>
          <Field label={t("ui__причина_d88300c7")}>
            <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-slate-50 dark:bg-slate-900/40">{t("ui__отмена_987b33c6")}</button>
            <button onClick={save} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__установить_7fe136f1")}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
