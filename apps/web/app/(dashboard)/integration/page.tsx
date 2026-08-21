"use client";

import { useRouter } from "next/navigation";
import { Bot, MessageSquare, CreditCard, Smartphone, Globe, Package, Truck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

export default function IntegrationPage() {
  const t = useTranslations("ui");
  const router = useRouter();

  const integrations = [
    { icon: Bot, name: t("ui__telegram_бот_11c8e38c"), desc: "Telegram orqali bildirishnoma va buyurtmalar", href: "/settings/crm", color: "bg-blue-100 text-blue-700" },
    { icon: MessageSquare, name: t("ui__sms_шлюз_37d78480"), desc: "Eskiz, Play Mobile, SMSD", href: "/settings/sms", color: "bg-green-100 text-green-700" },
    { icon: CreditCard, name: t("ui__онлайн_платежи_df64201c"), desc: "Click, Payme", href: "/settings/online-payments", color: "bg-purple-100 text-purple-700" },
    { icon: Smartphone, name: t("ui__карта_лояльности_8dd3a417"), desc: "Keshbek va bonuslar", href: "/settings/loyalty", color: "bg-pink-100 text-pink-700" },
    { icon: Globe, name: t("ui__bitoverse_маркетплейс_9d0052a5"), desc: "Tovarlar va buyurtmalar sinxronlash", href: "/settings/marketplace", color: "bg-indigo-100 text-indigo-700" },
    { icon: Package, name: t("ui__устройства_5172b9d5"), desc: "Printerlar, skanerlar, tarozilar", href: "/settings/devices", color: "bg-amber-100 text-amber-700" },
    { icon: Truck, name: t("ui__курьерская_служба_e92fd8f4"), desc: "Tez kunda (Yandex, Express24)", href: "#", color: "bg-slate-100 text-slate-500 dark:text-slate-400", disabled: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__интеграции_cf4303d4")} description={t("ui__подключите_внешние_сервисы_b2cc3b3c")} />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {integrations.map((it, idx) => {
          const Icon = it.icon;
          return (
            <button key={idx}
              onClick={() => !it.disabled && router.push(it.href)}
              disabled={it.disabled}
              className={`bg-white dark:bg-slate-800 border rounded-lg shadow-sm p-5 text-left transition
                ${it.disabled ? "opacity-50 cursor-not-allowed" : "hover:border-brand-400 hover:shadow"}`}>
              <div className={`inline-flex p-3 rounded-md ${it.color}`}>
                <Icon size={24} />
              </div>
              <div className="font-semibold mt-3">{it.name}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{it.desc}</div>
              {!it.disabled && (
                <div className="text-xs text-brand-600 mt-3">{t("ui__настроить_5185f406")}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
