"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { login } from "@/lib/auth";
import { getErrorMessage } from "@/lib/api-error";
import { formatUzPhone, normalizeUzPhoneInput, toApiPhone } from "@/lib/phone";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function LoginPage() {
  const t = useTranslations("auth");
  const { setLocale, locale } = useLocale();
  const { setTheme, resolvedTheme } = useTheme();

  const [phone, setPhone] = useState(""); // 9 national digits
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(toApiPhone(phone), password);
      toast.success(t("welcome"));
      window.location.href = "/dashboard";
    } catch (err) {
      toast.error(getErrorMessage(err, t("wrong_credentials")));
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
          <h1 className="text-2xl font-bold text-center mb-1 text-ink-900 dark:text-ink-50">
            {t("login")}
          </h1>

          <form onSubmit={onSubmit} className="space-y-4">
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
                value={formatUzPhone(phone)}
                onChange={(e) => setPhone(normalizeUzPhoneInput(e.target.value))}
                className="flex-1 min-w-0 border-0 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 px-3 py-2 focus:outline-none"
              />
            </div>
            <input
              type="password"
              required
              placeholder={t("password")}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 rounded-md px-3 py-2"
            />
            <Button type="submit" fullWidth loading={loading}>
              {t("login")}
            </Button>
          </form>

          <p className="text-center text-sm text-ink-600 dark:text-ink-400">
            {t("no_account")}{" "}
            <Link className="text-brand-600 dark:text-brand-400" href="/register">
              {t("register")}
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
