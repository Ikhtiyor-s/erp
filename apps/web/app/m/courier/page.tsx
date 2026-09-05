"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Wifi, WifiOff, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";

type Courier = {
  employee_id: string;
  employee_name: string;
  employee_phone?: string;
  is_online: boolean;
  last_seen_at: string;
  last_lat?: string;
  last_lng?: string;
};

export default function MobileCourierMode() {
  const [tab, setTab] = useState<"online" | "me">("online");
  const [rows, setRows] = useState<Courier[]>([]);
  const [meOnline, setMeOnline] = useState(false);
  const [tracking, setTracking] = useState<number | null>(null);
  const [loadingOnline, setLoadingOnline] = useState(false);

  async function loadOnline() {
    setLoadingOnline(true);
    try {
      const r = await api.get<Courier[]>("/courier/online");
      setRows(r.data || []);
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Kuryerlarni yuklab bo'lmadi"));
    } finally {
      setLoadingOnline(false);
    }
  }
  useEffect(() => { if (tab === "online") loadOnline(); }, [tab]);

  async function toggleOnline() {
    const nx = !meOnline;
    try {
      const pos: GeolocationPosition | null = await new Promise((res) => {
        if (!navigator.geolocation) return res(null);
        navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 5000 });
      });
      await api.post("/courier/status", {
        is_online: nx,
        lat: pos?.coords.latitude || null,
        lng: pos?.coords.longitude || null,
      });
      setMeOnline(nx);
      toast.success(nx ? "Onlayn" : "Oflayn");
      if (nx) startTracking();
      else stopTracking();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  function startTracking() {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition((p) => {
      api.post("/courier/location", {
        lat: p.coords.latitude, lng: p.coords.longitude,
        accuracy_m: p.coords.accuracy, speed_kmh: p.coords.speed ? p.coords.speed * 3.6 : null,
      }).catch(() => {});
    }, () => {}, { enableHighAccuracy: true, maximumAge: 10000 });
    setTracking(id);
  }
  function stopTracking() {
    if (tracking != null) navigator.geolocation.clearWatch(tracking);
    setTracking(null);
  }
  useEffect(() => () => stopTracking(), []);

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-xl font-bold px-1">Kuryerlar</h1>

      <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
        <button onClick={() => setTab("online")}
          className={`flex-1 py-2 text-sm rounded ${tab === "online" ? "bg-brand-600 text-white" : "text-slate-600"}`}>
          Onlayn
        </button>
        <button onClick={() => setTab("me")}
          className={`flex-1 py-2 text-sm rounded ${tab === "me" ? "bg-brand-600 text-white" : "text-slate-600"}`}>
          Men kuryerman
        </button>
      </div>

      {tab === "online" ? (
        loadingOnline ? (
          <div className="py-16 text-center text-slate-400 text-sm">Yuklanmoqda...</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-400">Hozir onlayn kuryerlar yo'q</div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map((c) => (
                <li key={c.employee_id} className="px-3 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <div>
                      <div className="text-sm font-medium">{c.employee_name}</div>
                      {c.employee_phone && (
                        <a href={`tel:${c.employee_phone}`} className="text-xs text-brand-600">{c.employee_phone}</a>
                      )}
                    </div>
                  </div>
                  {c.last_lat && (
                    <a href={`https://yandex.uz/maps/?ll=${c.last_lng},${c.last_lat}&z=15&pt=${c.last_lng},${c.last_lat}`}
                      target="_blank" rel="noopener" className="p-2 text-brand-600">
                      <MapPin size={16} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      ) : (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 text-center space-y-4">
          <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${meOnline ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
            {meOnline ? <Wifi size={40} /> : <WifiOff size={40} />}
          </div>
          <div className="text-lg font-semibold">{meOnline ? "Onlayn" : "Oflayn"}</div>
          <p className="text-sm text-slate-500">
            {meOnline ? "Joylashuvingiz har 10 sekundda yangilanadi" : "Onlayn rejimga o'tish uchun tugmani bosing"}
          </p>
          <button onClick={toggleOnline}
            className={`w-full py-3 rounded-lg font-medium text-white ${meOnline ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
            {meOnline ? "Oflayn rejimi" : "Onlayn rejimi"}
          </button>
        </div>
      )}
    </div>
  );
}
