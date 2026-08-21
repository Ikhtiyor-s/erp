"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__безопасность_устройств_7f9386a1")}
    description={t("ui__доступ_к_устройствам_и_кассам_76ff8cfe")}
    settingsKey="device_security"
    fields={[
      { key: "require_pin_on_open", label: t("ui__pin_код_при_открытии_кассы_2faa3f9c"), type: "boolean" },
      { key: "session_timeout_min", label: t("ui__тайм_аут_сессии_мин_e68e9fe7"), type: "number" },
      { key: "log_all_actions", label: t("ui__логировать_все_действия_2679d0ba"), type: "boolean" },
      { key: "max_unauthorized_attempts", label: t("ui__макс_неудачных_попыток_b5d266bb"), type: "number" },
      { key: "allow_remote_access", label: t("ui__разрешить_удалённый_доступ_9dc7fcc4"), type: "boolean" },
    ]}
  />;
}
