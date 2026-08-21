"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__sms_шлюз_37d78480")}
    description={t("ui__настройки_отправки_sms_клиента_b59d72f5")}
    settingsKey="sms"
    fields={[
      { key: "provider", label: t("ui__провайдер_e426ebc4"), type: "select",
        options: [
          { value: "eskiz.uz", label: "Eskiz.uz" },
          { value: "playmobile", label: "Play Mobile" },
          { value: "smsd", label: "SMSD" },
        ] },
      { key: "api_key", label: t("ui__api_ключ_token_e9cc739b"), type: "password" },
      { key: "sender_name", label: t("ui__имя_отправителя_4c69bb5b"), placeholder: "MOY_MAGAZIN" },
      { key: "balance_check_url", label: t("ui__url_проверки_баланса_3f6519c8"), help: "Ixtiyoriy" },
      { key: "enabled", label: t("ui__sms_включены_ed77ce84"), type: "boolean" },
    ]}
  />;
}
