"use client";

import Image from "next/image";

type BrandIconName =
  | "sale"
  | "finance"
  | "warehouse"
  | "customer"
  | "hr"
  | "settings"
  | "integration"
  | "marketing"
  | "production"
  | "supply"
  | "support"
  | "tasks"
  | "statistics"
  | "pos"
  | "tools"
  | "database"
  | "clock"
  | "org-default"
  | "modal-screen"
  | "connecting-partners-icon";

interface Props {
  name: BrandIconName;
  size?: number;
  className?: string;
  alt?: string;
}

export function BrandIcon({ name, size = 20, className = "", alt }: Props) {
  return (
    <Image
      src={`/icons/${name}.svg`}
      alt={alt ?? name}
      width={size}
      height={size}
      className={className}
      unoptimized
    />
  );
}

interface FlagProps {
  locale: "uz" | "ru" | "en" | "kk" | "ky" | "tg";
  size?: number;
  className?: string;
}

const flagFiles: Record<FlagProps["locale"], string> = {
  uz: "flag-uz",
  ru: "flag-ru",
  en: "flag-us",
  kk: "flag-kk",
  ky: "flag-ky",
  tg: "flag-tg",
};

export function BrandFlag({ locale, size = 16, className = "" }: FlagProps) {
  return (
    <Image
      src={`/icons/${flagFiles[locale]}.svg`}
      alt={locale}
      width={size}
      height={size}
      className={className}
      unoptimized
    />
  );
}
