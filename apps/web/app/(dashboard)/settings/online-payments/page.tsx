"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Wifi, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";
import type { IntegrationConfig, TestResult } from "@/lib/types/integrations";

type ProviderCode = "click" | "payme" | "alif" | "uzum" | "multicard" | "rahmat";

interface FieldSpec {
  key: string;
  labelKey: string;
  secret?: boolean;
  readOnly?: boolean;
  type?: "text" | "number" | "checkbox";
}

interface ProviderSpec {
  code: ProviderCode;
  labelKey: string;
  fields: FieldSpec[];
  sandboxField?: string;
}

const PROVIDERS: ProviderSpec[] = [
  {
    code: "click",
    labelKey: "click",
    fields: [
      { key: "merchant_id", labelKey: "merchant_id" },
      { key: "secret_key", labelKey: "secret_key", secret: true },
    ],
  },
  {
    code: "payme",
    labelKey: "payme",
    fields: [
      { key: "merchant_id", labelKey: "merchant_id" },
      { key: "secret_key", labelKey: "secret_key", secret: true },
    ],
  },
  {
    code: "alif",
    labelKey: "alif",
    sandboxField: "sandbox",
    fields: [
      { key: "merchant_id", labelKey: "merchant_id" },
      { key: "api_key", labelKey: "api_key", secret: true },
      { key: "webhook_url", labelKey: "webhook_url", readOnly: true },
    ],
  },
  {
    code: "uzum",
    labelKey: "uzum",
    sandboxField: "sandbox",
    fields: [
      { key: "client_id", labelKey: "client_id" },
      { key: "client_secret", labelKey: "client_secret", secret: true },
      { key: "callback_url", labelKey: "callback_url" },
    ],
  },
  {
    code: "multicard",
    labelKey: "multicard",
    sandboxField: "sandbox",
    fields: [
      { key: "api_key", labelKey: "api_key", secret: true },
      { key: "terminal_id", labelKey: "terminal_id" },
      { key: "store_id", labelKey: "store_id" },
    ],
  },
  {
    code: "rahmat",
    labelKey: "rahmat",
    fields: [
      { key: "merchant_token", labelKey: "merchant_token", secret: true },
      { key: "secret", labelKey: "secret", secret: true },
      { key: "cashback_rate", labelKey: "cashback_rate", type: "number" },
    ],
  },
];

