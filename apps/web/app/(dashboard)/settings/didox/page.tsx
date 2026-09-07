"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Eye, EyeOff, Loader2, Wifi, WifiOff, Copy, CheckCircle2, Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, input } from "@/components/ui/modal";
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
        className={`${input} pr-9 disabled:bg-ink-50 disabled:text-ink-500`}
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
        className={`${input} pr-9 bg-ink-50 dark:bg-ink-900 text-ink-500 dark:text-ink-400`}
      />
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-300"
        tabIndex={-1}
        title="Copy"
      >
        {copied ? <CheckCircle2 size={15} className="text-success-600 dark:text-success-500" /> : <Copy size={15} />}
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
      <div className="w-9 h-5 bg-ink-200 dark:bg-ink-700 rounded-full peer peer-checked:bg-brand-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
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
        <Loader2 size={24} className="animate-spin text-ink-400" />
      </div>
    );
  }

  const hasCredentials = stir.length > 0 && token.length > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title={t("title")} description={t("description")} />

      {/* Section 1: Config Form */}
      <Card padding="none">
        <CardHeader
          title={t("section_config")}
          actions={configured && <Badge tone="success">{t("configured")}</Badge>}
        />

        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t("stir")} required>
              <input
                type="text"
                value={stir}
                onChange={(e) => {
                  setStir(e.target.value);
                  validateStir(e.target.value);
                }}
                maxLength={9}
                placeholder="123456789"
                className={input}
              />
              {stirError && (
                <p className="text-xs text-danger-500 mt-1">{stirError}</p>
              )}
            </Field>

            <Field label={t("signer_pin")}>
              <SecretInput
                value={signerPin}
                onChange={setSignerPin}
                placeholder="123456"
              />
            </Field>
          </div>

          <Field label={t("developer_token")} required>
            <SecretInput value={token} onChange={setToken} />
          </Field>

          <div className="flex items-center gap-3">
            <Toggle checked={sandbox} onChange={setSandbox} />
            <span className="text-sm text-ink-700 dark:text-ink-300">{t("sandbox")}</span>
          </div>

          {webhookUrl && (
            <Field label={t("webhook_url")} hint={t("webhook_hint")}>
              <CopyInput value={webhookUrl} />
            </Field>
          )}
        </CardBody>

        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} loading={saving}>
            {saving ? t("saving") : t("save")}
          </Button>
        </CardFooter>
      </Card>

      {/* Section 2: Test Connection */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-sm text-ink-800 dark:text-ink-100">{t("section_test")}</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{t("section_test_hint")}</div>
          </div>
          <div className="flex items-center gap-3">
            {testResult !== null && (
              testResult ? (
                <Badge tone="success">
                  <Wifi size={11} /> {t("test_success")}
                </Badge>
              ) : (
                <Badge tone="danger">
                  <WifiOff size={11} /> {t("test_failed")}
                </Badge>
              )
            )}
            <Button
              type="button"
              variant="outline"
              onClick={testConnection}
              loading={testing}
              disabled={testing || !hasCredentials}
            >
              {testing ? t("testing") : t("test_connection")}
            </Button>
          </div>
        </div>
      </Card>

      {/* Section 3: Enable / Disable */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-sm text-ink-800 dark:text-ink-100">
              {enabled ? t("disable") : t("enable")}
            </div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
              {enabled ? t("disable_hint") : t("enable_hint")}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {toggling && <Loader2 size={14} className="animate-spin text-ink-400" />}
            <Toggle checked={enabled} onChange={toggleEnabled} />
          </div>
        </div>
      </Card>

      {/* Section 4: Invoice History */}
      <Card>
        <div className="font-semibold text-sm text-ink-800 dark:text-ink-100 mb-3">{t("invoices_history")}</div>
        <div className="flex items-center gap-2 text-sm text-ink-400 py-6 justify-center">
          <Info size={16} />
          {t("invoices_empty")}
        </div>
      </Card>

      {/* Section 5: Sale Integration Info */}
      <div className="bg-info-50 dark:bg-info-500/15 border border-info-500/20 rounded-xl px-5 py-4 flex gap-3">
        <Info size={16} className="text-info-600 dark:text-info-500 mt-0.5 shrink-0" />
        <p className="text-sm text-info-700 dark:text-info-500">{t("sale_integration_info")}</p>
      </div>
    </div>
  );
}
