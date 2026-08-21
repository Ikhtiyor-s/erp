"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__этикетки_штрих_коды_b53dfd54")}
    description={t("ui__формат_печати_этикеток_на_това_e27c6629")}
    settingsKey="label"
    fields={[
      { key: "size", label: t("ui__размер_этикетки_3b0f163a"), type: "select",
        options: [
          { value: "58x40", label: t("ui__58_40_мм_ca08dd3a") },
          { value: "40x30", label: t("ui__40_30_мм_3843813e") },
          { value: "100x60", label: t("ui__100_60_мм_70d5ffc6") },
        ] },
      { key: "barcode_type", label: t("ui__тип_штрих_кода_93eee9d3"), type: "select",
        options: [
          { value: "EAN13", label: "EAN-13" },
          { value: "CODE128", label: "Code 128" },
          { value: "QR", label: t("ui__qr_код_26727ccb") },
        ] },
      { key: "show_price", label: t("ui__печатать_цену_08ca1d1f"), type: "boolean" },
      { key: "show_name", label: t("ui__печатать_название_5067500c"), type: "boolean" },
      { key: "show_sku", label: t("ui__печатать_sku_72a680be"), type: "boolean" },
    ]}
  />;
}
