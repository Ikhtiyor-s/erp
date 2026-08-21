"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__маркетинговые_sms_2afc1d34")}
    description={t("ui__шаблоны_и_рассылки_клиентам_f57807ab")}
    settingsKey="marketing_sms"
    fields={[
      { key: "welcome_template", label: t("ui__шаблон_приветствия_ee11581d"), type: "textarea",
        placeholder: "Xush kelibsiz, {name}! Birinchi xaridga 5% chegirma." },
      { key: "birthday_template", label: t("ui__шаблон_дня_рождения_f4c5771c"), type: "textarea",
        placeholder: "Tug'ilgan kun bilan, {name}! 10% chegirma sovg'a." },
      { key: "discount_template", label: t("ui__шаблон_акции_efa80651"), type: "textarea" },
      { key: "max_per_day", label: t("ui__макс_рассылок_в_день_e9b6ce60"), type: "number" },
      { key: "enabled", label: t("ui__рассылки_включены_9d8a525a"), type: "boolean" },
    ]}
  />;
}
