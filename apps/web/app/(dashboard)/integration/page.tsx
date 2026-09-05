"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import type { IntegrationInfo, IntegrationCategory } from "@/lib/types/integrations";

type FilterCategory = IntegrationCategory | "all";

const CATEGORY_FILTER_KEYS: { value: FilterCategory; labelKey: string }[] = [
  { value: "all", labelKey: "filter_all" },
  { value: "payment", labelKey: "filter_payment" },
  { value: "delivery", labelKey: "filter_delivery" },
  { value: "communication", labelKey: "filter_communication" },
  { value: "e_invoice", labelKey: "filter_e_invoice" },
  { value: "accounting", labelKey: "filter_accounting" },
  { value: "tools", labelKey: "filter_tools" },
];

function settingsUrlFor(code: string, category: IntegrationCategory): string {
  switch (code) {
    case "click":
    case "payme":
    case "alif":
    case "uzum":
    case "multicard":
    case "rahmat":
    case "bill_payment":
      return "/settings/online-payments";
    case "yandex_delivery":
    case "bts_delivery":
      return "/settings/delivery";
    case "telegram":
      return "/settings/crm";
    case "eskiz":
      return "/settings/sms";
    case "didox":
      return "/settings/didox";
    case "1c_export":
      return "/tools/1c-export";
    case "mxik":
      return "/warehouse/products";
    case "barcode":
      return "/tools/label-print";
    default:
      break;
  }
  switch (category) {
    case "payment": return "/settings/online-payments";
    case "delivery": return "/settings/delivery";
    case "communication": return "/settings/crm";
    case "e_invoice": return "/settings/didox";
    case "accounting": return "/tools/1c-export";
    default: return "/integration";
  }
}

export default function IntegrationHubPage() {
  const t = useTranslations("integrations.hub");
  const [items, setItems] = useState<IntegrationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<IntegrationInfo[]>("/integrations");
        if (!cancelled) setItems(data);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, t("load_error")));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [t]);

  function handleToggle(code: string, enabled: boolean) {
    setItems((prev) =>
      prev.map((i) =>
        i.code === code
          ? { ...i, enabled, status: enabled ? (i.configured ? "active" : "configured") : "not_configured" }
          : i
      )
    );
    toast.success(enabled ? t("enabled_ok") : t("disabled_ok"));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      const matchCat = activeFilter === "all" || i.category === activeFilter;
      const matchQ = !q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [items, search, activeFilter]);

  const activeCount = items.filter((i) => i.status === "active").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("total_active", { active: activeCount, total: items.length })}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search")}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-ink-900 dark:text-ink-50 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTER_KEYS.map(({ value, labelKey }) => (
          <button
            key={value}
            onClick={() => setActiveFilter(value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeFilter === value
                ? "bg-brand-600 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-ink-600 dark:text-ink-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-ink-400 gap-2">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">{t("loading")}</span>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-ink-400 text-sm">{t("empty")}</div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((integration) => (
            <IntegrationCard
              key={integration.code}
              integration={integration}
              settingsUrl={settingsUrlFor(integration.code, integration.category)}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
