"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  description?: string;
  onCreate?: () => void;
  createLabel?: string;
  actions?: React.ReactNode;
};

export function PageHeader({
  title,
  description,
  onCreate,
  createLabel,
  actions,
}: Props) {
  const t = useTranslations("common");
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-[clamp(16px,2.2vw,18px)] font-semibold text-ink-900 dark:text-ink-50 tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-[clamp(12px,1.6vw,13px)] text-ink-500 dark:text-ink-400 mt-0.5">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {actions}
        {onCreate && (
          <Button onClick={onCreate} icon={Plus} size="sm">
            {createLabel || t("create")}
          </Button>
        )}
      </div>
    </div>
  );
}
