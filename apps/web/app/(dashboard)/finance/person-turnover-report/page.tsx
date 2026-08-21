"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

export default function PersonTurnoverPage() {
  const t = useTranslations("ui");
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__оборот_по_физлицам_5b009d4f")}
        description={t("ui__денежные_операции_с_произвольн_14a51f23")}
      />
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-8 text-center">
        <div className="text-slate-500 dark:text-slate-400">
          {t("ui__здесь_отображаются_операции_с__cfa2d215")}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          Перейдите на{" "}
          <a
            href="/finance/person-balance"
            className="text-brand-600 dark:text-brand-400 hover:underline"
          >
            /finance/person-balance
          </a>{" "}
          для просмотра текущих балансов физлиц.
        </div>
      </div>
    </div>
  );
}
