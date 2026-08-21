"use client";

import { useEffect, useState } from "react";
import { Camera, MapPin, User, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { input } from "@/components/ui/modal";

type Visit = {
  id: string;
  customer_name: string;
  employee_name: string;
  check_in_at: string;
  check_in_lat?: string;
  check_in_lng?: string;
  check_out_at?: string;
  status: string;
  comment?: string;
  photo_count?: number;
};

export default function VisitsPage() {
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Visit[]>([]);

  async function load() {
    const p = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, limit: "100" });
    const r = await api.get<Visit[]>(`/visits?${p}`);
    setRows(r.data || []);
  }
  useEffect(() => { load(); }, [dateFrom, dateTo]);

  return (
    <div className="space-y-5">
      <PageHeader title="Vizitlar tarixi" description="Yakunlangan vizitlar va xodimlar harakati" />

      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2">
        <input type="date" className={`${input} max-w-xs`} value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)} />
        <span className="text-slate-400">—</span>
        <input type="date" className={`${input} max-w-xs`} value={dateTo}
          onChange={(e) => setDateTo(e.target.value)} />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400">Vizitlar yo'q</div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((v) => {
              const dur = v.check_out_at
                ? Math.round((new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime()) / 60000)
                : null;
              return (
                <li key={v.id} className="px-4 py-3 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{v.customer_name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1"><User size={11} /> {v.employee_name}</span>
                      <span className="flex items-center gap-1"><Clock size={11} />
                        {new Date(v.check_in_at).toLocaleString("uz-Cyrl-UZ", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                      {dur != null && <span>{dur} min</span>}
                      {v.check_in_lat && (
                        <a href={`https://yandex.uz/maps/?ll=${v.check_in_lng},${v.check_in_lat}&z=15&pt=${v.check_in_lng},${v.check_in_lat}`}
                          target="_blank" rel="noopener" className="flex items-center gap-1 text-brand-600">
                          <MapPin size={11} /> Xarita
                        </a>
                      )}
                      {(v.photo_count || 0) > 0 && (
                        <span className="flex items-center gap-1"><Camera size={11} /> {v.photo_count}</span>
                      )}
                    </div>
                    {v.comment && (
                      <div className="text-sm text-slate-700 dark:text-slate-300 mt-1.5 italic">{v.comment}</div>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    v.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                    v.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {v.status === "completed" ? "Yakunlandi" : v.status === "in_progress" ? "Davom etmoqda" : v.status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
