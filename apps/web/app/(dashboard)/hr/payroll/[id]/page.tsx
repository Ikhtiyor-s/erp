"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal, Field, input } from "@/components/ui/modal";

type Item = {
  id: number;
  employee_id: string;
  employee_name: string;
  base_salary: number;
  bonus: number;
  deductions: number;
  advance_deducted: number;
  net_pay: number;
  notes: string | null;
};

type Head = {
  id: string;
  period_month: string;
  status: "draft" | "approved" | "paid";
  tax_rate: number;
  notes: string | null;
};

const STATUS_TONE: Record<Head["status"], "neutral" | "info" | "success"> = {
  draft: "neutral",
  approved: "info",
  paid: "success",
};
const STATUS_LABEL: Record<Head["status"], string> = {
  draft: "Qoralama",
  approved: "Tasdiqlangan",
  paid: "To'langan",
};

const fmt = (v: number) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

type Cashbox = { id: number; name: string };

export default function PayrollRunPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [head, setHead] = useState<Head | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Item | null>(null);
  const [editBonus, setEditBonus] = useState("0");
  const [editDeductions, setEditDeductions] = useState("0");
  const [saving, setSaving] = useState(false);

  const [confirmApprove, setConfirmApprove] = useState(false);
  const [approving, setApproving] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [cashboxId, setCashboxId] = useState("");
  const [paying, setPaying] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(`/hr/payroll/runs/${id}`);
      setHead(data.head);
      setItems(data.items);
    } catch (e) {
      toast.error(getErrorMessage(e, "Yuklashda xato"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get<Cashbox[]>("/finance/cashboxes").then((r) => setCashboxes(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function openEdit(it: Item) {
    setEditing(it);
    setEditBonus(String(it.bonus));
    setEditDeductions(String(it.deductions));
  }

  async function saveItem() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/hr/payroll/runs/${id}/items/${editing.id}`, {
        bonus: Number(editBonus) || 0,
        deductions: Number(editDeductions) || 0,
      });
      setEditing(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setSaving(false);
    }
  }

  async function doApprove() {
    setApproving(true);
    try {
      await api.post(`/hr/payroll/runs/${id}/approve`);
      toast.success("Tasdiqlandi");
      setConfirmApprove(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setApproving(false);
    }
  }

  async function doPay() {
    if (!cashboxId) {
      toast.error("Kassani tanlang");
      return;
    }
    setPaying(true);
    try {
      await api.post(`/hr/payroll/runs/${id}/pay`, { cashbox_id: Number(cashboxId) });
      toast.success("To'landi");
      setPayOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setPaying(false);
    }
  }

  const totalNet = items.reduce((s, i) => s + Number(i.net_pay || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={head ? new Date(head.period_month).toLocaleDateString("ru-RU", { year: "numeric", month: "long" }) : "..."}
        description="Ish haqi hisob-kitobi"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" icon={ArrowLeft} onClick={() => router.push("/hr/payroll")}>Orqaga</Button>
            {head?.status === "draft" && (
              <Button variant="success" icon={Check} onClick={() => setConfirmApprove(true)}>Tasdiqlash</Button>
            )}
            {head?.status === "approved" && (
              <Button variant="primary" icon={Wallet} onClick={() => setPayOpen(true)}>To'lash</Button>
            )}
          </div>
        }
      />

      {head && (
        <Badge tone={STATUS_TONE[head.status]} soft>{STATUS_LABEL[head.status]}</Badge>
      )}

      <Card padding="none">
        <CardHeader title="Xodimlar" description={`Soliq stavkasi: ${head?.tax_rate ?? 0}%`} />
        <CardBody padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-ink-50 dark:bg-ink-900">
                <tr className="text-ink-500 dark:text-ink-400 text-[11px] uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60">
                  <th className="px-4 py-2 text-left font-medium">Xodim</th>
                  <th className="px-4 py-2 text-right font-medium">Oklad</th>
                  <th className="px-4 py-2 text-right font-medium">Bonus</th>
                  <th className="px-4 py-2 text-right font-medium">Chegirma</th>
                  <th className="px-4 py-2 text-right font-medium">Avans</th>
                  <th className="px-4 py-2 text-right font-medium">Sof summa</th>
                  {head?.status === "draft" && <th className="px-4 py-2 w-20" />}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-ink-100 dark:border-ink-800/40 last:border-0">
                    <td className="px-4 py-2 text-ink-800 dark:text-ink-200">{it.employee_name}</td>
                    <td className="px-4 py-2 text-right font-mono">{fmt(it.base_salary)}</td>
                    <td className="px-4 py-2 text-right font-mono text-success-700 dark:text-success-500">{fmt(it.bonus)}</td>
                    <td className="px-4 py-2 text-right font-mono text-danger-700 dark:text-danger-500">{fmt(it.deductions)}</td>
                    <td className="px-4 py-2 text-right font-mono text-warn-700 dark:text-warn-500">{fmt(it.advance_deducted)}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{fmt(it.net_pay)}</td>
                    {head?.status === "draft" && (
                      <td className="px-4 py-2 text-center">
                        <Button variant="ghost" size="xs" onClick={() => openEdit(it)}>Tahrirlash</Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-ink-50 dark:bg-ink-900 border-t border-ink-200/60 dark:border-ink-800/60">
                <tr className="font-semibold">
                  <td colSpan={5} className="px-4 py-2.5">Jami</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmt(totalNet)}</td>
                  {head?.status === "draft" && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.employee_name ?? ""} size="sm">
        <div className="space-y-4">
          <Field label="Bonus">
            <input type="number" className={input} value={editBonus} onChange={(e) => setEditBonus(e.target.value)} />
          </Field>
          <Field label="Chegirma (soliq)">
            <input type="number" className={input} value={editDeductions} onChange={(e) => setEditDeductions(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Bekor</Button>
            <Button onClick={saveItem} loading={saving}>Saqlash</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmApprove}
        onClose={() => setConfirmApprove(false)}
        onConfirm={doApprove}
        title="Hisob-kitobni tasdiqlash"
        message="Tasdiqlangach xodimlar qatorini o'zgartirib bo'lmaydi va buxgalteriya provodkasi yaraladi. Davom etasizmi?"
        loading={approving}
      />

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="To'lash" size="sm">
        <div className="space-y-4">
          <Field label="Kassa" required>
            <select className={input} value={cashboxId} onChange={(e) => setCashboxId(e.target.value)}>
              <option value="">Tanlang</option>
              {cashboxes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <p className="text-sm text-ink-600 dark:text-ink-400">
            Jami to'lanadi: <span className="font-mono font-semibold">{fmt(totalNet)}</span>
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPayOpen(false)}>Bekor</Button>
            <Button onClick={doPay} loading={paying}>To'lash</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
