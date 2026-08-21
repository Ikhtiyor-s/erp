"use client";

import { useEffect, useState } from "react";
import { Crown, Calendar, CreditCard } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type Sub = {
  plan?: string; status?: string; expires_at?: string;
  monthly_price?: number; users_limit?: number; storage_gb?: number;
};

export default function SubscriptionPage() {
  const t = useTranslations("ui");
  const [sub, setSub] = useState<Sub>({});

  const plans = [
    { code: "free", name: t("ui__бесплатный_b257b76a"), price: 0, users: 1, color: "border-slate-300" },
    { code: "start", name: t("ui__старт_85aa4751"), price: 99000, users: 3, color: "border-blue-400 bg-blue-50" },
    { code: "pro", name: "Pro", price: 299000, users: 10, color: "border-brand-500 bg-brand-50" },
    { code: "enterprise", name: "Enterprise", price: 999000, users: 999, color: "border-purple-500 bg-purple-50" },
  ];

  useEffect(() => {
    api.get(`/settings/key/subscription`).then((r) => setSub(r.data?.value || {}));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__подписка_5bf5c1d5")} description={t("ui__тариф_и_оплата_cac8608a")} />

      <div className="bg-white dark:bg-slate-800 border rounded-lg shadow-sm p-6">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-brand-100 text-brand-700 rounded-md">
            <Crown size={24} />
          </div>
          <div className="flex-1">
            <div className="text-sm text-slate-500 dark:text-slate-400">{t("ui__текущий_тариф_4c29c5af")}</div>
            <div className="text-2xl font-bold">{sub.plan || "Bepul"}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              {t("ui__статус_9fa7ff8e")} <span className="text-green-700 font-semibold">{sub.status || "active"}</span>
            </div>
            {sub.expires_at && (
              <div className="text-sm text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 mt-1">
                <Calendar size={14} /> Действует до: {new Date(sub.expires_at).toLocaleDateString("ru-RU")}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((p) => (
          <div key={p.code} className={`bg-white dark:bg-slate-800 border-2 rounded-lg shadow-sm p-5 ${p.color}`}>
            <div className="text-sm text-slate-500 dark:text-slate-400 uppercase">{p.name}</div>
            <div className="text-2xl font-bold mt-2 font-mono">
              {p.price === 0 ? "0" : p.price.toLocaleString("ru-RU")} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{t("ui__uzs_мес_ca9d6258")}</span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mt-3 space-y-1">
              <div>До {p.users} пользователей</div>
              <div>{t("ui__все_модули_fad699b2")}</div>
              <div>{t("ui__email_поддержка_b6081578")}</div>
            </div>
            <button className="mt-4 w-full px-4 py-2 text-sm rounded-md border border-brand-300 text-brand-700 hover:bg-brand-100">
              <CreditCard size={14} className="inline mr-1" /> {t("ui__выбрать_2b02cadd")}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center">
        {t("ui__оплата_подписки_происходит_чер_50bdda5a")}
      </p>
    </div>
  );
}
