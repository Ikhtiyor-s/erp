"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Printer, CreditCard, XCircle, ArrowLeft,
  Copy, FileDown, FileSpreadsheet, Send, Tag, DollarSign,
} from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { Modal, Field, input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";

type SaleDetail = {
  head: {
    id: string; doc_number?: string; sale_date: string;
    total_amount: string; paid_amount: string; status: string;
    customer_name?: string; customer_phone?: string; customer_address?: string; customer_tin?: string;
    warehouse_name?: string; currency_code?: string; notes?: string;
  };
  items: { product_id: string; product_name: string; quantity: string; price: string; discount: string; amount: string }[];
};
type Cashbox = { id: number; name: string };
type PaymentType = { id: number; name: string };

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const statusBadge = (s: string) => ({
  draft: "bg-slate-100 text-slate-700 dark:text-slate-200", confirmed: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700", partial: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
}[s] || "bg-slate-100 text-slate-700 dark:text-slate-200");

export default function SaleDetailPage() {
  const t = useTranslations("ui");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<SaleDetail | null>(null);
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);

  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [cashboxId, setCashboxId] = useState<number | "">("");
  const [paymentTypeId, setPaymentTypeId] = useState<number | "">("");

  async function load() {
    const { data } = await api.get<SaleDetail>(`/sale/sales/${id}`);
    setData(data);
  }

  useEffect(() => {
    Promise.all([
      api.get<Cashbox[]>("/finance/cashboxes").then((r) => setCashboxes(r.data)).catch(() => {}),
      api.get<PaymentType[]>("/reference/payment-types").then((r) => setPaymentTypes(r.data)).catch(() => {}),
    ]);
    load();
  }, [id]);

  async function pay() {
    const v = Number(amount);
    if (!v || v <= 0) { toast.error(t("ui__введите_сумму_0c2f22d8")); return; }
    try {
      const { data } = await api.post(`/sale/sales/${id}/pay`,
        { amount: v, cashbox_id: cashboxId || null, payment_type_id: paymentTypeId || null });
      toast.success(`${fmt(data.paid_amount)} to'landi (${data.status})`);
      setPayOpen(false); setAmount(""); load();
    } catch (e: any) { toast.error(getErrorMessage(e, "To'lovda xato")); }
  }

  async function cancel() {
    if (!confirm("Sotuvni bekor qilasizmi? Qoldiqlar omborga qaytadi.")) return;
    try {
      await api.post(`/sale/sales/${id}/cancel`);
      toast.success(t("ui__отменено_81a04dab")); load();
    } catch (e: any) { toast.error(getErrorMessage(e, "Bekor qilishda xato")); }
  }

  async function duplicate() {
    if (!data) return;
    try {
      const { data: result } = await api.post(`/sale/sales/${id}/duplicate`);
      toast.success("Nusxa yaratildi");
      router.push(`/sale/contract/${result.id}`);
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Nusxalash imkonsiz"));
    }
  }

  function exportCsv() {
    if (!data) return;
    const h = data.head;
    // CSV: semicolon delimiter + UTF-8 BOM + quoted values for Excel UZ/RU locale
    const SEP = ";";
    const q = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const row = (cells: any[]) => cells.map(q).join(SEP);
    const lines = [
      row(["#", "Tovar", "Miqdor", "Narx", "Chegirma", "Summa"]),
      ...data.items.map((it, i) =>
        row([i + 1, it.product_name, it.quantity, it.price, it.discount, it.amount])
      ),
      "",
      row(["Jami", "", "", "", "", h.total_amount]),
      row(["To'langan", "", "", "", "", h.paid_amount]),
      row(["Qarz", "", "", "", "", Number(h.total_amount) - Number(h.paid_amount)]),
    ].join("\r\n");
    const blob = new Blob(["﻿" + lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sotuv-${h.doc_number || h.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV yuklab olindi");
  }

  async function exportXlsx() {
    if (!data) return;
    try {
      const { data: blob } = await api.get(`/sale/sales/${id}/xlsx`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement("a");
      a.href = url;
      const docNo = data.head.doc_number || id;
      a.download = `sotuv-${docNo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel (3 sheet) yuklab olindi");
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Excel yaratishda xato"));
    }
  }

  async function downloadPdf(fmt: "a4" | "thermal_58" | "thermal_80") {
    try {
      const { data: blob } = await api.get(`/sale/sales/${id}/pdf?fmt=${fmt}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement("a");
      a.href = url;
      const docNo = data?.head.doc_number || id;
      a.download = `sotuv-${docNo}-${fmt}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF yuklab olindi");
    } catch (e: any) {
      toast.error(getErrorMessage(e, "PDF yaratishda xato"));
    }
  }

  async function printPdf(fmt: "a4" | "thermal_58" | "thermal_80") {
    try {
      const { data: blob } = await api.get(`/sale/sales/${id}/pdf?fmt=${fmt}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(blob as Blob);
      const w = window.open(url, "_blank");
      if (w) {
        w.addEventListener("load", () => {
          try { w.print(); } catch {}
        });
      }
      // Don't revoke immediately — print needs the blob
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Chop etish xatosi"));
    }
  }

  function printLabels() {
    window.print();
    toast.info("Yorliqlar chop etish (preview)");
  }

  function sendTelegram() {
    toast.info("Telegram integratsiyasi tez kunda");
  }

  if (!data) return <div className="text-center text-slate-400 py-20">{t("ui__загрузка_43e40d49")}</div>;
  const h = data.head;
  const debt = Number(h.total_amount) - Number(h.paid_amount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100">
          <ArrowLeft size={16} /> {t("ui__назад_2b0b0225")}
        </button>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex">
            <button onClick={() => printPdf("a4")}
              title="A4 chop etish"
              className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-l-md hover:bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700">
              <Printer size={14} /> {t("ui__печать_03448511")}
            </button>
            <button onClick={() => printPdf("thermal_80")}
              title="Termal 80mm chek"
              className="px-2 py-2 text-xs border border-l-0 hover:bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700">
              80mm
            </button>
            <button onClick={() => printPdf("thermal_58")}
              title="Termal 58mm chek"
              className="px-2 py-2 text-xs border border-l-0 rounded-r-md hover:bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700">
              58mm
            </button>
          </div>
          <div className="inline-flex">
            <button onClick={() => downloadPdf("a4")}
              title="PDF (A4) yuklab olish"
              className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-l-md hover:bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700">
              <FileDown size={14} /> PDF
            </button>
            <button onClick={() => downloadPdf("thermal_80")}
              title="Chek PDF (80mm)"
              className="px-2 py-2 text-xs border border-l-0 rounded-r-md hover:bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700">
              chek
            </button>
          </div>
          <div className="inline-flex">
            <button onClick={exportXlsx}
              title="Excel (3 sheet: ma'lumot + mahsulot + to'lov)"
              className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-l-md hover:bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700">
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button onClick={exportCsv}
              title="CSV format"
              className="px-2 py-2 text-xs border border-l-0 rounded-r-md hover:bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700">
              CSV
            </button>
          </div>
          <button onClick={printLabels}
            title="Yorliqlar"
            className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md hover:bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700">
            <Tag size={14} /> Yorliqlar
          </button>
          <button onClick={sendTelegram}
            title="Telegram orqali yuborish"
            className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md hover:bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700">
            <Send size={14} /> Telegram
          </button>
          <button onClick={duplicate}
            title="Nusxalash"
            className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md hover:bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700">
            <Copy size={14} /> Nusxa
          </button>
          {h.status !== "cancelled" && debt > 0 && (
            <button onClick={() => { setAmount(String(debt)); setPayOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-brand-600 text-white rounded-md hover:bg-brand-700">
              <CreditCard size={14} /> {t("ui__оплатить_4caffb2a")}
            </button>
          )}
          {h.status !== "cancelled" && (
            <button onClick={cancel}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-red-300 text-red-700 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20">
              <XCircle size={14} /> {t("ui__отменить_ecdbdc8b")}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border rounded-lg shadow-sm p-8 print:shadow-none print:border-0">
        <div className="flex items-start justify-between mb-6 pb-4 border-b">
          <div>
            <h1 className="text-2xl font-bold">Hisob-chek № {h.doc_number || h.id.slice(0, 8)}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">sana: {new Date(h.sale_date).toLocaleString("ru-RU")}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(h.status)} print:hidden`}>
            {h.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">{t("ui__клиент_4af22f2d")}</div>
            <div className="font-semibold">{h.customer_name || "Chakana xaridor"}</div>
            {h.customer_phone && <div className="text-sm text-slate-600 dark:text-slate-300">{h.customer_phone}</div>}
            {h.customer_tin && <div className="text-sm text-slate-600 dark:text-slate-300">ИНН: {h.customer_tin}</div>}
            {h.customer_address && <div className="text-sm text-slate-600 dark:text-slate-300">{h.customer_address}</div>}
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">{t("ui__склад_e8bf999f")}</div>
            <div className="font-semibold">{h.warehouse_name || "—"}</div>
          </div>
        </div>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-slate-300 text-left">
              <th className="py-2">#</th>
              <th className="py-2">{t("ui__товар_8b35db64")}</th>
              <th className="py-2 text-right">{t("ui__кол_во_302e2bd6")}</th>
              <th className="py-2 text-right">{t("ui__цена_682fa8db")}</th>
              <th className="py-2 text-right">{t("ui__скидка_d9039617")}</th>
              <th className="py-2 text-right">{t("ui__сумма_cf59ebf9")}</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it, idx) => (
              <tr key={it.product_id} className="border-b">
                <td className="py-2">{idx + 1}</td>
                <td className="py-2">{it.product_name}</td>
                <td className="py-2 text-right font-mono">{fmt(it.quantity)}</td>
                <td className="py-2 text-right font-mono">{fmt(it.price)}</td>
                <td className="py-2 text-right font-mono">{fmt(it.discount)}</td>
                <td className="py-2 text-right font-mono font-semibold">{fmt(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span>{t("ui__итого_eab79dbd")}</span>
            <span className="font-mono">{fmt(h.total_amount)} {h.currency_code}</span>
          </div>
          <div className="flex justify-between text-green-700">
            <span>{t("ui__оплачено_1b8d5baa")}</span>
            <span className="font-mono">{fmt(h.paid_amount)}</span>
          </div>
          <div className={`flex justify-between font-bold text-base pt-2 border-t ${debt > 0 ? "text-red-600" : "text-green-700"}`}>
            <span>{t("ui__долг_15be8566")}</span>
            <span className="font-mono">{fmt(debt)}</span>
          </div>
        </div>

        {h.notes && (
          <div className="mt-6 pt-4 border-t text-sm">
            <div className="text-slate-500 dark:text-slate-400 mb-1">{t("ui__примечание_776ff79f")}</div>
            <div>{h.notes}</div>
          </div>
        )}

        {/* UZ chek formati pastki qismi */}
        <div className="mt-8 pt-6 border-t border-dashed text-xs text-slate-600 dark:text-slate-400 space-y-1 print:text-black">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div>Kassir: ____________________</div>
              <div className="mt-2">Mijoz: {h.customer_name || "____________________"}</div>
            </div>
            <div className="text-right">
              <div>Sana: {new Date(h.sale_date).toLocaleDateString("uz-Cyrl-UZ")}</div>
              <div className="mt-2">Hujjat #{h.doc_number || h.id.slice(0, 8)}</div>
            </div>
          </div>
          <div className="text-center pt-3 italic">
            Xaridingiz uchun rahmat! • Спасибо за покупку! • Thank you!
          </div>
        </div>
      </div>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={t("ui__принять_оплату_4a57821b")}>
        <div className="space-y-3">
          <Field label={t("ui__сумма_cf59ebf9")} required>
            <input type="number" step="0.01" className={input} value={amount}
              onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label={t("ui__касса_c85fd621")}>
            <select className={input} value={cashboxId} onChange={(e) => setCashboxId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{t("ui__любая_7f781aa6")}</option>
              {cashboxes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t("ui__тип_оплаты_a6dd9595")}>
            <select className={input} value={paymentTypeId} onChange={(e) => setPaymentTypeId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{t("ui__не_указано_e008000b")}</option>
              {paymentTypes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setPayOpen(false)} className="px-4 py-2 text-sm rounded-md border hover:bg-slate-50 dark:bg-slate-900/40">{t("ui__отмена_987b33c6")}</button>
            <button onClick={pay} className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700">{t("ui__принять_5dc5ad80")}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
