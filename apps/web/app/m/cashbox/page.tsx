"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Play, Square, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

export default function MobileCashbox() {
  const [boxes, setBoxes] = useState<any[]>([]);
  const [boxId, setBoxId] = useState<number | null>(null);
  const [active, setActive] = useState<any>(null);
  const [openAmount, setOpenAmount] = useState("");
  const [closeAmount, setCloseAmount] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<any[]>("/finance/cashboxes").then((r) => {
      setBoxes(r.data || []);
      if (r.data?.[0]) setBoxId(r.data[0].id);
    });
  }, []);

  async function refresh() {
    if (!boxId) return;
    try {
      const r = await api.get<any>(`/cashbox-sessions/active?cashbox_id=${boxId}`);
      setActive(r.data);
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Smena ma'lumotini yuklab bo'lmadi"));
    }
  }
  useEffect(() => { refresh(); }, [boxId]);

  async function openSession() {
    setLoading(true);
    try {
      await api.post("/cashbox-sessions/open", {
        cashbox_id: boxId, opened_balance: Number(openAmount) || 0,
      });
      toast.success("Smena ochildi");
      setOpenAmount("");
      refresh();
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
    setLoading(false);
  }

  async function closeSession() {
    setLoading(true);
    try {
      await api.post(`/cashbox-sessions/${active.id}/close`, {
        closed_balance: Number(closeAmount) || 0, closed_diff: 0,
      });
      toast.success("Smena yopildi");
      setCloseAmount("");
      refresh();
    } catch (e: any) { toast.error(getErrorMessage(e, "Xato")); }
    setLoading(false);
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Kassa smenasi</h1>

      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
        <label className="text-xs text-slate-500 block mb-1">Kassa</label>
        <select value={boxId || ""} onChange={(e) => setBoxId(Number(e.target.value) || null)}
          className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 rounded-md text-sm">
          {boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {active ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 space-y-3">
          <div>
            <div className="font-semibold text-emerald-900 dark:text-emerald-200">Smena ochiq</div>
            <div className="text-xs text-emerald-700 dark:text-emerald-400">
              {new Date(active.opened_at).toLocaleString("uz-Cyrl-UZ")}
            </div>
          </div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span>Boshlang'ich:</span><span className="font-mono">{fmt(active.opened_balance)}</span></div>
            <div className="flex justify-between"><span>Kirim:</span><span className="font-mono text-emerald-700">{fmt(active.total_income)}</span></div>
            <div className="flex justify-between"><span>Chiqim:</span><span className="font-mono text-rose-700">{fmt(active.total_expense)}</span></div>
          </div>
          <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800 space-y-2">
            <input type="number" value={closeAmount} onChange={(e) => setCloseAmount(e.target.value)}
              placeholder="Yakuniy qoldiq" inputMode="decimal"
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-md text-sm" />
            <button onClick={closeSession} disabled={loading}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-2">
              <Square size={16} /> Smenani yopish
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="text-sm text-slate-500">Smena yopiq</div>
          <input type="number" value={openAmount} onChange={(e) => setOpenAmount(e.target.value)}
            placeholder="Boshlang'ich qoldiq" inputMode="decimal"
            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 rounded-md text-sm" />
          <button onClick={openSession} disabled={loading || !boxId}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center gap-2">
            <Play size={16} /> Smenani ochish
          </button>
        </div>
      )}
    </div>
  );
}
