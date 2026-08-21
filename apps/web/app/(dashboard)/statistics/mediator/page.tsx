"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

export default function MediatorPage() {
  const t = useTranslations("ui");
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__посредничество_6e85608e")}
        description={t("ui__доход_посредника_комиссионная__6b0f8619")}
      />
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-8 text-center">
        <div className="text-slate-500 dark:text-slate-400">
          {t("ui__раздел_посредничества_доступен_6afd7abb")}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          {t("ui__будет_показана_статистика_по_п_736cde6c")}
        </div>
      </div>
    </div>
  );
}
