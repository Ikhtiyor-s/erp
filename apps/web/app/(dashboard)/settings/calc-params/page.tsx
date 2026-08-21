"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__параметры_расчёта_316a57f1")}
    description={t("ui__формулы_и_налоговые_ставки_e4e46034")}
    settingsKey="calc_params"
    fields={[
      { key: "vat_pct", label: t("ui__ндс_0f620c05"), type: "number", placeholder: "12" },
      { key: "vat_included", label: t("ui__ндс_включён_в_цену_9a4c38c5"), type: "boolean" },
      { key: "rounding_mode", label: t("ui__режим_округления_64d28bf0"), type: "select",
        options: [
          { value: "round", label: t("ui__обычное_0_5_1_b2e6695d") },
          { value: "ceil", label: t("ui__вверх_8b1b24ee") },
          { value: "floor", label: t("ui__вниз_34b0272a") },
        ] },
      { key: "decimal_places", label: t("ui__знаков_после_запятой_f2b615df"), type: "number", placeholder: "2" },
      { key: "default_markup_pct", label: t("ui__наценка_по_умолчанию_ca6fc147"), type: "number" },
    ]}
  />;
}
