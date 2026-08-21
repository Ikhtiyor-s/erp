"use client";

import { useEffect, useState } from "react";
import { Phone, MapPin, RefreshCw, Wifi } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";

type Courier = {
  employee_id: string;
  employee_name: string;
  employee_phone?: string;
  is_online: boolean;
  last_seen_at: string;
  last_lat?: string;
  last_lng?: string;
};

export default function CourierPage() {
  const [rows, setRows] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<Courier[]>("/courier/online");
      setRows(r.data || []);
    } finally { setLoading(false); }
  }
  useEffect(() => {
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  function timeAgo(iso: string) {
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return `${sec}s avval`;
    if (sec < 3600) return `${Math.floor(sec / 60)} min avval`;
    return `${Math.floor(sec / 3600)} soat avval`;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Kuryerlar" description="Onlayn kuryerlar va ularning joylashuvi" />

      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <span className="text-sm text-slate-500">
          <Wifi size={14} className="inline mr-1 text-emerald-600" />
          Onlayn: {rows.length}
        </span>
        <button onClick={load} className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded flex items-center gap-1">
          <RefreshCw size={14} /> Yangilash
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-slate-400">Yuklanmoqda...</div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 py-16 text-center text-slate-400 rounded-lg border border-slate-200 dark:border-slate-700">
          Hozir onlayn kuryerlar yo'q
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((c) => (
            <div key={c.employee_id} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold">{c.employee_name}</div>
                  {c.employee_phone && (
                    <a href={`tel:${c.employee_phone}`}
                      className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 hover:text-brand-600">
                      <Phone size={11} /> {c.employee_phone}
                    </a>
                  )}
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Onlayn" />
              </div>
              <div className="text-xs text-slate-500">{timeAgo(c.last_seen_at)}</div>
              {c.last_lat && c.last_lng && (
                <a href={`https://yandex.uz/maps/?ll=${c.last_lng},${c.last_lat}&z=15&pt=${c.last_lng},${c.last_lat}`}
                  target="_blank" rel="noopener"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                  <MapPin size={11} /> Xaritada ko'rish
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
