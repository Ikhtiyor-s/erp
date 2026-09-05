"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TurnoverReport } from "@/components/reports/TurnoverReport";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";

type EntityType = "cashbox" | "customer" | "employee" | "supplier" | "person";

const ENDPOINTS: Record<EntityType, string> = {
  cashbox: "/finance/cashbox-turnover",
  customer: "/finance/customer-turnover",
  employee: "/finance/employee-turnover",
  supplier: "/finance/supplier-turnover",
  person: "/finance/person-turnover",
};

const ENTITY_TYPES: EntityType[] = [
  "cashbox",
  "customer",
  "employee",
  "supplier",
  "person",
];

function TurnoverTabs() {
  const t = useTranslations("finance.turnover");
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawTab = searchParams.get("tab") as EntityType | null;
  const activeTab: EntityType =
    rawTab && ENTITY_TYPES.includes(rawTab) ? rawTab : "cashbox";

  const TAB_LABELS: Record<EntityType, string> = {
    cashbox: t("tab_cashbox"),
    customer: t("tab_customer"),
    employee: t("tab_employee"),
    supplier: t("tab_supplier"),
    person: t("tab_person"),
  };

  const ENTITY_LABELS: Record<EntityType, string> = {
    cashbox: t("col_entity_cashbox"),
    customer: t("col_entity_customer"),
    employee: t("col_entity_employee"),
    supplier: t("col_entity_supplier"),
    person: t("col_entity_person"),
  };

  function handleTabChange(tab: EntityType) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/finance/turnover?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {ENTITY_TYPES.map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? "border-brand-600 text-brand-700 dark:text-brand-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <TurnoverReport
        key={activeTab}
        title={TAB_LABELS[activeTab]}
        description={t("description")}
        endpoint={ENDPOINTS[activeTab]}
        entityLabel={ENTITY_LABELS[activeTab]}
      />
    </div>
  );
}

export default function TurnoverPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-40 text-slate-400">
          <span>Yuklanmoqda...</span>
        </div>
      }
    >
      <TurnoverTabs />
    </Suspense>
  );
}
