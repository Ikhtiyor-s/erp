"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";

export default function Page() {
  return <SettingsForm
    title="Multivalyuta ko'rsatish"
    description="POS ekranida narxlar yoniga qo'shimcha valyutadagi (masalan USD) ekvivalent summasi ko'rsatiladi. Faqat ko'rsatish — to'lov hamon bitta valyutada qabul qilinadi."
    settingsKey="multicurrency"
    fields={[
      { key: "enabled", label: "Yoqilgan", type: "boolean" },
      { key: "currency_code", label: "Qo'shimcha valyuta kodi", placeholder: "USD",
        help: "Sozlamalar → Valyutalar bo'limida shu valyutaning joriy kursi kiritilgan bo'lishi kerak" },
    ]}
  />;
}
