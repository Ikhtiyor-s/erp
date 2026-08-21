"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__crm_настройки_cfa1bb13")}
    description={t("ui__интеграции_crm_telegram_бот_те_843da679")}
    settingsKey="crm"
    fields={[
      { key: "telegram_bot_token", label: "Telegram bot token", type: "password",
        placeholder: "123456:ABCD...",
        help: "Bot yarating: @BotFather orqali token oling" },
      { key: "telegram_channel_id", label: t("ui__telegram_канал_id_66bc5246"),
        placeholder: "-100xxxxxxxxxx",
        help: "Sotuv xabarnomalari kanali" },
      { key: "notify_on_sale", label: t("ui__уведомлять_о_продажах_d0208e6b"), type: "boolean" },
      { key: "notify_on_low_stock", label: t("ui__уведомлять_о_низких_остатках_28bb989c"), type: "boolean" },
      { key: "default_tags", label: t("ui__теги_по_умолчанию_через_запяту_c7f448e2"),
        placeholder: "yangi, VIP, ulgurji" },
    ]}
  />;
}
