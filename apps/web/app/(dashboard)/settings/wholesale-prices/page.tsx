"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";

export default function Page() {
  return <SettingsForm
    title="Ulgurji narxlar"
    description="POS ekranida chakana/ulgurji narx rejimini almashtirish tugmasi"
    settingsKey="wholesale_prices"
    fields={[
      { key: "enabled", label: "Ulgurji narx rejimi yoqilgan", type: "boolean" },
    ]}
  />;
}
