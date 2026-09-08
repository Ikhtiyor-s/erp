"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { register, requestRegisterOtp, verifyRegisterOtp } from "@/lib/auth";
import { getErrorMessage } from "@/lib/api-error";
import { formatUzPhone, isValidUzPhone, normalizeUzPhoneInput, toApiPhone } from "@/lib/phone";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Step = "details" | "otp" | "password";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const [step, setStep] = useState<Step>("details");
  const [loading, setLoading] = useState(false);

  const [organizationName, setOrganizationName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState(""); // 9 national digits

  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [ticket, setTicket] = useState("");

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  async function onRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidUzPhone(phone)) {
      toast.error(t("phone_invalid"));
      return;
    }
    setLoading(true);
    try {
      const res = await requestRegisterOtp(toApiPhone(phone));
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
      const res = await verifyRegisterOtp(toApiPhone(phone), code);
      setTicket(res.ticket);
      setStep("password");
    } catch (err) {
      toast.error(getErrorMessage(err, t("otp_invalid_or_expired")));
    } finally {
      setLoading(false);
    }
  }

  async function onFinish(e: React.FormEvent) {
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
        phone: toApiPhone(phone),
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
    <div className="min-h-screen flex items-center justify-center bg-ink-100 dark:bg-ink-950 px-4">
      <Card className="w-full max-w-sm" padding="lg">
        <CardBody className="space-y-4">
          <h1 className="text-2xl font-bold text-center mb-1 text-ink-900 dark:text-ink-50">
            {t("register")}
          </h1>

          {step === "details" && (
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
                  value={formatUzPhone(phone)}
                  onChange={(e) => setPhone(normalizeUzPhoneInput(e.target.value))}
                  className="flex-1 min-w-0 border-0 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 px-3 py-2 focus:outline-none"
                />
              </div>
              <Button type="submit" fullWidth loading={loading}>
                {t("send_code")}
              </Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={onVerifyOtp} className="space-y-4">
              <p className="text-sm text-ink-600 dark:text-ink-400 text-center">
                {t("otp_sent_to")} <span className="font-medium text-ink-900 dark:text-ink-100">+998 {formatUzPhone(phone)}</span>
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

          {step === "password" && (
            <form onSubmit={onFinish} className="space-y-4">
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

          <p className="text-center text-sm text-ink-600 dark:text-ink-400">
            {t("have_account")}{" "}
            <Link className="text-brand-600 dark:text-brand-400" href="/login">
              {t("login")}
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
