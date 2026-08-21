"use client";

import { ProductKindList } from "@/components/product-kind-list";
import { useTranslations } from "next-intl";

export default function SemiProductPage() {
  const t = useTranslations("ui");
  return (
    <ProductKindList
      title={t("ui__полуфабрикаты_cd70c2d0")}
      description={t("ui__полуфабрикаты_продукты_для_дал_650ed9a5")}
      kind="semi"
    />
  );
}
