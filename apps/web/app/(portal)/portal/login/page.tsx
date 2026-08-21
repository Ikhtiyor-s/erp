"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { setPortalAuth } from "../../portal-auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

export default function PortalLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
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
        body: JSON.stringify({ phone, org_code: orgCode }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Xato");
      setStep("otp");
      if (data.dev_code) {
        setDevCode(data.dev_code);
        toast.info(`Dev kod: ${data.dev_code}`, { duration: 8000 });
      } else {
        toast.success("Kod telefoningizga yuborildi");
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
        body: JSON.stringify({ phone, code, org_code: orgCode }),
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
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-50 to-brand-50 dark:from-slate-950 dark:to-brand-950">
      <div className="bg-white dark:bg-slate-800 shadow-xl rounded-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 mb-3">
            <Sparkles size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Aniq — Mijoz kabineti
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {step === "phone"
              ? "Kirish uchun telefon raqamingizni kiriting"
              : "Telefon raqamingizga yuborilgan kodni kiriting"}
          </p>
        </div>

        {step === "phone" ? (
          <form onSubmit={requestOtp} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
                Telefon raqami
              </label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="tel"
                  required
                  placeholder="+998 90 123 45 67"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
                Tashkilot kodi
              </label>
              <input
                type="text"
                required
                placeholder="ANIQ"
                value={orgCode}
                onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md font-mono text-sm text-slate-900 dark:text-slate-100"
              />
              <p className="text-xs text-slate-400 mt-1">
                Bu kodni sotuvchidan oling
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2.5 rounded-md font-medium"
            >
              {loading ? "Yuborilmoqda..." : "Kod olish"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-md">
              <Phone size={14} className="inline mr-1" /> {phone}
            </div>
            {devCode && (
              <div className="text-xs bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200 p-2 rounded">
                Dev rejim — kod: <code className="font-mono font-bold">{devCode}</code>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
                SMS kod (6 raqam)
              </label>
              <div className="relative">
                <ShieldCheck size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-md text-slate-900 dark:text-slate-100 font-mono text-lg tracking-widest"
                  autoFocus
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2.5 rounded-md font-medium"
            >
              {loading ? "Tekshirilmoqda..." : "Kirish"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("phone"); setCode(""); setDevCode(""); }}
              className="w-full text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ← Telefonni o'zgartirish
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
