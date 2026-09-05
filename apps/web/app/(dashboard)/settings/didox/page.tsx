"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Eye, EyeOff, Loader2, Wifi, WifiOff, Copy, CheckCircle2, Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { useTranslations } from "next-intl";
import type { IntegrationConfig, TestResult } from "@/lib/types/integrations";

const INTEGRATION_CODE = "didox";

function SecretInput({
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative flex items-center">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder ?? "***"}
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

function CopyInput({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative flex items-center">
      <input
        type="text"
        value={value}
        readOnly
        className="w-full border border-slate-200 rounded-md px-3 py-2 pr-9 text-sm bg-slate-50 text-slate-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 text-slate-400 hover:text-slate-600"
        tabIndex={-1}
        title="Copy"
      >
        {copied ? <CheckCircle2 size={15} className="text-emerald-600" /> : <Copy size={15} />}
      </button>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-brand-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
    </label>
  );
}

export default function DidoxSettingsPage() {
  const t = useTranslations("integrations.didox");

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const [stir, setStir] = useState("");
  const [token, setToken] = useState("");
  const [signerPin, setSignerPin] = useState("");
  const [sandbox, setSandbox] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  const [stirError, setStirError] = useState("");

  const load = useCallback(async () => {
    setPageLoading(true);
    try {
      const r = await api.get<IntegrationConfig>(`/integrations/${INTEGRATION_CODE}`);
      setEnabled(r.data.enabled);
      setConfigured(r.data.configured);
      const cfg = r.data.config ?? {};
      setStir(cfg.stir ?? "");
      setToken(cfg.token ?? "");
      setSignerPin(cfg.signer_pin ?? "");
      setSandbox(cfg.sandbox === "true");
      setWebhookUrl(cfg.webhook_url ?? "");
    } catch {
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function validateStir(value: string) {
    if (value && !/^\d{9}$/.test(value)) {
      setStirError(t("stir_hint"));
    } else {
      setStirError("");
    }
  }

  async function save() {
    if (stir && !/^\d{9}$/.test(stir)) {
      setStirError(t("stir_hint"));
      return;
    }
    setSaving(true);
    try {
      await api.put(`/integrations/${INTEGRATION_CODE}`, {
        stir,
        token,
        signer_pin: signerPin,
        sandbox: sandbox ? "true" : "false",
      });
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
    setTestResult(null);
    try {
      const r = await api.post<TestResult>(`/integrations/${INTEGRATION_CODE}/test`, {});
      if (r.data.ok) {
        toast.success(r.data.message || t("test_success"));
        setTestResult(true);
      } else {
        toast.error(r.data.message || t("test_failed"));
        setTestResult(false);
      }
    } catch (e) {
      toast.error(getErrorMessage(e, t("test_failed")));
      setTestResult(false);
    } finally {
      setTesting(false);
    }
  }

  async function toggleEnabled(next: boolean) {
    setToggling(true);
    const endpoint = next ? "enable" : "disable";
    try {
      await api.post(`/integrations/${INTEGRATION_CODE}/${endpoint}`, {});
      setEnabled(next);
      toast.success(next ? t("enabled_ok") : t("disabled_ok"));
    } catch (e) {
      toast.error(getErrorMessage(e, t("toggle_error")));
    } finally {
      setToggling(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  const hasCredentials = stir.length > 0 && token.length > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title={t("title")} description={t("description")} />

      {/* Section 1: Config Form */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 rounded-lg shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-slate-800">{t("section_config")}</span>
            {configured && (
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5">
                {t("configured")}
              </span>
            )}
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {t("stir")} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={stir}
                onChange={(e) => {
                  setStir(e.target.value);
                  validateStir(e.target.value);
                }}
                maxLength={9}
                placeholder="123456789"
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {stirError && (
                <p className="text-xs text-rose-500 mt-1">{stirError}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {t("signer_pin")}
              </label>
              <SecretInput
                value={signerPin}
                onChange={setSignerPin}
                placeholder="123456"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t("developer_token")} <span className="text-rose-500">*</span>
            </label>
            <SecretInput value={token} onChange={setToken} />
          </div>

          <div className="flex items-center gap-3">
            <Toggle checked={sandbox} onChange={setSandbox} />
            <span className="text-sm text-slate-700">{t("sandbox")}</span>
          </div>

          {webhookUrl && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {t("webhook_url")}
              </label>
              <CopyInput value={webhookUrl} />
              <p className="text-xs text-slate-400 mt-1">{t("webhook_hint")}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: Test Connection */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 rounded-lg shadow-sm px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-sm text-slate-800">{t("section_test")}</div>
            <div className="text-xs text-slate-500 mt-0.5">{t("section_test_hint")}</div>
          </div>
          <div className="flex items-center gap-3">
            {testResult !== null && (
              testResult ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                  <Wifi size={11} /> {t("test_success")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2.5 py-0.5">
                  <WifiOff size={11} /> {t("test_failed")}
                </span>
              )
            )}
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
        </div>
      </div>

      {/* Section 3: Enable / Disable */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 rounded-lg shadow-sm px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-sm text-slate-800">
              {enabled ? t("disable") : t("enable")}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {enabled ? t("disable_hint") : t("enable_hint")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {toggling && <Loader2 size={14} className="animate-spin text-slate-400" />}
            <Toggle checked={enabled} onChange={toggleEnabled} />
          </div>
        </div>
      </div>

      {/* Section 4: Invoice History */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 rounded-lg shadow-sm px-5 py-4">
        <div className="font-semibold text-sm text-slate-800 mb-3">{t("invoices_history")}</div>
        <div className="flex items-center gap-2 text-sm text-slate-400 py-6 justify-center">
          <Info size={16} />
          {t("invoices_empty")}
        </div>
      </div>

      {/* Section 5: Sale Integration Info */}
      <div className="bg-brand-50 border border-brand-100 rounded-lg px-5 py-4 flex gap-3">
        <Info size={16} className="text-brand-600 mt-0.5 shrink-0" />
        <p className="text-sm text-brand-800">{t("sale_integration_info")}</p>
      </div>
    </div>
  );
}
