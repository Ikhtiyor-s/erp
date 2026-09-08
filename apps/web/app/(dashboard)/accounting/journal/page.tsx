"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";

type JournalRow = {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string | null;
  source_type: string;
  total: number;
};

type JournalLineDetail = {
  id: number;
  account_id: number;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  description: string | null;
};

type JournalDetail = JournalRow & { lines: JournalLineDetail[] };

type Account = { id: number; code: string; name: string };

const SOURCE_LABEL: Record<string, string> = {
  manual: "Qo'lda",
  sale: "Sotuv",
  supply: "Xarid",
  write_off: "Hisobdan chiqarish",
};

const fmt = (v: number) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

type NewLine = { account_id: string; debit: string; credit: string; description: string };

export default function JournalPage() {
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [detail, setDetail] = useState<JournalDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<NewLine[]>([
    { account_id: "", debit: "", credit: "", description: "" },
    { account_id: "", debit: "", credit: "", description: "" },
  ]);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<JournalRow[]>("/accounting/journal");
      setRows(data);
    } catch (e) {
      toast.error(getErrorMessage(e, "Yuklashda xato"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get<Account[]>("/accounting/accounts").then((r) => setAccounts(r.data)).catch(() => {});
  }, []);

  async function openDetail(row: JournalRow) {
    setDetailOpen(true);
    setDetail(null);
    try {
      const { data } = await api.get<JournalDetail>(`/accounting/journal/${row.id}`);
      setDetail(data);
    } catch (e) {
      toast.error(getErrorMessage(e, "Yuklashda xato"));
    }
  }

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = lines.length >= 2 && Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  function updateLine(i: number, patch: Partial<NewLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { account_id: "", debit: "", credit: "", description: "" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function openCreate() {
    setDescription("");
    setEntryDate(new Date().toISOString().slice(0, 10));
    setLines([
      { account_id: "", debit: "", credit: "", description: "" },
      { account_id: "", debit: "", credit: "", description: "" },
    ]);
    setCreateOpen(true);
  }

  async function submit() {
    if (!balanced) {
      toast.error("Debet va kredit teng bo'lishi kerak");
      return;
    }
    setSaving(true);
    try {
      await api.post("/accounting/journal", {
        entry_date: entryDate,
        description,
        lines: lines
          .filter((l) => l.account_id && (Number(l.debit) || Number(l.credit)))
          .map((l) => ({
            account_id: Number(l.account_id),
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description || undefined,
          })),
      });
      toast.success("Provodka kiritildi");
      setCreateOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<JournalRow>[] = [
    { key: "entry_number", header: "№", width: "100px" },
    { key: "entry_date", header: "Sana", width: "110px" },
    { key: "description", header: "Tavsif" },
    {
      key: "source_type",
      header: "Manba",
      width: "140px",
      render: (r) => SOURCE_LABEL[r.source_type] ?? r.source_type,
    },
    {
      key: "total",
      header: "Summa",
      align: "right",
      width: "140px",
      render: (r) => <span className="font-mono">{fmt(r.total)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buxgalteriya jurnali"
        description="Barcha provodkalar (debet/kredit yozuvlari)"
        actions={<Button icon={Plus} onClick={openCreate}>Yangi provodka</Button>}
      />

      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={openDetail} rowKey={(r) => r.id} />

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`Provodka ${detail?.entry_number ?? ""}`} size="lg">
        {!detail ? (
          <div className="py-8 text-center text-sm text-ink-400">Yuklanmoqda...</div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-ink-600 dark:text-ink-400">
              {detail.entry_date} · {detail.description || "—"}
            </div>
            <div className="overflow-x-auto border border-ink-200/60 dark:border-ink-800/60 rounded-md">
              <table className="w-full text-[13px]">
                <thead className="bg-ink-50 dark:bg-ink-900">
                  <tr className="text-ink-500 dark:text-ink-400 text-[11px] uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60">
                    <th className="px-3 py-2 text-left font-medium">Hisob</th>
                    <th className="px-3 py-2 text-right font-medium">Debet</th>
                    <th className="px-3 py-2 text-right font-medium">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((l) => (
                    <tr key={l.id} className="border-b border-ink-100 dark:border-ink-800/40 last:border-0">
                      <td className="px-3 py-2 text-ink-800 dark:text-ink-200">
                        <span className="font-mono text-ink-500 dark:text-ink-400 mr-1.5">{l.account_code}</span>
                        {l.account_name}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{l.debit ? fmt(l.debit) : ""}</td>
                      <td className="px-3 py-2 text-right font-mono">{l.credit ? fmt(l.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Yangi provodka" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sana">
              <input type="date" className={input} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </Field>
            <Field label="Tavsif">
              <input className={input} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>

          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_120px_36px] gap-2 items-center">
                <select
                  className={input}
                  value={l.account_id}
                  onChange={(e) => updateLine(i, { account_id: e.target.value })}
                >
                  <option value="">Hisob tanlang</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Debet"
                  className={input}
                  value={l.debit}
                  onChange={(e) => updateLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })}
                />
                <input
                  type="number"
                  placeholder="Kredit"
                  className={input}
                  value={l.credit}
                  onChange={(e) => updateLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })}
                />
                <Button variant="ghost" size="xs" icon={Trash2} onClick={() => removeLine(i)} disabled={lines.length <= 2} />
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" icon={Plus} onClick={addLine}>Qator qo'shish</Button>

          <div className={`flex justify-between text-sm font-medium px-1 ${balanced ? "text-success-600 dark:text-success-500" : "text-danger-600 dark:text-danger-500"}`}>
            <span>Jami debet: {fmt(totalDebit)}</span>
            <span>Jami kredit: {fmt(totalCredit)}</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Bekor</Button>
            <Button onClick={submit} loading={saving} disabled={!balanced}>Saqlash</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
