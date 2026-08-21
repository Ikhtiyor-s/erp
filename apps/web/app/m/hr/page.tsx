"use client";

import { useEffect, useState } from "react";
import { User, Phone } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";

type Employee = { id: string; full_name: string; phone?: string; position_name?: string };

export default function MobileHR() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<Employee[]>("/hr/employees?limit=100")
      .then((r) => setRows(r.data || []))
      .catch((e) => toast.error(getErrorMessage(e, "Xodimlarni yuklab bo'lmadi")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-3 space-y-3">
      <h1 className="text-xl font-bold px-1">Xodimlar</h1>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">Yuklanmoqda...</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-slate-400">Xodimlar yo'q</div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((e) => (
              <li key={e.id} className="px-3 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 flex items-center justify-center">
                  <User size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{e.full_name}</div>
                  {e.position_name && <div className="text-xs text-slate-500">{e.position_name}</div>}
                </div>
                {e.phone && (
                  <a href={`tel:${e.phone}`} className="p-2 text-brand-600">
                    <Phone size={16} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
