"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { usePermissions } from "@/lib/permissions";

type SaleOrder = {
  id: string;
  doc_number?: string;
  date: string;
  status: string;
  customer_name?: string;
  total: string;
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Tasdiqlangan",
  pending: "Kutilmoqda",
  paid: "To'langan",
  partial: "Qisman",
  draft: "Qoralama",
  cancelled: "Bekor",
};

const STATUS_CLASS: Record<string, string> = {
  confirmed: "bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("uz-Cyrl-UZ", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function MobileOrdersPage() {
  const router = useRouter();
  const { can, loading: permLoading } = usePermissions();
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const r = await api.get<SaleOrder[]>("/sale/sales?limit=60&status=confirmed");
      setOrders(r.data || []);
    } catch (e) {
      toast.error(getErrorMessage(e, "Buyurtmalarni yuklab bo'lmadi"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (permLoading) return;
    if (!can("order.pick.view")) {
      toast.error("Sizda bu sahifani ko'rish uchun ruxsat yo'q.");
      router.replace("/m");
      return;
    }
    load();
  }, [permLoading, can, load, router]);

  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  if (permLoading || loading) {
    return (
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between px-1">
          <h1 className="text-xl font-bold">Pick-list — Buyurtmalar</h1>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 animate-pulse"
            >
              <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-32 mb-2" />
              <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-40 mb-2" />
              <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold">Pick-list — Buyurtmalar</h1>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          aria-label="Yangilash"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 dark:text-slate-400 disabled:opacity-50"
        >
          <RefreshCw size={20} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="py-20 text-center text-slate-400">
          <ClipboardList size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Faol buyurtmalar yo'q</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <button
                onClick={() => router.push(`/m/orders/${order.id}`)}
                className="w-full text-left bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 active:bg-slate-50 dark:active:bg-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {order.doc_number || order.id.slice(0, 8)}
                  </span>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_CLASS[order.status] || STATUS_CLASS.pending}`}
                  >
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                </div>
                {order.customer_name && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1 truncate">
                    {order.customer_name}
                  </p>
                )}
                <p className="text-[10px] text-slate-400">{fmtDate(order.date)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
