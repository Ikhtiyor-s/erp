"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__общие_настройки_01d32f78")}
    description={t("ui__язык_валюта_по_умолчанию_часов_a717dde1")}
    settingsKey="general"
    fields={[
      { key: "default_language", label: t("ui__язык_по_умолчанию_3e87ef37"), type: "select",
        options: [
          { value: "ru", label: t("ui__русский_a5c072fa") },
          { value: "uz", label: "O'zbek" },
          { value: "en", label: "English" },
        ] },
      { key: "default_currency", label: t("ui__валюта_по_умолчанию_cdec8f44"), placeholder: "UZS, USD, EUR..." },
      { key: "timezone", label: t("ui__часовой_пояс_17128ae3"), placeholder: "Asia/Tashkent" },
      { key: "fiscal_year_start", label: t("ui__начало_финансового_года_2e4b738d"), placeholder: "MM-DD",
        help: "Masalan, 01-01 — yanvar" },
    ]}
  />;
}
