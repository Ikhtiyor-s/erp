"use client";

import { TurnoverReport } from "@/components/reports/TurnoverReport";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return <TurnoverReport
    title={t("ui__оборот_по_клиентам_e04af825")}
    description={t("ui__денежные_операции_по_клиентам__f1085cd4")}
    endpoint="/finance/customer-turnover"
    entityLabel="Mijoz"
  />;
}
