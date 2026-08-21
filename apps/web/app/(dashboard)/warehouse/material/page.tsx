"use client";

import { ProductKindList } from "@/components/product-kind-list";
import { useTranslations } from "next-intl";

export default function MaterialPage() {
  const t = useTranslations("ui");
  return (
    <ProductKindList
      title={t("ui__сырьё_b5e9c9c9")}
      description={t("ui__сырьё_для_производства_808549f3")}
      kind="material"
    />
  );
}
