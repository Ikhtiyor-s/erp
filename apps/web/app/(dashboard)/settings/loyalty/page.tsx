"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__карта_лояльности_8dd3a417")}
    description={t("ui__кэшбэк_и_бонусы_для_клиентов_404587b9")}
    settingsKey="loyalty"
    fields={[
      { key: "enabled", label: t("ui__программа_лояльности_включена_70cef374"), type: "boolean" },
      { key: "cashback_pct", label: t("ui__кэшбэк_4dcfdae6"), type: "number",
        placeholder: "1.0", help: "Xarid foizi balansga qo'shiladi" },
      { key: "min_purchase", label: t("ui__минимальная_сумма_для_начислен_3aaddbae"), type: "number" },
      { key: "max_payment_pct", label: t("ui__макс_оплаты_бонусами_287cb284"), type: "number",
        help: "Masalan, 30 = mijoz to'lovning 30%ini bonus bilan to'lashi mumkin" },
      { key: "card_prefix", label: t("ui__префикс_карты_6eb11726"), placeholder: "100" },
    ]}
  />;
}
