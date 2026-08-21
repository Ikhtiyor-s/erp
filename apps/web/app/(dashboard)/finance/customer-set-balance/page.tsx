"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Customer = { id: string; name: string; phone?: string };
type Balance = { id: string; name: string; balance: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function CustomerSetBalancePage() {
  const t = useTranslations("ui");
  const [list, setList] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [bal, setBal] = useState<Balance | null>(null);
  const [open, setOpen] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [notes, setNotes] = useState("");

  async function loadList() {
    const url = q ? `/customer/customers?q=${encodeURIComponent(q)}` : "/customer/customers?limit=50";
    setList((await api.get<Customer[]>(url)).data);
  }
  useEffect(() => { loadList(); }, []);

  async function pick(c: Customer) {
    setSelected(c);
    const { data } = await api.get<Balance>(`/customer/customers/${c.id}/balance`);
    setBal(data);
    setNewBalance(String(data.balance));
  }

  async function save() {
    if (!selected) return;
    const v = Number(newBalance);
    if (Number.isNaN(v)) { toast.error(t("ui__введите_число_653f5fe4")); return; }
    try {
      const { data } = await api.post(`/customer/customers/${selected.id}/set-balance`,
        { new_balance: v, notes });
      toast.success(`Balans o'zgardi: ${fmt(data.old_balance)} → ${fmt(data.new_balance)}`);
      setOpen(false); setNotes("");
      const r = await api.get<Balance>(`/customer/customers/${selected.id}/balance`);
      setBal(r.data);
    } catch (e) { toast.error(getErrorMessage(e, "Xato")); }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__установить_клиенты_346190ea")} description={t("ui__коррекция_баланса_клиента_созд_435e399a")} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4 h-fit">
          <div className="relative mb-3">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className={`${input} pl-9`}
              placeholder={t("ui__поиск_клиента_f87a1f93")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadList()}
            />
          </div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-700 max-h-[60vh] overflow-auto -mx-2">
            {list.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => pick(c)}
                  className={`w-full text-left px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                    selected?.id === c.id
                      ? "bg-brand-50 dark:bg-brand-900/30"
                      : ""
                  }`}
                >
                  <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                    {c.name}
                  </div>
                  {c.phone && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {c.phone}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          {!selected ? (
            <div className="text-center text-slate-400 dark:text-slate-500 py-20">
              {t("ui__выберите_клиента_слева_619d1c21")}
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {selected.name}
              </h2>
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {t("ui__текущий_баланс_ec5dc477")}
                </div>
                <div
                  className={`text-4xl font-bold font-mono ${
                    Number(bal?.balance) < 0
                      ? "text-red-600 dark:text-red-400"
                      : Number(bal?.balance) > 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {fmt(bal?.balance)}
                </div>
              </div>
              <button
                onClick={() => setOpen(true)}
                className="px-5 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700"
              >
                {t("ui__установить_новый_баланс_0588faeb")}
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t("ui__установить_баланс_42e35982")}>
        <div className="space-y-3">
          <Field label={t("ui__текущий_баланс_ec5dc477")}>
            <input className={`${input} bg-slate-50 dark:bg-slate-900/40`} value={fmt(bal?.balance)} readOnly />
          </Field>
          <Field label={t("ui__новый_баланс_3eb5499e")} required>
            <input type="number" step="0.01" className={input}
              value={newBalance} onChange={(e) => setNewBalance(e.target.value)} />
          </Field>
          <Field label={t("ui__примечание_686eb72b")}>
            <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-slate-50 dark:bg-slate-900/40">{t("ui__отмена_987b33c6")}</button>
            <button onClick={save} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__сохранить_74ea58b6")}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
