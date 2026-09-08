"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatWidget } from "@/components/ui/stat-widget";

type Row = { id: number; code: string; name: string; amount: number };

const fmt = (v: number) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

export default function PnlPage() {
  const [dateFrom, setDateFrom] = useState(monthAgo());
  const [dateTo, setDateTo] = useState(today());
  const [income, setIncome] = useState<Row[]>([]);
  const [expense, setExpense] = useState<Row[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/accounting/reports/pnl", {
        params: { date_from: dateFrom, date_to: dateTo },
      });
      setIncome(data.income);
      setExpense(data.expense);
      setTotalIncome(data.total_income);
      setTotalExpense(data.total_expense);
      setNetProfit(data.net_profit);
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

  return (
    <div className="space-y-6">
      <PageHeader title="Foyda-zarar hisoboti" description="Daromad va xarajatlar — sof foyda/zarar" />

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatWidget label="Jami daromad" value={fmt(totalIncome)} icon={TrendingUp} color="success" mono />
        <StatWidget label="Jami xarajat" value={fmt(totalExpense)} icon={TrendingDown} color="danger" mono />
        <StatWidget label="Sof foyda/zarar" value={fmt(netProfit)} icon={Scale} color={netProfit >= 0 ? "success" : "danger"} mono />
      </div>

      <Card padding="none">
        <CardHeader title="Daromadlar" />
        <CardBody padding="none">
          <table className="w-full text-[13px]">
            <tbody>
              {income.map((r) => (
                <tr key={r.id} className="border-b border-ink-100 dark:border-ink-800/40 last:border-0">
                  <td className="px-4 py-2 font-mono text-ink-500 dark:text-ink-400 w-20">{r.code}</td>
                  <td className="px-4 py-2 text-ink-800 dark:text-ink-200">{r.name}</td>
                  <td className="px-4 py-2 text-right font-mono text-success-700 dark:text-success-500">{fmt(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader title="Xarajatlar" />
        <CardBody padding="none">
          <table className="w-full text-[13px]">
            <tbody>
              {expense.map((r) => (
                <tr key={r.id} className="border-b border-ink-100 dark:border-ink-800/40 last:border-0">
                  <td className="px-4 py-2 font-mono text-ink-500 dark:text-ink-400 w-20">{r.code}</td>
                  <td className="px-4 py-2 text-ink-800 dark:text-ink-200">{r.name}</td>
                  <td className="px-4 py-2 text-right font-mono text-danger-700 dark:text-danger-500">{fmt(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
