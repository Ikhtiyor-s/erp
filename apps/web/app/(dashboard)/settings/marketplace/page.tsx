"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <SettingsForm
    title={t("ui__bitoverse_маркетплейс_9d0052a5")}
    description={t("ui__интеграция_с_внешним_маркетпле_85107656")}
    settingsKey="marketplace"
    fields={[
      { key: "enabled", label: t("ui__интеграция_включена_4491d209"), type: "boolean" },
      { key: "api_url", label: "URL API" },
      { key: "api_key", label: t("ui__api_ключ_8e608430"), type: "password" },
      { key: "store_id", label: t("ui__id_магазина_24f6d0a5") },
      { key: "sync_products", label: t("ui__синхронизация_товаров_82487c20"), type: "boolean" },
      { key: "sync_stock", label: t("ui__синхронизация_остатков_93d7cbe0"), type: "boolean" },
      { key: "sync_orders", label: t("ui__импорт_заказов_83e85400"), type: "boolean" },
    ]}
  />;
}
