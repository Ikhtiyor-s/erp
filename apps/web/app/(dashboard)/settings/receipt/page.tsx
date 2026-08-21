"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__формат_чека_040fef39")}
    description={t("ui__настройки_печати_чеков_d998915f")}
    settingsKey="receipt"
    fields={[
      { key: "width_mm", label: t("ui__ширина_мм_e373c0e9"), type: "select",
        options: [
          { value: "58", label: t("ui__58_мм_9a930920") },
          { value: "80", label: t("ui__80_мм_40b05a2c") },
          { value: "A4", label: "A4" },
        ] },
      { key: "header", label: t("ui__заголовок_чека_c775fd86"), type: "textarea",
        placeholder: "MCHJ \"Do'kon\"\nToshkent, ko'cha ..." },
      { key: "footer", label: t("ui__подвал_чека_6ef8f78f"), type: "textarea",
        placeholder: "Xaridingiz uchun rahmat!" },
      { key: "show_logo", label: t("ui__печатать_логотип_91466cb9"), type: "boolean" },
      { key: "show_barcode", label: t("ui__печатать_штрих_код_документа_fad9f915"), type: "boolean" },
      { key: "auto_print", label: t("ui__авто_печать_после_продажи_90459472"), type: "boolean" },
    ]}
  />;
}
