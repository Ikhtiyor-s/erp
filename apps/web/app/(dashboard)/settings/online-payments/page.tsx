"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Wifi, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
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
        className="w-full border border-slate-200 rounded-md px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white disabled:bg-slate-50 disabled:text-slate-500"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 text-slate-400 hover:text-slate-600"
        tabIndex={-1}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function StatusBadge({ status, okLabel, failLabel }: { status: boolean | null; okLabel: string; failLabel: string }) {
  if (status === null) return null;
  return status ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
      <Wifi size={11} />
      {okLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
      <WifiOff size={11} />
      {failLabel}
    </span>
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
    <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-slate-800">{t(spec.labelKey)}</span>
          {configured && (
            <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
              {t("configured")}
            </span>
          )}
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
              <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-brand-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
            </label>
          </span>
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {spec.fields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
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
                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        min={0}
                        max={100}
                        step={0.1}
                      />
                    ) : (
                      <input
                        type="text"
                        value={config[f.key] ?? ""}
                        onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    )}
                  </div>
                ))}
              </div>

              {spec.sandboxField && (
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sandbox}
                    onChange={(e) => setSandbox(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  {t("sandbox_mode")}
                </label>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {saving ? t("saving") : t("save")}
                </button>
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={testing || !hasCredentials}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {testing && <Loader2 size={13} className="animate-spin" />}
                  {testing ? t("testing") : t("test_connection")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
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
    <div className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-semibold text-sm text-slate-800">{t("bill_payment")}</span>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4">
          <p className="text-xs text-slate-500">{t("bill_payment_desc")}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("bill_service")}</label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">— {t("select_service")} —</option>
                {BILL_SERVICES.map((s) => (
                  <option key={s.code} value={s.code}>{t(s.labelKey)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("account_number")}</label>
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="12345678"
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("amount")}</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000"
                min={0}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={generateLink}
            disabled={generating || !service || !account || !amount}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {generating && <Loader2 size={13} className="animate-spin" />}
            {t("generate_link")}
          </button>

          {link && (
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 break-all text-xs text-slate-700 select-all">
              {link}
            </div>
          )}
        </div>
      )}
    </div>
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
