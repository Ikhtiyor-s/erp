"use client";

import {
  Download, Package, Users, Truck, ShoppingCart, Warehouse,
  FileSpreadsheet, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    { key: "products",  name: t("ui__товары_2ccd69a3"),    description: t("ui__sku_штрих_код_цена_закупа_прод_dfa4dbb1"), icon: Package,       color: "text-blue-600 dark:text-blue-400" },
    { key: "customers", name: t("ui__клиенты_0b63184a"),   description: t("ui__код_фио_телефон_инн_адрес_8be7cfc7"),      icon: Users,         color: "text-green-600 dark:text-green-400" },
    { key: "suppliers", name: t("ui__поставщики_60515512"), description: t("ui__код_название_телефон_инн_202cca8b"),     icon: Truck,         color: "text-purple-600 dark:text-purple-400" },
    { key: "sales",     name: t("ui__продажи_fd692bfc"),   description: t("ui__документы_продаж_дата_сумма_кл_d425f964"), icon: ShoppingCart,  color: "text-orange-600 dark:text-orange-400" },
    { key: "stock",     name: t("ui__остатки_021f57eb"),   description: t("ui__склад_товар_кол_во_стоимость_83bff1b0"),   icon: Warehouse,     color: "text-emerald-600 dark:text-emerald-400" },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__центр_экспорта_80b061c0")}
        description={t("ui__выгрузка_данных_в_формате_csv_e8addc96")}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exports.map((e) => {
          const I = e.icon;
          return (
            <Card key={e.key} padding="lg" className="hover:border-brand-400 dark:hover:border-brand-500 hover:shadow transition">
              <div className="flex items-start gap-3 mb-3">
                <div className={`p-2 bg-ink-100 dark:bg-ink-800 rounded-md ${e.color}`}>
                  <I size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-ink-900 dark:text-ink-100">{e.name}</div>
                  <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">{e.description}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="md"
                  icon={FileSpreadsheet}
                  fullWidth
                  onClick={() => downloadExport(e.key, e.name, "xlsx")}
                  title="Excel formatida yuklab olish"
                >
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  icon={FileText}
                  fullWidth
                  onClick={() => downloadExport(e.key, e.name, "csv")}
                  title="CSV formatida yuklab olish"
                >
                  CSV
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card padding="lg">
        <h3 className="font-semibold mb-2 text-ink-900 dark:text-ink-100">
          {t("ui__о_форматах_5401d55d")}
        </h3>
        <ul className="text-sm text-ink-600 dark:text-ink-300 space-y-1 list-disc list-inside">
          <li><strong>Excel (.xlsx)</strong> ��� Microsoft Excel, Google Sheets, LibreOffice Calc'da to'g'ridan-to'g'ri ochiladi. Sarlavhalar formatlanagn, filter avtomatik yoqilgan, ustun kengligi avtomatik.</li>
          <li><strong>CSV</strong> ��� universal format, nuqtali vergul (<code>;</code>) ajratuvchi, UTF-8 BOM (kirill/lotin matn buzilmasdan).</li>
          <li>Fayl mahalliy yuklab olinadi, pochta orqali yuborilmaydi.</li>
        </ul>
      </Card>
    </div>
  );
}
