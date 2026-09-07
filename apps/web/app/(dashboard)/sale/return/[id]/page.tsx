"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  FileText,
  FileSpreadsheet,
  Send,
  History,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

type RetDetail = {
  head: {
    id: string;
    doc_number?: string;
    uuid_label: string;
    status: string;
    return_date: string;
    sync_date?: string;
    created_at: string;
    invoice_number?: string;
    total_amount: string;
    total_cost: string;
    total_discount: string;
    total_payable: string;
    paid_amount: string;
    tax_excluded: string;
    tax_included: string;
    notes?: string;
    reason?: string;
    sale_id?: string;
    sale_doc?: string;
    reason_name?: string;
    return_type?: string;
    org_name?: string;
    responsible_name?: string;
    created_by_name?: string;
    customer_id?: string;
    customer_name?: string;
    customer_phone?: string;
    customer_address?: string;
    customer_tin?: string;
    posrednik_name?: string;
    warehouse_name?: string;
    currency_code?: string;
  };
  items: {
    id: number;
    product_id: string;
    product_name: string;
    product_sku?: string;
    unit_id?: number;
    unit_name?: string;
    warehouse_id?: number;
    item_warehouse_name?: string;
    quantity: string;
    quantity_used?: string;
    unit_ratio: string;
    returned_amount: string;
    price: string;
    discount: string;
    tax_included: string;
    tax_added: string;
    extra_price: string;
    discount_per_unit: string;
    total_price: string;
    notes?: string;
  }[];
};

const fmt = (v: any) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
const RETURN_STATUS_TONE: Record<string, "success" | "neutral" | "danger"> = {
  completed: "success",
  draft: "neutral",
  cancelled: "danger",
};
const statusLabel = (s: string) =>
  ({ completed: "Bajarildi", draft: "Qoralama", cancelled: "Bekor qilindi" }[s] || s);
const typeLabel = (t?: string) =>
  t === "valid" ? "Haqiqiy" : t === "invalid" ? "Haqiqiy emas" : "—";

