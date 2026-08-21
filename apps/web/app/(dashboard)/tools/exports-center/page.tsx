"use client";

import {
  Download, Package, Users, Truck, ShoppingCart, Warehouse,
  FileSpreadsheet, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

const FILENAMES: Record<string, { csv: string; xlsx: string }> = {
  products:  { csv: "mahsulotlar.csv",          xlsx: "mahsulotlar.xlsx" },
  customers: { csv: "mijozlar.csv",             xlsx: "mijozlar.xlsx" },
  suppliers: { csv: "yetkazib_beruvchilar.csv", xlsx: "yetkazib_beruvchilar.xlsx" },
  sales:     { csv: "sotuvlar.csv",             xlsx: "sotuvlar.xlsx" },
  stock:     { csv: "qoldiqlar.csv",            xlsx: "qoldiqlar.xlsx" },
};

async function downloadExport(key: string, name: string, format: "csv" | "xlsx") {
  try {
    const { data } = await api.get(`/tools/exports/${key}?format=${format}`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = FILENAMES[key]?.[format] || `${key}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${name} (${format.toUpperCase()}) eksport qilindi`);
  } catch (e: any) {
    toast.error(getErrorMessage(e, "Eksport xatosi"));
  }
}

export default function ExportsCenterPage() {
  const t = useTranslations("ui");
  const exports = [
    { key: "products",  name: t("ui__������������_2ccd69a3"),    description: t("ui__sku_����������_������_��������_������������_��������_dfa4dbb1"), icon: Package,       color: "text-blue-600 dark:text-blue-400" },
    { key: "customers", name: t("ui__��������������_0b63184a"),   description: t("ui__������_������_��������������_������_����������_8be7cfc7"),      icon: Users,         color: "text-green-600 dark:text-green-400" },
    { key: "suppliers", name: t("ui__��������������������_60515512"), description: t("ui__������_����������������_��������������_������_202cca8b"),     icon: Truck,         color: "text-purple-600 dark:text-purple-400" },
    { key: "sales",     name: t("ui__��������������_fd692bfc"),   description: t("ui__������������������_������������_��������_����������_����_d425f964"), icon: ShoppingCart,  color: "text-orange-600 dark:text-orange-400" },
    { key: "stock",     name: t("ui__��������������_021f57eb"),   description: t("ui__����������_����������_������_����_������������������_83bff1b0"),   icon: Warehouse,     color: "text-emerald-600 dark:text-emerald-400" },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__����������_����������������_80b061c0")}
        description={t("ui__����������������_������������_��_��������������_csv_e8addc96")}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exports.map((e) => {
          const I = e.icon;
          return (
            <div
              key={e.key}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5 hover:border-brand-400 dark:hover:border-brand-500 hover:shadow transition"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 bg-slate-100 dark:bg-slate-700 rounded-md ${e.color}`}>
                  <I size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{e.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{e.description}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadExport(e.key, e.name, "xlsx")}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-md font-medium"
                  title="Excel formatida yuklab olish"
                >
                  <FileSpreadsheet size={14} /> Excel
                </button>
                <button
                  onClick={() => downloadExport(e.key, e.name, "csv")}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md"
                  title="CSV formatida yuklab olish"
                >
                  <FileText size={14} /> CSV
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-5">
        <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">
          {t("ui__��_����������������_5401d55d")}
        </h3>
        <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1 list-disc list-inside">
          <li><strong>Excel (.xlsx)</strong> ��� Microsoft Excel, Google Sheets, LibreOffice Calc'da to'g'ridan-to'g'ri ochiladi. Sarlavhalar formatlanagn, filter avtomatik yoqilgan, ustun kengligi avtomatik.</li>
          <li><strong>CSV</strong> ��� universal format, nuqtali vergul (<code>;</code>) ajratuvchi, UTF-8 BOM (kirill/lotin matn buzilmasdan).</li>
          <li>Fayl mahalliy yuklab olinadi, pochta orqali yuborilmaydi.</li>
        </ul>
      </div>
    </div>
  );
}
