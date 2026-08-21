"use client";

import { ProductKindList } from "@/components/product-kind-list";
import { useTranslations } from "next-intl";

export default function ServicesPage() {
  const t = useTranslations("ui");
  return (
    <ProductKindList
      title={t("ui__услуги_4e1a0e95")}
      description={t("ui__услуги_без_складского_учёта_c52c2f43")}
      isService={true}
    />
  );
}
