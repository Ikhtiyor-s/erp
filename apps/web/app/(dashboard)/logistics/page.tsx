"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Phone, Truck, CheckCircle, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  courier_name?: string;
  delivery_address: string;
  delivery_lat?: string;
  delivery_lng?: string;
  scheduled_at?: string;
  delivered_at?: string;
  status: string;
  notes?: string;
  created_at: string;
};

type StatusTone = "neutral" | "info" | "primary" | "warning" | "success" | "danger";

const STATUS: Record<string, { l: string; tone: StatusTone; icon: any }> = {
  new: { l: "Yangi", tone: "neutral", icon: Clock },
  assigned: { l: "Tayinlandi", tone: "info", icon: Truck },
  picked_up: { l: "Olib ketildi", tone: "primary", icon: Truck },
  in_transit: { l: "Yo'lda", tone: "warning", icon: Truck },
  delivered: { l: "Yetkazildi", tone: "success", icon: CheckCircle },
  failed: { l: "Muvaffaqiyatsiz", tone: "danger", icon: Clock },
};

export default function LogisticsPage() {
  const [rows, setRows] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("");

  async function load() {
    const p = filter ? `?status=${filter}` : "";
    const r = await api.get<Order[]>(`/delivery-orders${p}`);
    setRows(r.data || []);
  }
  useEffect(() => { load(); }, [filter]);

  async function updateStatus(id: string, s: string) {
    await api.post(`/delivery-orders/${id}/status`, { status: s });
    toast.success("Holat yangilandi");
    load();
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Logistika" description="Yetkazib berish buyurtmalari" />

      <Card padding="sm" className="flex items-center gap-2 overflow-x-auto">
        <span className="text-sm text-ink-500">Holat:</span>
        <button onClick={() => setFilter("")}
          className={`px-3 py-1.5 rounded text-sm ${!filter ? "bg-brand-600 text-white" : "text-ink-600 dark:text-ink-300"}`}>
          Hammasi
        </button>
        {Object.entries(STATUS).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded text-sm whitespace-nowrap ${filter === k ? "bg-brand-600 text-white" : "text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800"}`}>
            {v.l}
          </button>
        ))}
        <a href="/hr/courier" className="ml-auto text-sm text-brand-600 hover:underline whitespace-nowrap">
          Kuryerlar →
        </a>
      </Card>

      <Card padding="none">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-ink-400">
            <Truck size={48} className="mx-auto mb-3 opacity-40" />
            Buyurtmalar yo'q
          </div>
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-800/40">
            {rows.map((o) => {
              const cfg = STATUS[o.status] || STATUS.new;
              const Icon = cfg.icon;
              return (
                <li key={o.id} className="px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">№ {o.order_number}</span>
                        <span className="text-sm">{o.customer_name}</span>
                        {o.customer_phone && (
                          <a href={`tel:${o.customer_phone}`} className="text-xs text-brand-600 flex items-center gap-1">
                            <Phone size={11} /> {o.customer_phone}
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-ink-500 mt-1 flex items-start gap-1">
                        <MapPin size={12} className="mt-0.5" />
                        <span>{o.delivery_address}</span>
                        {o.delivery_lat && (
                          <a href={`https://yandex.uz/maps/?ll=${o.delivery_lng},${o.delivery_lat}&z=15&pt=${o.delivery_lng},${o.delivery_lat}`}
                            target="_blank" rel="noopener" className="ml-1 text-brand-600">[xarita]</a>
                        )}
                      </div>
                      {o.courier_name && (
                        <div className="text-xs text-ink-500 mt-0.5">Kuryer: {o.courier_name}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone={cfg.tone}>
                        <Icon size={11} /> {cfg.l}
                      </Badge>
                      {o.status !== "delivered" && o.status !== "failed" && (
                        <select onChange={(e) => e.target.value && updateStatus(o.id, e.target.value)}
                          value=""
                          className="text-xs px-2 py-1 border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-950 text-ink-700 dark:text-ink-200 rounded">
                          <option value="">O'zgartirish...</option>
                          {Object.entries(STATUS).filter(([k]) => k !== o.status).map(([k, v]) => (
                            <option key={k} value={k}>{v.l}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
