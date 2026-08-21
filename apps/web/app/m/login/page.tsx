"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Smartphone, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { login } from "@/lib/auth";
import { api } from "@/lib/api";

function deviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
    localStorage.setItem("device_id", id);
  }
  return id;
}

export default function MobileLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<"passcode" | "password">("passcode");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasPasscode, setHasPasscode] = useState(false);
  const [lastUser, setLastUser] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) {
      try {
        const usr = JSON.parse(u);
        setLastUser(usr);
        setHasPasscode(!!localStorage.getItem("has_passcode"));
      } catch {}
    }
    if (!u) setMode("password");
  }, []);

  async function doPasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Xush kelibsiz!");
      router.push("/m");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Login xato");
    } finally {
      setLoading(false);
    }
  }

  async function doPasscodeLogin(e: React.FormEvent) {
    e.preventDefault();
    if (passcode.length < 4) return;
    setLoading(true);
    try {
      const r = await api.post<any>("/passcode/verify", {
        user_id: lastUser.id,
        passcode,
        device_id: deviceId(),
      });
      localStorage.setItem("access_token", r.data.access_token);
      localStorage.setItem("refresh_token", r.data.refresh_token);
      toast.success("Xush kelibsiz!");
      router.push("/m");
    } catch (err: any) {
      toast.error("Noto'g'ri passcode");
      setPasscode("");
    } finally {
      setLoading(false);
    }
  }

  function pushDigit(d: string) {
    if (passcode.length < 6) {
      const next = passcode + d;
      setPasscode(next);
      if (next.length >= 4) {
        // auto-submit
        setTimeout(() => {
          const form = document.getElementById("pcform") as HTMLFormElement | null;
          if (next.length >= 4) form?.requestSubmit?.();
        }, 100);
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-br from-slate-50 to-brand-50 dark:from-slate-950 dark:to-brand-950/30">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white text-3xl font-bold mb-3">
            A
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Aniq ERP</h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === "passcode" && hasPasscode ? "Passcode kiriting" : "Hisobga kiring"}
          </p>
        </div>

        {mode === "passcode" && hasPasscode && lastUser ? (
          <form id="pcform" onSubmit={doPasscodeLogin} className="space-y-6">
            <div className="text-center text-sm text-slate-600 dark:text-slate-300">
              {lastUser.full_name || lastUser.email}
            </div>
            <div className="flex justify-center gap-2.5">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i}
                  className={`w-3 h-3 rounded-full ${i < passcode.length ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600"}`} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} type="button" onClick={() => pushDigit(d)}
                  className="aspect-square text-2xl font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition">
                  {d}
                </button>
              ))}
              <button type="button" onClick={() => { setMode("password"); setPasscode(""); }}
                className="aspect-square text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500">
                Parol
              </button>
              <button type="button" onClick={() => pushDigit("0")}
                className="aspect-square text-2xl font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95">
                0
              </button>
              <button type="button" onClick={() => setPasscode(passcode.slice(0, -1))}
                className="aspect-square text-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500">
                ⌫
              </button>
            </div>
            <button type="button" onClick={() => {
              localStorage.removeItem("user");
              localStorage.removeItem("has_passcode");
              setLastUser(null);
              setMode("password");
            }} className="block mx-auto text-xs text-slate-500 hover:text-slate-700">
              Boshqa akkaunt
            </button>
          </form>
        ) : (
          <form onSubmit={doPasswordLogin} className="space-y-4">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
              <input type="email" required autoFocus value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="Email"
                className="w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg" />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
              <input type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="Parol"
                className="w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg font-medium">
              {loading ? "Yuborilmoqda..." : "Kirish"}
            </button>
            <button type="button"
              onClick={() => { setEmail("qa@example.com"); setPassword("Qa12345!"); }}
              className="block mx-auto text-xs text-slate-500 hover:text-slate-700">
              Demo (qa@example.com)
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
