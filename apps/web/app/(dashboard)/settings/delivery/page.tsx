"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Package, Wifi, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";
import type { IntegrationConfig, TestResult } from "@/lib/types/integrations";

type DeliveryProvider = "yandex_delivery" | "bts_delivery";

interface FieldSpec {
  key: string;
  labelKey: string;
  secret?: boolean;
}

interface ProviderSpec {
  code: DeliveryProvider;
  apiCode: string;
  labelKey: string;
  fields: FieldSpec[];
}

const PROVIDERS: ProviderSpec[] = [
  {
    code: "yandex_delivery",
    apiCode: "yandex",
    labelKey: "yandex",
    fields: [
      { key: "oauth_token", labelKey: "oauth_token", secret: true },
      { key: "sender_id", labelKey: "sender_id" },
      { key: "warehouse_id", labelKey: "warehouse_id" },
    ],
  },
  {
    code: "bts_delivery",
    apiCode: "bts",
    labelKey: "bts",
    fields: [
      { key: "api_key", labelKey: "api_key", secret: true },
      { key: "account_id", labelKey: "account_id" },
    ],
  },
];

type Shipment = {
  tracking_id: string;
  provider: string;
  from_address: string;
  to_address: string;
  status: string;
  created_at: string;
};

function SecretInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative flex items-center">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="***"
        className={`${input} pr-9`}
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

function ProviderCard({ spec }: { spec: ProviderSpec }) {
  const t = useTranslations("integrations.delivery");
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
      const r = await api.get<IntegrationConfig>(`/integrations/delivery/${spec.apiCode}`);
      setEnabled(r.data.enabled);
      setConfigured(r.data.configured);
      const cfg = r.data.config ?? {};
      setConfig(cfg);
      setSandbox(cfg.sandbox === "true");
    } catch {
    } finally {
      setLoading(false);
    }
  }, [spec.apiCode]);

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function toggleEnabled(next: boolean) {
    const endpoint = next ? "enable" : "disable";
    try {
      await api.post(`/integrations/delivery/${spec.apiCode}/${endpoint}`, {});
      setEnabled(next);
      toast.success(next ? t("enabled_ok") : t("disabled_ok"));
    } catch (e) {
      toast.error(getErrorMessage(e, t("toggle_error")));
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, string> = { ...config, sandbox: sandbox ? "true" : "false" };
      await api.put(`/integrations/delivery/${spec.apiCode}`, payload);
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
      const r = await api.post<TestResult>(`/integrations/delivery/${spec.apiCode}/test`, {});
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
    .filter((f) => f.secret)
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
          {lastTestOk !== null && (
            lastTestOk ? (
              <Badge tone="success">
                <Wifi size={11} /> {t("test_success")}
              </Badge>
            ) : (
              <Badge tone="danger">
                <WifiOff size={11} /> {t("test_failed")}
              </Badge>
            )
          )}
        </div>
        <div className="flex items-center gap-3">
          <span onClick={(e) => e.stopPropagation()}>
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
                  <Field key={f.key} label={t(f.labelKey)}>
                    {f.secret ? (
                      <SecretInput
                        value={config[f.key] ?? ""}
                        onChange={(v) => setConfig({ ...config, [f.key]: v })}
                      />
                    ) : (
                      <input
                        type="text"
                        value={config[f.key] ?? ""}
                        onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                        className={input}
                      />
                    )}
                  </Field>
                ))}
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sandbox}
                  onChange={(e) => setSandbox(e.target.checked)}
                  className="rounded border-ink-300 dark:border-ink-700 text-brand-600 focus:ring-brand-500"
                />
                {t("sandbox")}
              </label>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-ink-200/60 dark:border-ink-800/60">
                <Button type="button" onClick={save} loading={saving}>
                  {saving ? t("saving") : t("save")}
                </Button>
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
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function ShipmentsSection() {
  const t = useTranslations("integrations.delivery");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get<Shipment[]>("/integrations/delivery/shipments")
      .then((r) => setShipments(r.data ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-100 mb-3">{t("shipments_history")}</h2>

      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-ink-400" />
        </div>
      )}

      {!loading && (error || shipments.length === 0) && (
        <div className="flex flex-col items-center gap-2 py-8 text-ink-400">
          <Package size={32} className="opacity-40" />
          <p className="text-sm">{t("shipments_empty")}</p>
        </div>
      )}

      {!loading && !error && shipments.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200/60 dark:border-ink-800/60 text-xs text-ink-500 dark:text-ink-400 text-left">
                  <th className="pb-2 font-medium">{t("tracking_id")}</th>
                  <th className="pb-2 font-medium">{t("provider")}</th>
                  <th className="pb-2 font-medium">{t("from_address")}</th>
                  <th className="pb-2 font-medium">{t("to_address")}</th>
                  <th className="pb-2 font-medium">{t("status")}</th>
                  <th className="pb-2 font-medium">{t("created_at")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-ink-800/40">
                {shipments.map((s) => (
                  <tr key={s.tracking_id} className="text-ink-700 dark:text-ink-300">
                    <td className="py-2 font-mono text-xs">{s.tracking_id}</td>
                    <td className="py-2">{s.provider}</td>
                    <td className="py-2 text-xs">{s.from_address}</td>
                    <td className="py-2 text-xs">{s.to_address}</td>
                    <td className="py-2">
                      <Badge tone="neutral">{s.status}</Badge>
                    </td>
                    <td className="py-2 text-xs text-ink-500 dark:text-ink-400">{s.created_at?.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-2">
            {shipments.map((s) => (
              <li key={s.tracking_id} className="border border-ink-200/60 dark:border-ink-800/60 rounded-md p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-ink-700 dark:text-ink-300">{s.tracking_id}</span>
                  <Badge tone="neutral">{s.status}</Badge>
                </div>
                <div className="text-xs text-ink-500 dark:text-ink-400">{s.provider}</div>
                <div className="text-xs text-ink-600 dark:text-ink-300">{s.from_address} → {s.to_address}</div>
                <div className="text-xs text-ink-400">{s.created_at?.slice(0, 10)}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export default function DeliverySettingsPage() {
  const t = useTranslations("integrations.delivery");

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="space-y-3">
        {PROVIDERS.map((spec) => (
          <ProviderCard key={spec.code} spec={spec} />
        ))}
      </div>

      <ShipmentsSection />
    </div>
  );
}