function SecretInput({
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative flex items-center">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder || "***"}
        className={cn(
          input,
          "pr-9",
          readOnly && "bg-ink-50 dark:bg-ink-900 text-ink-500 dark:text-ink-400"
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"
        tabIndex={-1}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function StatusBadge({ status, okLabel, failLabel }: { status: boolean | null; okLabel: string; failLabel: string }) {
  if (status === null) return null;
  return (
    <Badge tone={status ? "success" : "danger"}>
      {status ? <Wifi size={11} /> : <WifiOff size={11} />}
      {status ? okLabel : failLabel}
    </Badge>
  );
}

function ProviderCard({ spec }: { spec: ProviderSpec }) {
  const t = useTranslations("integrations.payments");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [sandbox, setSandbox] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [lastTestOk, setLastTestOk] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<IntegrationConfig>(`/integrations/${spec.code}`);
      setEnabled(r.data.enabled);
      setConfigured(r.data.configured);
      const cfg = r.data.config ?? {};
      setConfig(cfg);
      setSandbox(cfg.sandbox === "true");
    } catch {
    } finally {
      setLoading(false);
    }
  }, [spec.code]);

  useEffect(() => {
    if (open) load();
    // load is stable (memoized on spec.code), intentionally omitted from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function toggleEnabled(next: boolean) {
    const endpoint = next ? "enable" : "disable";
    try {
      await api.post(`/integrations/${spec.code}/${endpoint}`, {});
      setEnabled(next);
      toast.success(next ? t("enabled_ok") : t("disabled_ok"));
    } catch (e) {
      toast.error(getErrorMessage(e, t("toggle_error")));
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, string> = { ...config };
      if (spec.sandboxField) payload.sandbox = sandbox ? "true" : "false";
      await api.put(`/integrations/${spec.code}`, payload);
      toast.success(t("saved"));
      setConfigured(true);
    } catch (e) {
      toast.error(getErrorMessage(e, t("save_error")));
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const r = await api.post<TestResult>(`/integrations/${spec.code}/test`, {});
      if (r.data.ok) {
        toast.success(r.data.message || t("test_success"));
        setLastTestOk(true);
      } else {
        toast.error(r.data.message || t("test_failed"));
        setLastTestOk(false);
      }
    } catch (e) {
      toast.error(getErrorMessage(e, t("test_failed")));
      setLastTestOk(false);
    } finally {
      setTesting(false);
    }
  }

  const hasCredentials = spec.fields
    .filter((f) => !f.readOnly && f.key !== "webhook_url")
    .some((f) => config[f.key] && config[f.key].length > 0);

  return (
    <Card padding="none">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-900/40 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-ink-800 dark:text-ink-100">{t(spec.labelKey)}</span>
          {configured && <Badge tone="neutral">{t("configured")}</Badge>}
          {lastTestOk !== null && <StatusBadge status={lastTestOk} okLabel={t("test_success")} failLabel={t("test_failed")} />}
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => toggleEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-ink-200 dark:bg-ink-700 rounded-full peer peer-checked:bg-brand-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </span>
          {open ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-ink-200/60 dark:border-ink-800/60 px-4 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={20} className="animate-spin text-ink-400" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {spec.fields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-ink-600 dark:text-ink-400 mb-1">
                      {t(f.labelKey)}
                    </label>
                    {f.secret || f.readOnly ? (
                      <SecretInput
                        value={config[f.key] ?? ""}
                        onChange={(v) => setConfig({ ...config, [f.key]: v })}
                        readOnly={f.readOnly}
                      />
                    ) : f.type === "number" ? (
                      <input
                        type="number"
                        value={config[f.key] ?? ""}
                        onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                        className={input}
                        min={0}
                        max={100}
                        step={0.1}
                      />
                    ) : (
                      <input
                        type="text"
                        value={config[f.key] ?? ""}
                        onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                        className={input}
                      />
                    )}
                  </div>
                ))}
              </div>

              {spec.sandboxField && (
                <label className="inline-flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sandbox}
                    onChange={(e) => setSandbox(e.target.checked)}
                    className="rounded border-ink-300 dark:border-ink-700 text-brand-600 focus:ring-brand-500"
                  />
                  {t("sandbox_mode")}
                </label>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink-200/60 dark:border-ink-800/60">
                <Button type="button" size="sm" onClick={save} loading={saving}>
                  {saving ? t("saving") : t("save")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={testConnection}
                  loading={testing}
                  disabled={!hasCredentials}
                >
                  {testing ? t("testing") : t("test_connection")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

const BILL_SERVICES = [
  { code: "electric", labelKey: "service_electric" },
  { code: "gas", labelKey: "service_gas" },
  { code: "water", labelKey: "service_water" },
  { code: "internet", labelKey: "service_internet" },
];

function BillPaymentCard() {
  const t = useTranslations("integrations.payments");
  const [open, setOpen] = useState(false);
  const [service, setService] = useState("");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [generating, setGenerating] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function generateLink() {
    if (!service || !account || !amount) {
      toast.error(t("fill_all_fields"));
      return;
    }
    setGenerating(true);
    setLink(null);
    try {
      const r = await api.post("/integration/bill-payment/generate-link", {
        service_code: service,
        account_number: account,
        amount: parseFloat(amount),
      });
      setLink(r.data.link ?? r.data.url ?? JSON.stringify(r.data));
      toast.success(t("link_generated"));
    } catch (e) {
      toast.error(getErrorMessage(e, t("link_error")));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card padding="none">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-ink-50 dark:hover:bg-ink-900/40 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-semibold text-sm text-ink-800 dark:text-ink-100">{t("bill_payment")}</span>
        {open ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
      </button>

      {open && (
        <div className="border-t border-ink-200/60 dark:border-ink-800/60 px-4 py-4 space-y-4">
          <p className="text-xs text-ink-500 dark:text-ink-400">{t("bill_payment_desc")}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-600 dark:text-ink-400 mb-1">{t("bill_service")}</label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className={input}
              >
                <option value="">— {t("select_service")} —</option>
                {BILL_SERVICES.map((s) => (
                  <option key={s.code} value={s.code}>{t(s.labelKey)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 dark:text-ink-400 mb-1">{t("account_number")}</label>
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="12345678"
                className={input}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 dark:text-ink-400 mb-1">{t("amount")}</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000"
                min={0}
                className={input}
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={generateLink}
            loading={generating}
            disabled={!service || !account || !amount}
          >
            {t("generate_link")}
          </Button>

          {link && (
            <div className="bg-ink-50 dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-md p-3 break-all text-xs text-ink-700 dark:text-ink-300 select-all">
              {link}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function Page() {
  const t = useTranslations("integrations.payments");

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader
        title={t("page_title")}
        description={t("page_description")}
      />

      <div className="space-y-3">
        {PROVIDERS.map((spec) => (
          <ProviderCard key={spec.code} spec={spec} />
        ))}
        <BillPaymentCard />
      </div>
    </div>
  );
}
