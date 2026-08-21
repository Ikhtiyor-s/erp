"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingCart, Users, Box, Wallet, Coffee, Truck, BarChart3, UserCog, ListChecks, Boxes,
} from "lucide-react";
import { api } from "@/lib/api";

const QUICK = [
  { href: "/m/pos", label: "POS-kassa", icon: ShoppingCart, color: "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300" },
  { href: "/m/pos/tickets", label: "Ochiq ticket", icon: Coffee, color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  { href: "/m/sales/new", label: "Yangi sotuv", icon: BarChart3, color: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
  { href: "/m/customers", label: "Mijoz", icon: Users, color: "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300" },
  { href: "/m/warehouse", label: "Sklad", icon: Box, color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  { href: "/m/finance", label: "Moliya", icon: Wallet, color: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300" },
  { href: "/m/visits", label: "Vizit", icon: ListChecks, color: "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300" },
  { href: "/m/courier", label: "Kuryer", icon: Truck, color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
];

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

export default function MobileHome() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<{ today_sales: number; today_amount: number; open_tickets: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/m/login"); return; }
    const u = localStorage.getItem("user");
    if (u) try { setUser(JSON.parse(u)); } catch {}

    Promise.all([
      api.get<any>("/sale/dashboard").catch(() => ({ data: null })),
      api.get<any[]>("/open-tickets?status=open").catch(() => ({ data: [] })),
    ]).then(([sum, tix]) => {
      setStats({
        today_sales: sum.data?.today_count || 0,
        today_amount: sum.data?.today_revenue || 0,
        open_tickets: (tix.data || []).length,
      });
    });
  }, [router]);

  return (
    <div className="p-4 space-y-5">
      {user && (
        <div>
          <div className="text-sm text-slate-500">Xush kelibsiz,</div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {user.full_name || user.email}
          </div>
        </div>
      )}

      {/* Today stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Bugun sotuv" value={String(stats?.today_sales ?? "—")} />
        <StatCard label="Daromad" value={fmt(stats?.today_amount ?? 0)} />
        <StatCard label="Ochiq ticket" value={String(stats?.open_tickets ?? "—")} />
      </div>

      {/* Quick actions */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Tezkor</div>
        <div className="grid grid-cols-4 gap-2">
          {QUICK.map((q) => {
            const Icon = q.icon;
            return (
              <Link key={q.href} href={q.href}
                className="flex flex-col items-center gap-1.5 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand-400 transition">
                <div className={`w-10 h-10 rounded-full ${q.color} flex items-center justify-center`}>
                  <Icon size={18} />
                </div>
                <span className="text-[11px] text-center text-slate-700 dark:text-slate-300">{q.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
      <div className="text-lg font-bold font-mono mt-0.5 text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}
