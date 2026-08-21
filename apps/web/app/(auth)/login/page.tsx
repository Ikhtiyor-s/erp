"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Moon, Sun, Languages } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { login } from "@/lib/auth";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const { setLocale, locale } = useLocale();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success(t("welcome"));
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t("wrong_credentials"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 relative">
      {/* Top-right controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as any)}
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
        >
          <option value="uz">UZ</option>
          <option value="ru">RU</option>
          <option value="en">EN</option>
        </select>
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          title="Theme"
        >
          {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-8 w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-center mb-2 text-slate-900 dark:text-slate-100">
          {t("login")}
        </h1>

        <div className="bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 rounded-md p-3 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-semibold text-brand-700 dark:text-brand-300">
              Demo / Test
            </span>
            <button
              type="button"
              onClick={() => {
                setEmail("qa@example.com");
                setPassword("Qa12345!");
              }}
              className="px-2 py-0.5 rounded bg-brand-600 text-white text-[10px] hover:bg-brand-700"
            >
              Auto-fill
            </button>
          </div>
          <div className="font-mono text-slate-700 dark:text-slate-300 leading-5">
            <div><span className="text-slate-500">email:</span> qa@example.com</div>
            <div><span className="text-slate-500">parol:</span> Qa12345!</div>
          </div>
        </div>

        <input
          type="email"
          required
          placeholder="email@example.com"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2"
        />
        <input
          type="password"
          required
          placeholder={t("password")}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-md font-medium disabled:opacity-60"
        >
          {loading ? "..." : t("login")}
        </button>
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          {t("no_account")}{" "}
          <Link
            className="text-brand-600 dark:text-brand-400"
            href="/register"
          >
            {t("register")}
          </Link>
        </p>
      </form>
    </div>
  );
}
