"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Package, Wifi, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
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
        className="w-full border border-slate-200 rounded-md px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
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
          {lastTestOk !== null && (
            <StatusBadge status={lastTestOk} okLabel={t("test_success")} failLabel={t("test_failed")} />
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium" onClick={(e) => e.stopPropagation()}>
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
                        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    )}
                  </div>
                ))}
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sandbox}
                  onChange={(e) => setSandbox(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                {t("sandbox")}
              </label>

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
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
      <h2 className="text-sm font-semibold text-slate-800 mb-3">{t("shipments_history")}</h2>

      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </div>
      )}

      {!loading && (error || shipments.length === 0) && (
        <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
          <Package size={32} className="opacity-40" />
          <p className="text-sm">{t("shipments_empty")}</p>
        </div>
      )}

      {!loading && !error && shipments.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 text-left">
                  <th className="pb-2 font-medium">{t("tracking_id")}</th>
                  <th className="pb-2 font-medium">{t("provider")}</th>
                  <th className="pb-2 font-medium">{t("from_address")}</th>
                  <th className="pb-2 font-medium">{t("to_address")}</th>
                  <th className="pb-2 font-medium">{t("status")}</th>
                  <th className="pb-2 font-medium">{t("created_at")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {shipments.map((s) => (
                  <tr key={s.tracking_id} className="text-slate-700">
                    <td className="py-2 font-mono text-xs">{s.tracking_id}</td>
                    <td className="py-2">{s.provider}</td>
                    <td className="py-2 text-xs">{s.from_address}</td>
                    <td className="py-2 text-xs">{s.to_address}</td>
                    <td className="py-2">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-slate-500">{s.created_at?.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-2">
            {shipments.map((s) => (
              <li key={s.tracking_id} className="border border-slate-100 rounded-md p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-700">{s.tracking_id}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{s.status}</span>
                </div>
                <div className="text-xs text-slate-500">{s.provider}</div>
                <div className="text-xs text-slate-600">{s.from_address} → {s.to_address}</div>
                <div className="text-xs text-slate-400">{s.created_at?.slice(0, 10)}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
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
