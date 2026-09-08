"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Row = {
  id: number;
  code: string;
  name: string;
  type: string;
  total_debit: number;
  total_credit: number;
};

const fmt = (v: number) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

export default function TrialBalancePage() {
  const [dateFrom, setDateFrom] = useState(monthAgo());
  const [dateTo, setDateTo] = useState(today());
  const [rows, setRows] = useState<Row[]>([]);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/accounting/reports/trial-balance", {
        params: { date_from: dateFrom, date_to: dateTo },
      });
      setRows(data.rows);
      setTotalDebit(data.total_debit);
      setTotalCredit(data.total_credit);
    } catch (e) {
      toast.error(getErrorMessage(e, "Yuklashda xato"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="space-y-6">
      <PageHeader title="Aylanma-saldo qaydnomasi" description="Har bir hisob bo'yicha debet/kredit aylanmasi" />

      <Card padding="sm" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">Sanadan</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 rounded-md px-2.5 py-1.5 text-[13px]" />
        </div>
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">Sanagacha</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 rounded-md px-2.5 py-1.5 text-[13px]" />
        </div>
        <Button onClick={load} loading={loading}>Ko'rsatish</Button>
      </Card>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-ink-50 dark:bg-ink-900">
              <tr className="text-ink-500 dark:text-ink-400 text-[11px] uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60">
                <th className="px-4 py-2 text-left font-medium">Kod</th>
                <th className="px-4 py-2 text-left font-medium">Hisob</th>
                <th className="px-4 py-2 text-right font-medium">Debet</th>
                <th className="px-4 py-2 text-right font-medium">Kredit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-ink-100 dark:border-ink-800/40 last:border-0">
                  <td className="px-4 py-2 font-mono text-ink-500 dark:text-ink-400">{r.code}</td>
                  <td className="px-4 py-2 text-ink-800 dark:text-ink-200">{r.name}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.total_debit ? fmt(r.total_debit) : ""}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.total_credit ? fmt(r.total_credit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-ink-50 dark:bg-ink-900 border-t border-ink-200/60 dark:border-ink-800/60">
              <tr className="font-semibold">
                <td colSpan={2} className="px-4 py-2.5">Jami</td>
                <td className="px-4 py-2.5 text-right font-mono">{fmt(totalDebit)}</td>
                <td className="px-4 py-2.5 text-right font-mono">{fmt(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className={`text-sm font-medium ${balanced ? "text-success-600 dark:text-success-500" : "text-danger-600 dark:text-danger-500"}`}>
        {balanced ? "✓ Debet = Kredit (mutanosib)" : "✗ Debet ≠ Kredit — nomutanosiblik bor"}
      </div>
    </div>
  );
}
