"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Play, Square, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Modal, Field, input } from "@/components/ui/modal";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

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

  const historyCols: Column<Session>[] = [
    {
      key: "opened_at",
      header: "Ochildi",
      render: (s) => (
        <div>
          <div>{new Date(s.opened_at).toLocaleString("uz-Cyrl-UZ", { dateStyle: "short", timeStyle: "short" })}</div>
          <div className="text-xs text-ink-500">{s.opened_by_name}</div>
        </div>
      ),
    },
    {
      key: "closed_at",
      header: "Yopildi",
      render: (s) =>
        s.closed_at ? (
          <div>
            <div>{new Date(s.closed_at).toLocaleString("uz-Cyrl-UZ", { dateStyle: "short", timeStyle: "short" })}</div>
            <div className="text-xs text-ink-500">{s.closed_by_name}</div>
          </div>
        ) : (
          <span className="text-success-600 dark:text-success-500">Ochiq</span>
        ),
    },
    {
      key: "total_income",
      header: "Kirim",
      align: "right",
      render: (s) => <span className="font-mono text-success-600 dark:text-success-500">{fmt(s.total_income)}</span>,
    },
    {
      key: "total_expense",
      header: "Chiqim",
      align: "right",
      render: (s) => <span className="font-mono text-danger-600 dark:text-danger-500">{fmt(s.total_expense)}</span>,
    },
    { key: "sale_count", header: "Sotuv", align: "right", render: (s) => s.sale_count || 0 },
    { key: "closed_diff", header: "Farq", align: "right", render: (s) => <span className="font-mono">{fmt(s.closed_diff)}</span> },
    {
      key: "status",
      header: "Holat",
      align: "center",
      render: (s) => (
        <Badge tone={s.status === "open" ? "success" : "neutral"}>
          {s.status === "open" ? "Ochiq" : "Yopiq"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Kassa smenasi" description="Smena ochish, yopish va tarix" />

      <Card padding="md">
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-500">Kassa:</span>
          <select className={`${input} max-w-xs`} value={boxId || ""}
            onChange={(e) => setBoxId(e.target.value ? Number(e.target.value) : null)}>
            {boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Button variant="outline" size="sm" icon={RefreshCw} className="ml-auto" onClick={refresh}>
            Yangilash
          </Button>
        </div>
      </Card>

      {active ? (
        <div className="bg-success-50 dark:bg-success-500/15 p-4 rounded-xl border border-success-500/30">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-success-700 dark:text-success-500">Smena ochiq</div>
              <div className="text-xs text-success-700 dark:text-success-500 mt-1">
                {new Date(active.opened_at).toLocaleString("uz-Cyrl-UZ")} — {active.opened_by_name}
              </div>
              <div className="text-xs text-success-700 dark:text-success-500 mt-2">
                Boshlang'ich qoldiq: <span className="font-mono font-semibold">{fmt(active.opened_balance)}</span>
              </div>
            </div>
            <Button variant="danger" size="sm" icon={Square}
              onClick={() => { setCloseForm({ ...closeForm, closed_balance: Number(active.opened_balance) }); setCloseOpen(true); }}>
              Yopish
            </Button>
          </div>
        </div>
      ) : (
        <Card padding="md">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-500">Smena yopiq</span>
            <Button size="sm" icon={Play} onClick={() => setOpenOpen(true)}>
              Ochish
            </Button>
          </div>
        </Card>
      )}

      <Card padding="none">
        <CardHeader title="Tarix" />
        <DataTable columns={historyCols} rows={history} emptyText="Smenalar yo'q" rowKey={(s) => s.id} />
      </Card>

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
          <div className="flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
            <Button type="button" variant="outline" onClick={() => setOpenOpen(false)}>Bekor</Button>
            <Button type="button" onClick={openSession}>Ochish</Button>
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
          <div className="flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
            <Button type="button" variant="outline" onClick={() => setCloseOpen(false)}>Bekor</Button>
            <Button type="button" variant="danger" onClick={closeSession}>Yopish</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
