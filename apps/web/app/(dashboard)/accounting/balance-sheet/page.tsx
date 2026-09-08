"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Row = { id: number; code: string; name: string; balance: number };

const fmt = (v: number) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

function Section({ title, rows, total }: { title: string; rows: Row[]; total: number }) {
  return (
    <Card padding="none">
      <CardHeader title={title} />
      <CardBody padding="none">
        <table className="w-full text-[13px]">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ink-100 dark:border-ink-800/40 last:border-0">
                <td className="px-4 py-2 font-mono text-ink-500 dark:text-ink-400 w-20">{r.code}</td>
                <td className="px-4 py-2 text-ink-800 dark:text-ink-200">{r.name}</td>
                <td className="px-4 py-2 text-right font-mono">{fmt(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-ink-50 dark:bg-ink-900 border-t border-ink-200/60 dark:border-ink-800/60">
            <tr className="font-semibold">
              <td colSpan={2} className="px-4 py-2.5">Jami</td>
              <td className="px-4 py-2.5 text-right font-mono">{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </CardBody>
    </Card>
  );
}

export default function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data: d } = await api.get("/accounting/reports/balance-sheet", { params: { as_of: asOf } });
      setData(d);
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
      <PageHeader title="Balans" description="Aktivlar, majburiyatlar va kapital — muayyan sanaga" />

      <Card padding="sm" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">Sanaga</label>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)}
            className="border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 rounded-md px-2.5 py-1.5 text-[13px]" />
        </div>
        <Button onClick={load} loading={loading}>Ko'rsatish</Button>
        {data && (
          <Badge tone={data.balanced ? "success" : "danger"} soft className="ml-auto">
            {data.balanced ? "Mutanosib" : "Nomutanosib"}
          </Badge>
        )}
      </Card>

      {data && (
        <>
          <Section title="Aktivlar" rows={data.assets} total={data.total_assets} />
          <Section title="Majburiyatlar" rows={data.liabilities} total={data.total_liabilities} />
          <Card padding="none">
            <CardHeader title="Kapital" />
            <CardBody padding="none">
              <table className="w-full text-[13px]">
                <tbody>
                  {data.equity.map((r: Row) => (
                    <tr key={r.id} className="border-b border-ink-100 dark:border-ink-800/40">
                      <td className="px-4 py-2 font-mono text-ink-500 dark:text-ink-400 w-20">{r.code}</td>
                      <td className="px-4 py-2 text-ink-800 dark:text-ink-200">{r.name}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(r.balance)}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-ink-100 dark:border-ink-800/40 last:border-0">
                    <td className="px-4 py-2 font-mono text-ink-500 dark:text-ink-400 w-20">—</td>
                    <td className="px-4 py-2 text-ink-800 dark:text-ink-200">Joriy davr foydasi/zarari</td>
                    <td className={`px-4 py-2 text-right font-mono ${data.retained_earnings >= 0 ? "text-success-700 dark:text-success-500" : "text-danger-700 dark:text-danger-500"}`}>
                      {fmt(data.retained_earnings)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-ink-50 dark:bg-ink-900 border-t border-ink-200/60 dark:border-ink-800/60">
                  <tr className="font-semibold">
                    <td colSpan={2} className="px-4 py-2.5">Jami kapital</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmt(data.total_equity)}</td>
                  </tr>
                </tfoot>
              </table>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
