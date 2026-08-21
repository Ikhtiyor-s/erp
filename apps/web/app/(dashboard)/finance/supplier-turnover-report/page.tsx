"use client";

import { TurnoverReport } from "@/components/reports/TurnoverReport";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <TurnoverReport
    title={t("ui__оборот_по_поставщикам_2d36dde3")}
    description={t("ui__денежные_операции_по_поставщик_fbf85356")}
    endpoint="/finance/supplier-turnover"
    entityLabel="Yetkazib beruvchi"
  />;
}
