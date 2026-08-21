"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Download } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Currency = {
  id: number; code: string; name: string; symbol?: string;
  is_base: boolean; decimals: number; is_active: boolean;
};
type Rate = { id: number; rate: string; rate_date: string };

const empty = { code: "", name: "", symbol: "", is_base: false, decimals: 2 };
const today = () => new Date().toISOString().slice(0, 10);

export default function CurrencyPage() {
  const t = useTranslations("ui");
  const [rows, setRows] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<number | null>(null);

  // Rates modal
  const [ratesFor, setRatesFor] = useState<Currency | null>(null);
  const [rates, setRates] = useState<Rate[]>([]);
  const [rateForm, setRateForm] = useState({ rate: "", rate_date: today() });

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<Currency[]>("/reference/currencies");
      setRows(data);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setForm(empty); setEditId(null); setOpen(true); }
  function openEdit(row: Currency) {
    setForm({ code: row.code, name: row.name, symbol: row.symbol || "", is_base: row.is_base, decimals: row.decimals });
    setEditId(row.id); setOpen(true);
  }

  async function save() {
    try {
      if (editId) await api.put(`/reference/currencies/${editId}`, form);
      else await api.post("/reference/currencies", form);
      toast.success(editId ? "Saqlandi" : "Yaratildi");
      setOpen(false); load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  async function del(row: Currency) {
    if (!confirm(`«${row.name}» o'chirilsinmi?`)) return;
    await api.delete(`/reference/currencies/${row.id}`);
    toast.success(t("ui__удалено_0c450c40")); load();
  }

  async function openRates(row: Currency) {
    setRatesFor(row);
    setRateForm({ rate: "", rate_date: today() });
    const { data } = await api.get<Rate[]>(`/reference/currencies/${row.id}/rates`);
    setRates(data);
  }

  async function saveRate() {
    if (!ratesFor) return;
    const rate = Number(rateForm.rate);
    if (!rate || rate <= 0) { toast.error(t("ui__введите_корректный_курс_4471b170")); return; }
    try {
      await api.post(`/reference/currencies/${ratesFor.id}/rates`, {
        rate, rate_date: rateForm.rate_date,
      });
      toast.success(t("ui__курс_сохранён_610e01b0"));
      setRateForm({ rate: "", rate_date: today() });
      const { data } = await api.get<Rate[]>(`/reference/currencies/${ratesFor.id}/rates`);
      setRates(data);
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
  }

  async function importCbu() {
    if (!confirm("cbu.uz dan bugungi kurslarni yuklab olishni xohlaysizmi?")) return;
    try {
      const { data } = await api.post<{ imported: number; date: string }>(
        "/reference/currencies/rates/import-cbu",
      );
      toast.success(`${data.date} sanasiga ${data.imported} kurs import qilindi`);
      if (ratesFor) {
        const { data: r } = await api.get<Rate[]>(`/reference/currencies/${ratesFor.id}/rates`);
        setRates(r);
      }
    } catch (e) {
      toast.error(getErrorMessage(e, "Yuklab bo'lmadi"));
    }
  }

  async function delRate(r: Rate) {
    if (!ratesFor) return;
    if (!confirm(`${r.rate_date} kursi o'chirilsinmi?`)) return;
    await api.delete(`/reference/currencies/${ratesFor.id}/rates/${r.id}`);
    const { data } = await api.get<Rate[]>(`/reference/currencies/${ratesFor.id}/rates`);
    setRates(data);
  }

  const columns: Column<Currency>[] = [
    { key: "code", header: t("ui__код_3f34a617"), width: "100px" },
    { key: "name", header: t("ui__название_602680ed") },
    { key: "symbol", header: t("ui__символ_de3a206f"), width: "100px" },
    { key: "decimals", header: t("ui__знаков_ec6d2974"), align: "right", width: "100px" },
    {
      key: "is_base", header: t("ui__базовая_09825af7"), align: "center", width: "100px",
      render: (r) => (r.is_base ? <span className="text-green-600">●</span> : <span className="text-slate-300">○</span>),
    },
    {
      key: "actions" as any, header: t("ui__курсы_b91cb712"), align: "center", width: "100px",
      render: (r) => (
        <button onClick={() => openRates(r)} className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 text-xs">
          <TrendingUp size={14} /> {t("ui__курсы_b91cb712")}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title={t("ui__валюты_8febaf3d")} description={t("ui__справочник_валют_и_курсы_131b5469")} onCreate={openCreate} />
      </div>
      <div className="-mt-3">
        <button onClick={importCbu}
          className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-brand-200 text-brand-700 hover:bg-brand-50">
          <Download size={14} /> {t("ui__загрузить_курсы_с_cbu_uz_a2eee229")}
        </button>
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} onEdit={openEdit} onDelete={del} />

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Valyutani tahrirlash" : "Yangi valyuta"}>
        <div className="space-y-3">
          <Field label={t("ui__код_3_буквы_9d8d6458")} required>
            <input className={input} maxLength={3} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </Field>
          <Field label={t("ui__название_602680ed")} required>
            <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label={t("ui__символ_de3a206f")}>
            <input className={input} value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
          </Field>
          <Field label={t("ui__знаков_после_запятой_f2b615df")}>
            <input type="number" className={input} value={form.decimals} onChange={(e) => setForm({ ...form, decimals: Number(e.target.value) })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_base} onChange={(e) => setForm({ ...form, is_base: e.target.checked })} />
            {t("ui__базовая_валюта_293eb9b7")}
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-slate-50 dark:bg-slate-900/40">{t("ui__отмена_987b33c6")}</button>
            <button onClick={save} className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("ui__сохранить_74ea58b6")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!ratesFor} onClose={() => setRatesFor(null)} size="lg"
        title={ratesFor ? `${ratesFor.code} valyuta kurslari` : ""}>
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <Field label={t("ui__дата_8cdd8bb7")}>
              <input type="date" className={input} value={rateForm.rate_date}
                onChange={(e) => setRateForm({ ...rateForm, rate_date: e.target.value })} />
            </Field>
            <Field label={`Asosiy valyutaga kurs (1 ${ratesFor?.code ?? ""} = ? asosiy)`}>
              <input type="number" step="0.0001" className={input} value={rateForm.rate}
                onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })} />
            </Field>
            <button onClick={saveRate}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700 whitespace-nowrap">
              {t("ui__добавить_5eba283b")}
            </button>
          </div>

          <div className="border rounded-md max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">{t("ui__дата_8cdd8bb7")}</th>
                  <th className="px-3 py-2 text-right">{t("ui__курс_d2b74163")}</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {rates.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-6 text-slate-400">{t("ui__нет_данных_dee9a2d8")}</td></tr>
                ) : rates.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.rate_date}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(r.rate).toLocaleString("ru-RU", { maximumFractionDigits: 4 })}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => delRate(r)} className="text-red-600 hover:text-red-700 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}
