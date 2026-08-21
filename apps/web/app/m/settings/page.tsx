"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { User, Lock, Printer, Bell, Globe, Moon, Sun, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";

function deviceId(): string {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
    localStorage.setItem("device_id", id);
  }
  return id;
}

export default function MobileSettings() {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false);
  const [pc1, setPc1] = useState("");
  const [pc2, setPc2] = useState("");
  const [hasPasscode, setHasPasscode] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) setUser(JSON.parse(u));
    setHasPasscode(!!localStorage.getItem("has_passcode"));
  }, []);

  async function setPasscode() {
    if (pc1.length < 4 || pc1 !== pc2) return toast.error("Passcode mos kelmadi");
    try {
      await api.post("/passcode/set", { passcode: pc1, device_id: deviceId() });
      localStorage.setItem("has_passcode", "1");
      setHasPasscode(true);
      setShowPasscodeSetup(false);
      setPc1(""); setPc2("");
      toast.success("Passcode o'rnatildi");
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  function logout() {
    localStorage.clear();
    router.push("/m/login");
  }

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-xl font-bold px-1">Sozlamalar</h1>

      {user && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 flex items-center justify-center">
            <User size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{user.full_name || user.email}</div>
            <div className="text-xs text-slate-500 truncate">{user.email}</div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        <button onClick={() => setShowPasscodeSetup(true)}
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/40">
          <Lock size={18} className="text-slate-500" />
          <span className="flex-1 text-left">Passcode</span>
          <span className="text-xs text-slate-400">{hasPasscode ? "O'rnatilgan" : "Yo'q"}</span>
        </button>
        <button onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/40">
          {resolvedTheme === "dark" ? <Sun size={18} className="text-slate-500" /> : <Moon size={18} className="text-slate-500" />}
          <span className="flex-1 text-left">Mavzu</span>
          <span className="text-xs text-slate-400">{resolvedTheme === "dark" ? "Qorong'u" : "Yorug'"}</span>
        </button>
      </div>

      {showPasscodeSetup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowPasscodeSetup(false)}>
          <div className="bg-white dark:bg-slate-800 w-full rounded-t-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-lg">Yangi passcode</div>
            <input type="password" inputMode="numeric" maxLength={6} autoFocus
              value={pc1} onChange={(e) => setPc1(e.target.value.replace(/\D/g, ""))}
              placeholder="4���6 raqam"
              className="w-full px-3 py-3 bg-slate-100 dark:bg-slate-900 rounded-lg text-center font-mono text-2xl tracking-widest" />
            <input type="password" inputMode="numeric" maxLength={6}
              value={pc2} onChange={(e) => setPc2(e.target.value.replace(/\D/g, ""))}
              placeholder="Tasdiqlash"
              className="w-full px-3 py-3 bg-slate-100 dark:bg-slate-900 rounded-lg text-center font-mono text-2xl tracking-widest" />
            <div className="flex gap-2">
              <button onClick={() => setShowPasscodeSetup(false)} className="flex-1 py-3 border border-slate-300 dark:border-slate-600 rounded-lg">Bekor</button>
              <button onClick={setPasscode} className="flex-1 py-3 bg-brand-600 text-white rounded-lg font-medium">Saqlash</button>
            </div>
          </div>
        </div>
      )}

      <button onClick={logout}
        className="w-full px-4 py-3 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-lg font-medium flex items-center justify-center gap-2">
        <LogOut size={16} /> Chiqish
      </button>
    </div>
  );
}
