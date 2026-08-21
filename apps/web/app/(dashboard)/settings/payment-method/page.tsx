"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__способ_оплаты_по_умолчанию_ad161d24")}
    description={t("ui__параметры_приёма_платежей_dd9ec47b")}
    settingsKey="payment_method"
    fields={[
      { key: "default_payment_type", label: t("ui__тип_оплаты_по_умолчанию_eef791aa"),
        placeholder: "cash, card, transfer..." },
      { key: "default_cashbox_id", label: t("ui__касса_по_умолчанию_id_085dcb9a"), type: "number" },
      { key: "require_payment_type", label: t("ui__обязательное_указание_типа_опл_56174ef8"), type: "boolean" },
      { key: "allow_split_payments", label: t("ui__разрешить_разделение_платежа_8d81d738"), type: "boolean" },
    ]}
  />;
}
