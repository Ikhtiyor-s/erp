"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__напоминания_клиентам_b59c05f6")}
    description={t("ui__автоматические_напоминания_по__5eff93e3")}
    settingsKey="customer_reminders"
    fields={[
      { key: "remind_debtors", label: t("ui__напоминать_должникам_e1a108db"), type: "boolean" },
      { key: "debt_threshold", label: t("ui__сумма_долга_от_c1f311a8"), type: "number" },
      { key: "remind_after_days", label: t("ui__напоминать_через_n_дней_1d7406d7"), type: "number" },
      { key: "channel", label: t("ui__канал_2710d479"), type: "select",
        options: [
          { value: "sms", label: "SMS" },
          { value: "telegram", label: "Telegram" },
          { value: "both", label: t("ui__оба_1c49cfbe") },
        ] },
      { key: "template", label: t("ui__шаблон_напоминания_c924b6c8"), type: "textarea",
        placeholder: "Hurmatli {name}, sizda {amount} {currency} qarz mavjud." },
    ]}
  />;
}
