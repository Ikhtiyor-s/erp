"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Download } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  const [delTarget, setDelTarget] = useState<Currency | null>(null);

  // Rates modal
  const [ratesFor, setRatesFor] = useState<Currency | null>(null);
  const [rates, setRates] = useState<Rate[]>([]);
  const [rateForm, setRateForm] = useState({ rate: "", rate_date: today() });
  const [delRateTarget, setDelRateTarget] = useState<Rate | null>(null);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);

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

  async function del() {
    if (!delTarget) return;
    await api.delete(`/reference/currencies/${delTarget.id}`);
    toast.success(t("ui__удалено_0c450c40"));
    setDelTarget(null);
    load();
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
    try {
      const { data } = await api.post<{ imported: number; date: string }>(
        "/reference/currencies/rates/import-cbu",
      );
      toast.success(`${data.date} sanasiga ${data.imported} kurs import qilindi`);
      setImportConfirmOpen(false);
      if (ratesFor) {
        const { data: r } = await api.get<Rate[]>(`/reference/currencies/${ratesFor.id}/rates`);
        setRates(r);
      }
    } catch (e) {
      toast.error(getErrorMessage(e, "Yuklab bo'lmadi"));
    }
  }

  async function delRate() {
    if (!ratesFor || !delRateTarget) return;
    await api.delete(`/reference/currencies/${ratesFor.id}/rates/${delRateTarget.id}`);
    setDelRateTarget(null);
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
      render: (r) => (r.is_base ? <span className="text-success-500">●</span> : <span className="text-ink-300">○</span>),
    },
    {
      key: "actions" as any, header: t("ui__курсы_b91cb712"), align: "center", width: "100px",
      render: (r) => (
        <Button variant="ghost" size="xs" icon={TrendingUp} onClick={() => openRates(r)}>
          {t("ui__курсы_b91cb712")}
        </Button>
      ),
    },
  ];

  const rateColumns: Column<Rate>[] = [
    { key: "rate_date", header: t("ui__дата_8cdd8bb7") },
    {
      key: "rate", header: t("ui__курс_d2b74163"), align: "right",
      render: (r) => <span className="font-mono">{Number(r.rate).toLocaleString("ru-RU", { maximumFractionDigits: 4 })}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title={t("ui__валюты_8febaf3d")} description={t("ui__справочник_валют_и_курсы_131b5469")} onCreate={openCreate} />
      </div>
      <div className="-mt-3">
        <Button variant="outline" size="sm" icon={Download} onClick={() => setImportConfirmOpen(true)}>
          {t("ui__загрузить_курсы_с_cbu_uz_a2eee229")}
        </Button>
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} onEdit={openEdit} onDelete={(r) => setDelTarget(r)} />

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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("ui__отмена_987b33c6")}</Button>
            <Button type="button" onClick={save}>{t("ui__сохранить_74ea58b6")}</Button>
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
            <Button onClick={saveRate} className="whitespace-nowrap">
              {t("ui__добавить_5eba283b")}
            </Button>
          </div>

          <div className="max-h-72 overflow-auto">
            <DataTable
              columns={rateColumns}
              rows={rates}
              rowKey={(r) => r.id}
              emptyText={t("ui__нет_данных_dee9a2d8")}
              onDelete={(r) => setDelRateTarget(r)}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={del}
        title="Valyutani o'chirish"
        message={delTarget ? `«${delTarget.name}» o'chirilsinmi?` : ""}
        confirmLabel={t("ui__удалено_0c450c40")}
        variant="danger"
      />

      <ConfirmDialog
        open={!!delRateTarget}
        onClose={() => setDelRateTarget(null)}
        onConfirm={delRate}
        title="Kursni o'chirish"
        message={delRateTarget ? `${delRateTarget.rate_date} kursi o'chirilsinmi?` : ""}
        confirmLabel={t("ui__удалено_0c450c40")}
        variant="danger"
      />

      <ConfirmDialog
        open={importConfirmOpen}
        onClose={() => setImportConfirmOpen(false)}
        onConfirm={importCbu}
        title="Kurslarni yuklash"
        message="cbu.uz dan bugungi kurslarni yuklab olishni xohlaysizmi?"
        confirmLabel={t("ui__загрузить_курсы_с_cbu_uz_a2eee229")}
        variant="warning"
      />
    </div>
  );
}
