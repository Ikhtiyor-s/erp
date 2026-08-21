"use client";

import { TurnoverReport } from "@/components/reports/TurnoverReport";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <TurnoverReport
    title={t("ui__оборот_по_сотрудникам_decadf23")}
    description={t("ui__денежные_операции_по_сотрудник_a83ad9fa")}
    endpoint="/finance/employee-turnover"
    entityLabel="Xodim"
  />;
}
