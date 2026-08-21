"use client";

import { TurnoverReport } from "@/components/reports/TurnoverReport";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("ui");
  return (
    <TurnoverReport
      title={t("ui__торговля_клиентом_219f51d5")}
      description={t("ui__оборот_по_клиентам_за_период_9f21d92e")}
      endpoint="/finance/customer-turnover"
      entityLabel="Mijoz"
    />
  );
}
