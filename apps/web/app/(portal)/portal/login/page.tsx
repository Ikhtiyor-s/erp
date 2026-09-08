"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Phone, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/i18n/locale-provider";
import { formatUzPhone, normalizeUzPhoneInput, toApiPhone } from "@/lib/phone";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setPortalAuth } from "../../portal-auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

export default function PortalLoginPage() {
  const t = useTranslations("portal");
  const { locale, setLocale } = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState(""); // 9 national digits
  const [orgCode, setOrgCode] = useState("ANIQ");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/customer-portal/auth/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: toApiPhone(phone), org_code: orgCode }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Xato");
      setStep("otp");
      if (data.dev_code) {
        setDevCode(data.dev_code);
        toast.info(`${t("dev_code_hint")}: ${data.dev_code}`, { duration: 8000 });
      } else {
        toast.success(t("otp_sent"));
      }
    } catch (e: any) {
      toast.error(e.message || "Xato");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/customer-portal/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: toApiPhone(phone), code, org_code: orgCode }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Kod noto'g'ri");
      setPortalAuth(data.access_token, data.customer, orgCode);
      toast.success(`Xush kelibsiz, ${data.customer.name}`);
      router.push("/portal/dashboard");
    } catch (e: any) {
      toast.error(e.message || "Xato");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-100 dark:bg-ink-950 relative px-4">
      <div className="absolute top-4 right-4">
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as any)}
          className="text-sm border border-ink-300 dark:border-ink-600 rounded-md px-2 py-1 bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200"
          aria-label="Language"
        >
          <option value="uz">UZ</option>
          <option value="ru">RU</option>
          <option value="en">EN</option>
          <option value="kaa">KAA</option>
        </select>
      </div>

      <Card className="w-full max-w-sm" padding="lg">
        <CardBody className="space-y-4">
          <div className="text-center mb-1">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 mb-3">
              <Sparkles size={24} />
            </div>
            <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">
              {t("login_title")}
            </h1>
          </div>

          {step === "phone" ? (
            <form onSubmit={requestOtp} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-ink-600 dark:text-ink-300 block mb-1">
                  {t("phone")}
                </label>
                <div className="flex items-stretch border border-ink-300 dark:border-ink-600 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-brand-500">
                  <span className="flex items-center px-3 bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300 text-sm font-medium">
                    +998
                  </span>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    placeholder={t("phone_placeholder")}
                    autoComplete="tel"
                    value={formatUzPhone(phone)}
                    onChange={(e) => setPhone(normalizeUzPhoneInput(e.target.value))}
                    className="flex-1 min-w-0 border-0 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-ink-600 dark:text-ink-300 block mb-1">
                  {t("org_code")}
                </label>
                <input
                  type="text"
                  required
                  placeholder="ANIQ"
                  value={orgCode}
                  onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800 rounded-md font-mono text-sm text-ink-900 dark:text-ink-100"
                />
                <p className="text-xs text-ink-400 mt-1">{t("org_code_hint")}</p>
              </div>
              <Button type="submit" fullWidth loading={loading}>
                {t("send_code")}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div className="text-sm text-ink-600 dark:text-ink-300 bg-ink-100 dark:bg-ink-900/40 p-3 rounded-md">
                <Phone size={14} className="inline mr-1" /> +998 {formatUzPhone(phone)}
              </div>
              {devCode && (
                <div className="text-xs bg-warn-50 dark:bg-warn-500/15 border border-warn-500/30 text-warn-700 dark:text-warn-500 p-2 rounded">
                  {t("dev_code_hint")}: <code className="font-mono font-bold">{devCode}</code>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-ink-600 dark:text-ink-300 block mb-1">
                  {t("otp_code")}
                </label>
                <div className="relative">
                  <ShieldCheck size={16} className="absolute left-3 top-2.5 text-ink-400" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={t("otp_placeholder")}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full pl-9 pr-3 py-2 border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800 rounded-md text-ink-900 dark:text-ink-100 font-mono text-lg tracking-widest"
                    autoFocus
                  />
                </div>
              </div>
              <Button type="submit" fullWidth loading={loading} disabled={code.length !== 6}>
                {t("verify_code")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                fullWidth
                onClick={() => { setStep("phone"); setCode(""); setDevCode(""); }}
              >
                ← {t("back")}
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
