"use client";

import { useEffect, useState } from "react";
import { Crown, Calendar, CreditCard } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

type Sub = {
  plan?: string; status?: string; expires_at?: string;
  monthly_price?: number; users_limit?: number; storage_gb?: number;
};

export default function SubscriptionPage() {
  const t = useTranslations("ui");
  const [sub, setSub] = useState<Sub>({});

  const plans = [
    { code: "free", name: t("ui__бесплатный_b257b76a"), price: 0, users: 1, ring: "border-ink-300 dark:border-ink-700" },
    { code: "start", name: t("ui__старт_85aa4751"), price: 99000, users: 3, ring: "border-info-500 bg-info-50 dark:bg-info-500/10" },
    { code: "pro", name: "Pro", price: 299000, users: 10, ring: "border-brand-500 bg-brand-50 dark:bg-brand-900/20" },
    { code: "enterprise", name: "Enterprise", price: 999000, users: 999, ring: "border-purple-500 bg-purple-100 dark:bg-purple-900/20" },
  ];

  useEffect(() => {
    api.get(`/settings/key/subscription`).then((r) => setSub(r.data?.value || {}));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title={t("ui__подписка_5bf5c1d5")} description={t("ui__тариф_и_оплата_cac8608a")} />

      <Card>
        <div className="flex items-start gap-3">
          <div className="p-3 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 rounded-md">
            <Crown size={24} />
          </div>
          <div className="flex-1">
            <div className="text-sm text-ink-500 dark:text-ink-400">{t("ui__текущий_тариф_4c29c5af")}</div>
            <div className="text-2xl font-bold text-ink-900 dark:text-ink-50">{sub.plan || "Bepul"}</div>
            <div className="text-sm text-ink-600 dark:text-ink-300 mt-1 inline-flex items-center gap-2">
              {t("ui__статус_9fa7ff8e")}
              <Badge tone={sub.status === "active" || !sub.status ? "success" : "neutral"}>
                {sub.status || "active"}
              </Badge>
            </div>
            {sub.expires_at && (
              <div className="text-sm text-ink-600 dark:text-ink-300 inline-flex items-center gap-1 mt-1">
                <Calendar size={14} /> Действует до: {new Date(sub.expires_at).toLocaleDateString("ru-RU")}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((p) => (
          <Card key={p.code} className={`border-2 ${p.ring}`}>
            <div className="text-sm text-ink-500 dark:text-ink-400 uppercase">{p.name}</div>
            <div className="text-2xl font-bold mt-2 font-mono text-ink-900 dark:text-ink-50">
              {p.price === 0 ? "0" : p.price.toLocaleString("ru-RU")} <span className="text-sm font-normal text-ink-500 dark:text-ink-400">{t("ui__uzs_мес_ca9d6258")}</span>
            </div>
            <div className="text-xs text-ink-600 dark:text-ink-300 mt-3 space-y-1">
              <div>До {p.users} пользователей</div>
              <div>{t("ui__все_модули_fad699b2")}</div>
              <div>{t("ui__email_поддержка_b6081578")}</div>
            </div>
            <Button variant="outline" size="sm" fullWidth icon={CreditCard} className="mt-4">
              {t("ui__выбрать_2b02cadd")}
            </Button>
          </Card>
        ))}
      </div>

      <p className="text-xs text-ink-400 text-center">
        {t("ui__оплата_подписки_происходит_чер_50bdda5a")}
      </p>
    </div>
  );
}
