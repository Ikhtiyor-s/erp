"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

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
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-[clamp(12px,1.6vw,13px)] font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
          >
            <Plus size={14} strokeWidth={2} /> {createLabel || t("create")}
          </button>
        )}
      </div>
    </div>
  );
}
