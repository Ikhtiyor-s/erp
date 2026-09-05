"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/page-header";
import { LabelPrint } from "@/components/barcode/label-print";
import type { LabelData, LabelFormat } from "@/components/barcode/label-print";
import { Tag } from "lucide-react";

const SAMPLE_LABELS: LabelData[] = [
  { name: "Coca-Cola 0.5L",       barcode: "4607175700015", price: 8500,  unit: "so'm" },
  { name: "Lipton Tea 100g",      barcode: "8690728002032", price: 22000, unit: "so'm" },
  { name: "Nestle Nescafe 200g",  barcode: "7613036837033", price: 45000, unit: "so'm" },
  { name: "Ariel 3kg",            barcode: "8001841234567", price: 89000, unit: "so'm" },
  { name: "Lays Original 160g",   barcode: "4820083900012", price: 12000, unit: "so'm" },
];

export default function LabelPrintPage() {
  const t = useTranslations("barcode");
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<LabelFormat>("A4");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("print.title")}
        description={t("print.format")}
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-medium transition-colors"
          >
            <Tag size={14} />
            {t("print.preview")}
          </button>
        }
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5 space-y-4">
        <h2 className="text-[14px] font-semibold text-ink-900 dark:text-ink-100">
          {t("print.format")}
        </h2>
        <div className="flex flex-wrap gap-3">
          {(["A4", "58mm", "80mm"] as LabelFormat[]).map((f) => {
            const labelKey =
              f === "A4"
                ? "print.format_a4"
                : f === "58mm"
                ? "print.format_58mm"
                : "print.format_80mm";
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`px-4 py-2 rounded-md border text-[13px] font-medium transition-colors ${
                  format === f
                    ? "bg-brand-600 border-brand-600 text-white"
                    : "border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800"
                }`}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
        <h2 className="text-[14px] font-semibold text-ink-900 dark:text-ink-100 mb-3">
          {t("product_name")}
        </h2>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-ink-200 dark:border-ink-700">
                <th className="text-left py-2 px-3 text-ink-500 dark:text-ink-400 font-medium">
                  {t("product_name")}
                </th>
                <th className="text-left py-2 px-3 text-ink-500 dark:text-ink-400 font-medium">
                  {t("no_barcode").replace("Shtrix-kod", "").trim() || "Barcode"}
                </th>
                <th className="text-right py-2 px-3 text-ink-500 dark:text-ink-400 font-medium">
                  {t("price")}
                </th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_LABELS.map((item, i) => (
                <tr
                  key={i}
                  className="border-b border-ink-100 dark:border-ink-800 last:border-0"
                >
                  <td className="py-2 px-3 text-ink-900 dark:text-ink-100">
                    {item.name}
                  </td>
                  <td className="py-2 px-3 text-ink-500 dark:text-ink-400 font-mono text-[12px]">
                    {item.barcode}
                  </td>
                  <td className="py-2 px-3 text-right text-ink-900 dark:text-ink-100 font-medium">
                    {item.price?.toLocaleString()} {item.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="md:hidden space-y-2">
          {SAMPLE_LABELS.map((item, i) => (
            <li
              key={i}
              className="border border-ink-100 dark:border-ink-800 rounded-md p-3 space-y-1"
            >
              <div className="font-medium text-ink-900 dark:text-ink-100">
                {item.name}
              </div>
              <div className="text-[12px] text-ink-400 dark:text-ink-500 font-mono">
                {item.barcode}
              </div>
              <div className="text-[13px] font-semibold text-ink-900 dark:text-ink-100">
                {item.price?.toLocaleString()} {item.unit}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 pt-4 border-t border-ink-100 dark:border-ink-800 flex justify-end">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-brand-600 hover:bg-brand-700 text-white text-[13px] font-medium transition-colors"
          >
            <Tag size={14} />
            {t("download_pdf")}
          </button>
        </div>
      </div>

      <LabelPrint
        items={SAMPLE_LABELS}
        format={format}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
