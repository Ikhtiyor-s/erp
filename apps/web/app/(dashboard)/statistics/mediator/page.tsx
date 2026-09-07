"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { useTranslations } from "next-intl";

export default function MediatorPage() {
  const t = useTranslations("ui");
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__посредничество_6e85608e")}
        description={t("ui__доход_посредника_комиссионная__6b0f8619")}
      />
      <Card padding="none" className="p-8 text-center">
        <div className="text-ink-500 dark:text-ink-400">
          {t("ui__раздел_посредничества_доступен_6afd7abb")}
        </div>
        <div className="text-xs text-ink-400 dark:text-ink-500 mt-2">
          {t("ui__будет_показана_статистика_по_п_736cde6c")}
        </div>
      </Card>
    </div>
  );
}