export default function ReturnDetailPage() {
  const t = useTranslations("ui");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<RetDetail | null>(null);

  useEffect(() => {
    api.get<RetDetail>(`/sale/returns/${id}`).then((r) => setData(r.data));
  }, [id]);

  function exportCsv() {
    if (!data) return;
    const head = data.head;
    const rows = [
      ["№", "Mahsulot", "SKU", "Birl.", "Ombor", "Miqdor", "Ratio", "Narx", "Chegirma", "Soliq ich.", "Soliq +", "Qo'sh.narx", "Jami"],
      ...data.items.map((it, idx) => [
        String(idx + 1),
        it.product_name,
        it.product_sku || "",
        it.unit_name || "",
        it.item_warehouse_name || "",
        it.quantity,
        it.unit_ratio,
        it.price,
        it.discount,
        it.tax_included,
        it.tax_added,
        it.extra_price,
        String(Number(it.quantity) * Number(it.price) + Number(it.extra_price) - Number(it.discount)),
      ]),
      [],
      ["Jami:", "", "", "", "", "", "", "", "", "", "", "", String(head.total_amount)],
      ["To'lovga:", "", "", "", "", "", "", "", "", "", "", "", String(head.total_payable)],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `return-${head.uuid_label}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function telegramSend() {
    toast.info(t("ui__telegram_bot_интеграция_настра_9cf25652"));
  }
  function showAudit() {
    toast.info(t("ui__история_аудита_в_разработке_au_e81c303b"));
  }

  if (!data) {
    return <div className="text-center py-20 text-ink-400">{t("ui__загрузка_43e40d49")}</div>;
  }
  const h = data.head;
  const debt = Number(h.total_payable) - Number(h.paid_amount);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => router.back()}>
          {t("ui__назад_2b0b0225")}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="md" icon={Printer} onClick={() => window.print()}>
            {t("ui__печать_03448511")}
          </Button>
          <Button variant="outline" size="md" icon={FileText} onClick={() => window.print()}>
            {t("ui__сохранить_как_pdf_c78ce159")}
          </Button>
          <Button variant="outline" size="md" icon={FileSpreadsheet} onClick={exportCsv}>
            {t("ui__сохранить_как_excel_9f476b8d")}
          </Button>
          <Button variant="outline" size="md" icon={Send} onClick={telegramSend}>
            Telegram
          </Button>
          <Button variant="outline" size="md" icon={History} onClick={showAudit}>
            {t("ui__история_аудита_8097646b")}
          </Button>
        </div>
      </div>

      {/* Header card */}
      <Card padding="lg" className="print:shadow-none print:border-0">
        <div className="flex items-start justify-between pb-4 mb-4 border-b border-ink-200 dark:border-ink-800">
          <div>
            <h1 className="text-2xl font-bold">
              Возврат № {h.doc_number || h.id.slice(0, 8)}
            </h1>
            <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
              ID: <code>{h.uuid_label}</code> от{" "}
              {new Date(h.return_date).toLocaleString("ru-RU")}
            </p>
          </div>
          <Badge tone={RETURN_STATUS_TONE[h.status] || "neutral"} className="print:hidden">
            {statusLabel(h.status)}
          </Badge>
        </div>

        {/* Detail field grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <FieldRow label={t("ui__номер_d6d264ff")} value={h.doc_number} />
          <FieldRow label={t("ui__id_номер_e669322b")} value={<code>{h.uuid_label}</code>} />
          <FieldRow label={t("ui__статус_7203f7a4")} value={statusLabel(h.status)} />
          <FieldRow label={t("ui__организация_5e591067")} value={h.org_name} />
          <FieldRow label={t("ui__устройство_72275dac")} value="—" />
          <FieldRow label={t("ui__ответственный_ab60703b")} value={h.responsible_name} />
          <FieldRow label={t("ui__посредник_26986062")} value={h.posrednik_name} />
          <FieldRow label={t("ui__клиент_4af22f2d")} value={h.customer_name || "Chakana"} />
          <FieldRow label={t("ui__склад_e8bf999f")} value={h.warehouse_name} />
          <FieldRow
            label={t("ui__синхронизированная_дата_9000d595")}
            value={
              h.sync_date
                ? new Date(h.sync_date).toLocaleString("ru-RU")
                : "—"
            }
          />
          <FieldRow
            label={t("ui__созданное_время_95199988")}
            value={new Date(h.created_at).toLocaleString("ru-RU")}
          />
          <FieldRow label={t("ui__создатель_9e96e967")} value={h.created_by_name} />
          <FieldRow
            label={t("ui__причина_d88300c7")}
            value={
              h.reason_name ? (
                <span>
                  {h.reason_name}{" "}
                  <span className="text-xs text-ink-500 dark:text-ink-400">
                    ({typeLabel(h.return_type)})
                  </span>
                </span>
              ) : (
                "—"
              )
            }
          />
          <FieldRow label={t("ui__валюта_cf55d9a9")} value={h.currency_code || "—"} />
          <FieldRow label={t("ui__счёт_фактуры_bd709911")} value={h.invoice_number} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm mt-4 pt-4 border-t border-ink-200 dark:border-ink-800">
          <FieldRow label={t("ui__итого_исключительный_налог_0f381d74")} value={fmt(h.tax_excluded)} mono />
          <FieldRow label={t("ui__итого_включая_налог_b265bb37")} value={fmt(h.tax_included)} mono />
          <FieldRow label={t("ui__итоговая_стоимость_2a198c4c")} value={fmt(h.total_cost)} mono />
          <FieldRow label={t("ui__общая_скидка_b52f46a8")} value={fmt(h.total_discount)} mono />
          <FieldRow label={t("ui__итого_к_оплате_70406f5b")} value={fmt(h.total_payable)} mono />
          <FieldRow label={t("ui__оплаченный_0a431d4d")} value={fmt(h.paid_amount)} mono />
        </div>
      </Card>

      {/* Items table */}
      <Card padding="none">
        <CardHeader title={t("ui__товары_2ccd69a3")} />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-ink-50 dark:bg-ink-900/40">
              <tr className="text-ink-600 dark:text-ink-300">
                <th className="px-2 py-2 text-left w-8">№</th>
                <th className="px-2 py-2 text-left">{t("ui__товары_2ccd69a3")}</th>
                <th className="px-2 py-2 text-left w-16">{t("ui__ед_11f95ddc")}</th>
                <th className="px-2 py-2 text-left w-32">{t("ui__склад_e8bf999f")}</th>
                <th className="px-2 py-2 text-right w-20">{t("ui__кол_во_302e2bd6")}</th>
                <th className="px-2 py-2 text-right w-20">{t("ui__использовано_9b601b87")}</th>
                <th className="px-2 py-2 text-right w-16">Ratio</th>
                <th className="px-2 py-2 text-right w-24">{t("ui__возвращено_494d5d8f")}</th>
                <th className="px-2 py-2 text-right w-24">{t("ui__цена_682fa8db")}</th>
                <th className="px-2 py-2 text-right w-28">{t("ui__общая_цена_54b97212")}</th>
                <th className="px-2 py-2 text-right w-20">{t("ui__скидка_d9039617")}</th>
                <th className="px-2 py-2 text-right w-20">{t("ui__налог_вкл_6ce6e67d")}</th>
                <th className="px-2 py-2 text-right w-20">{t("ui__налог_58688e2f")}</th>
                <th className="px-2 py-2 text-right w-20">{t("ui__доп_цена_8f010b4a")}</th>
                <th className="px-2 py-2 text-right w-24">{t("ui__общий_d22f4b95")}</th>
                <th className="px-2 py-2 text-left w-32">{t("ui__примечание_686eb72b")}</th>
                <th className="px-2 py-2 text-right w-20">{t("ui__скидка_ед_1faf4c75")}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, idx) => (
                <tr key={it.id} className="border-t hover:bg-ink-50 dark:bg-ink-900/40">
                  <td className="px-2 py-2">{idx + 1}</td>
                  <td className="px-2 py-2">
                    {it.product_name}
                    {it.product_sku && (
                      <span className="text-ink-400 ml-1">({it.product_sku})</span>
                    )}
                  </td>
                  <td className="px-2 py-2">{it.unit_name || "—"}</td>
                  <td className="px-2 py-2">{it.item_warehouse_name || "—"}</td>
                  <td className="px-2 py-2 text-right font-mono">
                    {fmt(it.quantity)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {fmt(it.quantity_used)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {fmt(it.unit_ratio)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {fmt(it.returned_amount)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {fmt(it.price)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {fmt(Number(it.quantity) * Number(it.price))}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {fmt(it.discount)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {fmt(it.tax_included)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {fmt(it.tax_added)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {fmt(it.extra_price)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono font-semibold">
                    {fmt(it.total_price)}
                  </td>
                  <td className="px-2 py-2">{it.notes || "—"}</td>
                  <td className="px-2 py-2 text-right font-mono">
                    {fmt(it.discount_per_unit)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-ink-50 dark:bg-ink-900/40 font-semibold border-t-2 border-ink-300">
                <td colSpan={14} className="px-2 py-3 text-right">
                  {t("ui__итого_eab79dbd")}
                </td>
                <td className="px-2 py-3 text-right font-mono">
                  {fmt(h.total_amount)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Receipt-style mini */}
      <Card padding="lg" className="max-w-md mx-auto print:max-w-full print:border-0">
        <div className="text-center font-mono text-xs space-y-1">
          <div className="font-bold text-base">{h.org_name}</div>
          <div className="border-t border-dashed my-2"></div>
          <div>Kassir: {h.responsible_name || h.created_by_name}</div>
          <div>Mijoz: {h.customer_name || "Chakana"}</div>
          {h.customer_phone && <div>Tel: {h.customer_phone}</div>}
          <div>Sana: {new Date(h.return_date).toLocaleString("ru-RU")}</div>
          <div className="border-t border-dashed my-2"></div>
          {data.items.map((it, idx) => (
            <div key={it.id} className="text-left">
              <div>
                {idx + 1}. {it.product_name}
              </div>
              <div className="flex justify-between">
                <span>
                  {fmt(it.quantity)} {it.unit_name || ""} x {fmt(it.price)}
                </span>
                <span className="font-bold">{fmt(it.total_price)}</span>
              </div>
            </div>
          ))}
          <div className="border-t border-dashed my-2"></div>
          <div className="flex justify-between font-bold">
            <span>Jami:</span>
            <span>{fmt(h.total_amount)}</span>
          </div>
          <div className="flex justify-between text-danger-700 dark:text-danger-500">
            <span>{t("ui__долг_15be8566")}</span>
            <span>{fmt(debt)}</span>
          </div>
          <div className="flex justify-between text-success-700 dark:text-success-500">
            <span>To'landi:</span>
            <span>{fmt(h.paid_amount)}</span>
          </div>
          <div className="border-t border-dashed my-2"></div>
          <div className="font-bold">{t("ui__вид_чека_возврат_254f0ab5")}</div>
          <div className="border-t border-dashed my-2"></div>
          <div className="text-ink-500 dark:text-ink-400">
            Bizni tanlaganingizdan mamnunmiz!
          </div>
        </div>
      </Card>
    </div>
  );
}

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-ink-500 dark:text-ink-400 uppercase">{label}</div>
      <div className={`mt-0.5 ${mono ? "font-mono font-semibold" : ""}`}>
        {value || "—"}
      </div>
    </div>
  );
}
