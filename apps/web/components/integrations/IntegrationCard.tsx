"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import type { IntegrationInfo } from "@/lib/types/integrations";

interface Props {
  integration: IntegrationInfo;
  onToggle: (code: string, enabled: boolean) => void;
  settingsUrl: string;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  configured: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  not_configured: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  error: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export function IntegrationCard({ integration, onToggle, settingsUrl }: Props) {
  const t = useTranslations("integrations.hub");
  const router = useRouter();

  const statusLabel = (() => {
    switch (integration.status) {
      case "active": return t("status_active");
      case "configured": return t("status_configured");
      case "not_configured": return t("status_not_configured");
      case "error": return t("status_test_failed");
    }
  })();

  async function handleToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked;
    const endpoint = next
      ? `/integrations/${integration.code}/enable`
      : `/integrations/${integration.code}/disable`;
    try {
      await api.post(endpoint);
      onToggle(integration.code, next);
    } catch (err) {
      toast.error(getErrorMessage(err, t("toggle_error")));
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-ink-900 dark:text-ink-50 text-[clamp(13px,1.8vw,14px)] truncate">
            {integration.name}
          </div>
          <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 capitalize">
            {integration.category.replace("_", " ")}
          </div>
        </div>
        <span
          className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[integration.status] ?? STATUS_STYLES.not_configured}`}
        >
          {statusLabel}
        </span>
      </div>

      {integration.description && (
        <p className="text-xs text-ink-500 dark:text-ink-400 line-clamp-2">
          {integration.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-slate-100 dark:border-slate-700">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={integration.enabled}
            onChange={handleToggle}
            aria-label={integration.name}
          />
          <div className="w-9 h-5 bg-slate-200 dark:bg-slate-600 peer-checked:bg-brand-600 rounded-full relative transition-colors after:absolute after:top-0.5 after:left-0.5 after:bg-white after:w-4 after:h-4 after:rounded-full after:transition-all peer-checked:after:translate-x-4" />
          <span className="text-xs text-ink-600 dark:text-ink-400">
            {integration.enabled ? t("enabled") : t("disabled")}
          </span>
        </label>

        {settingsUrl && (
          <button
            onClick={() => router.push(settingsUrl)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
          >
            <Settings2 size={13} />
            {t("open_settings")}
          </button>
        )}
      </div>
    </div>
  );
}
