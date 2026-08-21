"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";

export default function Page() {
  const t = useTranslations("ui");
  return (
    <div className="space-y-4">
      <SettingsForm
        title={t("ui__онлайн_платежи_df64201c")}
        description={t("ui__подключение_click_payme_apelsi_aacc1576")}
        settingsKey="online_payments"
        fields={[
          { key: "click_enabled", label: t("ui__click_включён_34532f62"), type: "boolean" },
          { key: "click_merchant_id", label: "Click Merchant ID" },
          { key: "click_secret_key", label: "Click Secret Key", type: "password" },
          { key: "payme_enabled", label: t("ui__payme_включён_c2a0efef"), type: "boolean" },
          { key: "payme_merchant_id", label: "Payme Merchant ID" },
          { key: "payme_secret_key", label: "Payme Secret Key", type: "password" },
        ]}
      />

      {/* P0-5: Apelsin integration removed — backend webhook not implemented.
          Show "coming soon" instead of fake-configured UI. */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
        <Clock size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold text-amber-900 dark:text-amber-200">
            Apelsin — tez kunda
          </div>
          <div className="text-amber-800 dark:text-amber-300 mt-1">
            Apelsin to'lov tizimi integratsiyasi ishlab chiqilmoqda.
            Hozircha Click va Payme orqali ishlay olasiz.
          </div>
        </div>
      </div>
    </div>
  );
}
