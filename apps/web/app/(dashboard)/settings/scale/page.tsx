"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__весы_01729404")}
    description={t("ui__подключение_электронных_весов_c0d9ab22")}
    settingsKey="scale"
    fields={[
      { key: "model", label: t("ui__модель_23c9d9be"), placeholder: "CAS PD-II, Mertech 326..." },
      { key: "port", label: t("ui__com_порт_cc8ef13d"), placeholder: "COM1, /dev/ttyUSB0" },
      { key: "baud_rate", label: t("ui__скорость_baud_bc355c12"), type: "number", placeholder: "9600" },
      { key: "auto_weighing", label: t("ui__авто_взвешивание_при_сканирова_7d7ddecf"), type: "boolean" },
      { key: "unit", label: t("ui__единица_измерения_c6e5a296"), type: "select",
        options: [
          { value: "kg", label: t("ui__килограммы_874fb808") },
          { value: "g", label: t("ui__граммы_5a4342bf") },
        ] },
    ]}
  />;
}
