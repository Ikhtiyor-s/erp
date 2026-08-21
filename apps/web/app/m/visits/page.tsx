"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Camera, CheckCircle, Clock, Play } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";

type Visit = {
  id: string;
  customer_name: string;
  customer_phone?: string;
  visit_date: string;
  status: "planned" | "in_progress" | "completed" | "skipped";
  customer_id: string;
};

export default function MobileVisits() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Visit[]>([]);

  async function load() {
    const r = await api.get<Visit[]>(`/distribution/planned-visits?visit_date=${date}`);
    setRows(r.data || []);
  }
  useEffect(() => { load(); }, [date]);

  async function checkIn(v: Visit) {
    try {
      const pos: GeolocationPosition | null = await new Promise((res) => {
        if (!navigator.geolocation) return res(null);
        navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 8000 });
      });
      await api.post("/visits/check-in", {
        customer_id: v.customer_id,
        planned_visit_id: v.id,
        lat: pos?.coords.latitude || null,
        lng: pos?.coords.longitude || null,
      });
      toast.success("Vizit boshlandi");
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-xl font-bold px-1">Vizitlar</h1>

      <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm" />

      {rows.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          Bu kunda vizitlar yo'q
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((v) => (
              <li key={v.id} className="px-3 py-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{v.customer_name}</div>
                    {v.customer_phone && (
                      <a href={`tel:${v.customer_phone}`} className="text-xs text-brand-600">{v.customer_phone}</a>
                    )}
                  </div>
                  {v.status === "planned" && (
                    <button onClick={() => checkIn(v)}
                      className="px-3 py-1.5 bg-brand-600 text-white text-xs rounded-md flex items-center gap-1">
                      <Play size={11} /> Boshlash
                    </button>
                  )}
                  {v.status === "in_progress" && (
                    <span className="px-2 py-0.5 text-xs bg-teal-100 text-teal-700 rounded">Davom etmoqda</span>
                  )}
                  {v.status === "completed" && (
                    <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded flex items-center gap-1">
                      <CheckCircle size={11} /> Yakun
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
