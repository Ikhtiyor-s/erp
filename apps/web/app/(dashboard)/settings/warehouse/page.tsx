"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__склад_настройки_d87fd9f1")}
    description={t("ui__параметры_работы_со_складом_eef18889")}
    settingsKey="warehouse"
    fields={[
      { key: "default_warehouse_id", label: t("ui__склад_по_умолчанию_id_fd175767"), type: "number" },
      { key: "auto_decrement_on_sale", label: t("ui__списывать_остаток_при_продаже_b27c62e0"), type: "boolean" },
      { key: "track_serial_numbers", label: t("ui__учёт_серийных_номеров_788e48f0"), type: "boolean" },
      { key: "low_stock_threshold_pct", label: t("ui__уведомлять_при_остатке_ниже_6857779b"), type: "number" },
      { key: "cost_method", label: t("ui__метод_учёта_себестоимости_b43912bb"), type: "select",
        options: [
          { value: "weighted_avg", label: t("ui__средневзвешенная_6e83ccab") },
          { value: "fifo", label: "FIFO" },
          { value: "lifo", label: "LIFO" },
        ] },
    ]}
  />;
}
