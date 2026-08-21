"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__параметры_продаж_7d0e6821")}
    description={t("ui__поведение_по_умолчанию_для_про_599fb4e0")}
    settingsKey="sale_options"
    fields={[
      { key: "allow_negative_stock", label: t("ui__разрешить_продажу_при_нулевом__d55450c3"), type: "boolean" },
      { key: "default_discount_pct", label: t("ui__скидка_по_умолчанию_214fec74"), type: "number" },
      { key: "round_total", label: t("ui__округлять_итог_0fa79869"), type: "boolean" },
      { key: "round_to", label: t("ui__округлять_до_uzs_fdbc19a1"), type: "number", placeholder: "100, 500, 1000" },
      { key: "default_status_after_sale", label: t("ui__статус_после_создания_c9130857"), type: "select",
        options: [
          { value: "confirmed", label: t("ui__подтверждено_fe630d99") },
          { value: "draft", label: t("ui__черновик_30ab6155") },
          { value: "paid", label: t("ui__оплачено_сразу_f30d9416") },
        ] },
    ]}
  />;
}
