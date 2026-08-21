"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Play, Square, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Modal, Field, input } from "@/components/ui/modal";

type Cashbox = { id: number; name: string };
type Session = {
  id: string;
  cashbox_id: number;
  cashbox_name: string;
  opened_at: string;
  opened_balance: string;
  opened_diff: string;
  opened_by_name?: string;
  closed_at?: string;
  closed_balance?: string;
  closed_diff?: string;
  closed_by_name?: string;
  total_income?: string;
  total_expense?: string;
  sale_count?: number;
  status: "open" | "closed";
};

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function CashboxSessionsPage() {
  const [boxes, setBoxes] = useState<Cashbox[]>([]);
  const [boxId, setBoxId] = useState<number | null>(null);
  const [active, setActive] = useState<Session | null>(null);
  const [history, setHistory] = useState<Session[]>([]);
  const [openOpen, setOpenOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [form, setForm] = useState({ opened_balance: 0, opened_note: "" });
  const [closeForm, setCloseForm] = useState({ closed_balance: 0, closed_diff: 0, closed_note: "" });

  useEffect(() => {
    api.get<Cashbox[]>("/finance/cashboxes").then((r) => {
      setBoxes(r.data || []);
      if (r.data?.[0]) setBoxId(r.data[0].id);
    }).catch(() => setBoxes([]));
  }, []);

  async function refresh() {
    if (!boxId) return;
    const [a, h] = await Promise.all([
      api.get<Session | null>(`/cashbox-sessions/active?cashbox_id=${boxId}`).then((r) => r.data).catch(() => null),
      api.get<Session[]>(`/cashbox-sessions?cashbox_id=${boxId}&limit=30`).then((r) => r.data).catch(() => []),
    ]);
    setActive(a);
    setHistory(h);
  }
  useEffect(() => { refresh(); }, [boxId]);

  async function openSession() {
    try {
      await api.post("/cashbox-sessions/open", { cashbox_id: boxId, opened_balance: form.opened_balance, opened_note: form.opened_note });
      toast.success("Smena ochildi");
      setOpenOpen(false);
      refresh();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }
  async function closeSession() {
    if (!active) return;
    try {
      await api.post(`/cashbox-sessions/${active.id}/close`, closeForm);
      toast.success("Smena yopildi");
      setCloseOpen(false);
      refresh();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Xato"));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Kassa smenasi" description="Smena ochish, yopish va tarix" />

      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-3">
        <span className="text-sm text-slate-500">Kassa:</span>
        <select className={`${input} max-w-xs`} value={boxId || ""}
          onChange={(e) => setBoxId(e.target.value ? Number(e.target.value) : null)}>
          {boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button onClick={refresh} className="ml-auto px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded flex items-center gap-1">
          <RefreshCw size={14} /> Yangilash
        </button>
      </div>

      {active ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Smena ochiq</div>
              <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                {new Date(active.opened_at).toLocaleString("uz-Cyrl-UZ")} — {active.opened_by_name}
              </div>
              <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-2">
                Boshlang'ich qoldiq: <span className="font-mono font-semibold">{fmt(active.opened_balance)}</span>
              </div>
            </div>
            <button onClick={() => { setCloseForm({ ...closeForm, closed_balance: Number(active.opened_balance) }); setCloseOpen(true); }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-sm flex items-center gap-1.5">
              <Square size={14} /> Yopish
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="text-sm text-slate-500">Smena yopiq</span>
          <button onClick={() => setOpenOpen(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm flex items-center gap-1.5">
            <Play size={14} /> Ochish
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 font-semibold">Tarix</div>
        {history.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">Smenalar yo'q</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2.5">Ochildi</th>
                <th className="text-left px-4 py-2.5">Yopildi</th>
                <th className="text-right px-4 py-2.5">Kirim</th>
                <th className="text-right px-4 py-2.5">Chiqim</th>
                <th className="text-right px-4 py-2.5">Sotuv</th>
                <th className="text-right px-4 py-2.5">Farq</th>
                <th className="text-center px-4 py-2.5">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {history.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5">
                    <div>{new Date(s.opened_at).toLocaleString("uz-Cyrl-UZ", { dateStyle: "short", timeStyle: "short" })}</div>
                    <div className="text-xs text-slate-500">{s.opened_by_name}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    {s.closed_at ? (
                      <>
                        <div>{new Date(s.closed_at).toLocaleString("uz-Cyrl-UZ", { dateStyle: "short", timeStyle: "short" })}</div>
                        <div className="text-xs text-slate-500">{s.closed_by_name}</div>
                      </>
                    ) : <span className="text-emerald-600">Ochiq</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-600">{fmt(s.total_income)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-rose-600">{fmt(s.total_expense)}</td>
                  <td className="px-4 py-2.5 text-right">{s.sale_count || 0}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(s.closed_diff)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded ${s.status === "open" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {s.status === "open" ? "Ochiq" : "Yopiq"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={openOpen} onClose={() => setOpenOpen(false)} title="Smena ochish">
        <div className="space-y-3">
          <Field label="Boshlang'ich qoldiq">
            <input type="number" className={input} value={form.opened_balance}
              onChange={(e) => setForm({ ...form, opened_balance: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Izoh">
            <textarea className={`${input} h-20`} value={form.opened_note}
              onChange={(e) => setForm({ ...form, opened_note: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setOpenOpen(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded">Bekor</button>
            <button onClick={openSession} className="px-4 py-2 text-sm bg-brand-600 text-white rounded">Ochish</button>
          </div>
        </div>
      </Modal>

      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} title="Smena yopish">
        <div className="space-y-3">
          <Field label="Yakuniy qoldiq (kassa hisoblangan)">
            <input type="number" className={input} value={closeForm.closed_balance}
              onChange={(e) => setCloseForm({ ...closeForm, closed_balance: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Farq (kam/ortiq)">
            <input type="number" className={input} value={closeForm.closed_diff}
              onChange={(e) => setCloseForm({ ...closeForm, closed_diff: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Izoh">
            <textarea className={`${input} h-20`} value={closeForm.closed_note}
              onChange={(e) => setCloseForm({ ...closeForm, closed_note: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <button onClick={() => setCloseOpen(false)} className="px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded">Bekor</button>
            <button onClick={closeSession} className="px-4 py-2 text-sm bg-rose-600 text-white rounded">Yopish</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
