"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { register } from "@/lib/auth";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    organization_name: "",
  });
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success(t("welcome"));
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Error");
    } finally {
      setLoading(false);
    }
  }

  function field(k: keyof typeof form) {
    return {
      value: form[k],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm({ ...form, [k]: e.target.value }),
    };
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
      <form
        onSubmit={onSubmit}
        className="bg-white dark:bg-slate-800 shadow-md rounded-lg p-8 w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-center mb-2 text-slate-900 dark:text-slate-100">
          {t("register")}
        </h1>
        <input
          required
          placeholder={t("organization_name")}
          {...field("organization_name")}
          className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2"
        />
        <input
          required
          placeholder={t("full_name")}
          {...field("full_name")}
          className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2"
        />
        <input
          required
          type="email"
          placeholder={t("email")}
          autoComplete="username"
          {...field("email")}
          className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2"
        />
        <input
          required
          type="password"
          placeholder={t("password")}
          autoComplete="new-password"
          {...field("password")}
          className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-md font-medium disabled:opacity-60"
        >
          {loading ? "..." : t("register")}
        </button>
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          {t("have_account")}{" "}
          <Link className="text-brand-600 dark:text-brand-400" href="/login">
            {t("login")}
          </Link>
        </p>
      </form>
    </div>
  );
}
