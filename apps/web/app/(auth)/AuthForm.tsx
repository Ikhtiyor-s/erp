"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { login, register, requestRegisterOtp, verifyRegisterOtp } from "@/lib/auth";
import { getErrorMessage } from "@/lib/api-error";
import { formatUzPhone, isValidUzPhone, normalizeUzPhoneInput, toApiPhone } from "@/lib/phone";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Mode = "login" | "register";
type RegisterStep = "details" | "otp" | "password";

export function AuthForm({ initialMode }: { initialMode: Mode }) {
  const t = useTranslations("auth");
  const { setLocale, locale } = useLocale();
  const { setTheme, resolvedTheme } = useTheme();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [loading, setLoading] = useState(false);

  // Login
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register
  const [step, setStep] = useState<RegisterStep>("details");
  const [organizationName, setOrganizationName] = useState("");
  const [fullName, setFullName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [ticket, setTicket] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  function switchMode(next: Mode) {
    setMode(next);
    setStep("details");
  }

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(toApiPhone(loginPhone), loginPassword);
      toast.success(t("welcome"));
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(getErrorMessage(err, t("wrong_credentials")));
    } finally {
      setLoading(false);
    }
  }

  async function onRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidUzPhone(regPhone)) {
      toast.error(t("phone_invalid"));
      return;
    }
    setLoading(true);
    try {
      const res = await requestRegisterOtp(toApiPhone(regPhone));
      setDevCode(res.dev_code ?? null);
      toast.success(t("otp_sent"));
      setStep("otp");
    } catch (err) {
      toast.error(getErrorMessage(err, t("register_failed")));
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await verifyRegisterOtp(toApiPhone(regPhone), code);
      setTicket(res.ticket);
      setStep("password");
    } catch (err) {
      toast.error(getErrorMessage(err, t("otp_invalid_or_expired")));
    } finally {
      setLoading(false);
    }
  }

  async function onFinishRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t("password_too_short"));
      return;
    }
    if (password !== password2) {
      toast.error(t("passwords_mismatch"));
      return;
    }
    setLoading(true);
    try {
      await register({
        ticket,
        phone: toApiPhone(regPhone),
        password,
        full_name: fullName,
        organization_name: organizationName,
      });
      toast.success(t("welcome"));
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(getErrorMessage(err, t("register_failed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-100 dark:bg-ink-950 relative px-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as any)}
          className="text-sm border border-ink-300 dark:border-ink-600 rounded-md px-2 py-1 bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200"
        >
          <option value="uz">UZ</option>
          <option value="ru">RU</option>
          <option value="en">EN</option>
          <option value="kaa">KAA</option>
        </select>
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="p-2 rounded-md hover:bg-ink-200 dark:hover:bg-ink-700 text-ink-600 dark:text-ink-300"
          title="Theme"
        >
          {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <Card className="w-full max-w-sm" padding="lg">
        <CardBody className="space-y-4">
          {/* Mode switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-ink-100 dark:bg-ink-800 rounded-md">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`py-1.5 rounded text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-50 shadow-sm"
                  : "text-ink-500 dark:text-ink-400"
              }`}
            >
              {t("login")}
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`py-1.5 rounded text-sm font-medium transition-colors ${
                mode === "register"
                  ? "bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-50 shadow-sm"
                  : "text-ink-500 dark:text-ink-400"
              }`}
            >
              {t("register")}
            </button>
          </div>

          {mode === "login" && (
            <form onSubmit={onLogin} className="space-y-4">
              <div className="flex items-stretch border border-ink-300 dark:border-ink-600 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-brand-500">
                <span className="flex items-center px-3 bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300 text-sm font-medium">
                  +998
                </span>
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  placeholder={t("phone_placeholder")}
                  autoComplete="username"
                  value={formatUzPhone(loginPhone)}
                  onChange={(e) => setLoginPhone(normalizeUzPhoneInput(e.target.value))}
                  className="flex-1 min-w-0 border-0 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 px-3 py-2 focus:outline-none"
                />
              </div>
              <input
                type="password"
                required
                placeholder={t("password")}
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 rounded-md px-3 py-2"
              />
              <Button type="submit" fullWidth loading={loading}>
                {t("login")}
              </Button>
            </form>
          )}

          {mode === "register" && step === "details" && (
            <form onSubmit={onRequestOtp} className="space-y-4">
              <input
                required
                placeholder={t("organization_name")}
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="w-full border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 rounded-md px-3 py-2"
              />
              <input
                required
                placeholder={t("full_name")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 rounded-md px-3 py-2"
              />
              <div className="flex items-stretch border border-ink-300 dark:border-ink-600 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-brand-500">
                <span className="flex items-center px-3 bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300 text-sm font-medium">
                  +998
                </span>
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  placeholder={t("phone_placeholder")}
                  value={formatUzPhone(regPhone)}
                  onChange={(e) => setRegPhone(normalizeUzPhoneInput(e.target.value))}
                  className="flex-1 min-w-0 border-0 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 px-3 py-2 focus:outline-none"
                />
              </div>
              <Button type="submit" fullWidth loading={loading}>
                {t("send_code")}
              </Button>
            </form>
          )}

          {mode === "register" && step === "otp" && (
            <form onSubmit={onVerifyOtp} className="space-y-4">
              <p className="text-sm text-ink-600 dark:text-ink-400 text-center">
                {t("otp_sent_to")} <span className="font-medium text-ink-900 dark:text-ink-100">+998 {formatUzPhone(regPhone)}</span>
              </p>
              {devCode && (
                <div className="bg-warn-50 dark:bg-warn-500/15 border border-warn-500/30 text-warn-700 dark:text-warn-500 rounded-md p-2.5 text-xs text-center">
                  {t("dev_code_hint")}: <span className="font-mono font-semibold">{devCode}</span>
                </div>
              )}
              <input
                required
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder={t("otp_placeholder")}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 rounded-md px-3 py-2 text-center text-lg tracking-widest font-mono"
              />
              <Button type="submit" fullWidth loading={loading}>
                {t("verify_code")}
              </Button>
              <Button type="button" variant="ghost" fullWidth onClick={() => setStep("details")}>
                {t("back")}
              </Button>
            </form>
          )}

          {mode === "register" && step === "password" && (
            <form onSubmit={onFinishRegister} className="space-y-4">
              <input
                required
                type="password"
                placeholder={t("password")}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 rounded-md px-3 py-2"
              />
              <input
                required
                type="password"
                placeholder={t("password_confirm")}
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="w-full border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 rounded-md px-3 py-2"
              />
              <Button type="submit" fullWidth loading={loading}>
                {t("register")}
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
