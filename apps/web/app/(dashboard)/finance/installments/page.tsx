"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";

type Plan = {
  id: string;
  customer_id: string;
  customer_name: string;
  total_amount: string;
  paid_amount: string;
  months: number;
  interest_pct: string;
  start_date: string;
  status: string;
  schedule_count: number;
  paid_count: number;
};

const fmt = (v: any) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const STATUS: Record<string, { l: string; tone: "info" | "success" | "danger" | "neutral" }> = {
  active: { l: "Faol", tone: "info" },
  completed: { l: "Yakunlangan", tone: "success" },
  defaulted: { l: "Qarz", tone: "danger" },
  cancelled: { l: "Bekor", tone: "neutral" },
};

export default function InstallmentsPage() {
  const [rows, setRows] = useState<Plan[]>([]);
  const [filter, setFilter] = useState<string>("active");

  async function load() {
    const r = await api.get<Plan[]>(`/installments?status=${filter}&limit=100`);
    setRows(r.data || []);
  }
  useEffect(() => { load(); }, [filter]);

  const columns: Column<Plan>[] = [
    { key: "customer_name", header: "Mijoz" },
    { key: "start_date", header: "Boshlanish", width: "120px", render: (p) => <span className="text-ink-500">{p.start_date}</span> },
    { key: "total_amount", header: "Jami", align: "right", width: "140px", render: (p) => <span className="font-mono">{fmt(p.total_amount)}</span> },
    {
      key: "paid_amount",
      header: "To'langan",
      align: "right",
      width: "160px",
      render: (p) => {
        const pct = Number(p.total_amount) ? Math.round((Number(p.paid_amount) / Number(p.total_amount)) * 100) : 0;
        return (
          <div>
            <div className="font-mono">{fmt(p.paid_amount)}</div>
            <div className="h-1 bg-ink-100 dark:bg-ink-800 rounded mt-1">
              <div className="h-1 bg-brand-600 rounded" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    { key: "paid_count", header: "Oy", align: "center", width: "90px", render: (p) => `${p.paid_count}/${p.months}` },
    { key: "interest_pct", header: "% foiz", align: "center", width: "90px", render: (p) => `${p.interest_pct}%` },
    {
      key: "status",
      header: "Holat",
      align: "center",
      width: "120px",
      render: (p) => <Badge tone={STATUS[p.status]?.tone || "neutral"}>{STATUS[p.status]?.l || p.status}</Badge>,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Bo'lib to'lash"
        description="Mijozlar uchun ochilgan bo'lib to'lash rejalari" />

      <Card padding="sm">
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-500">Holat:</span>
          {Object.entries(STATUS).map(([k, v]) => (
            <Button key={k} size="sm" variant={filter === k ? "primary" : "ghost"} onClick={() => setFilter(k)}>
              {v.l}
            </Button>
          ))}
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(p) => p.id}
        emptyText="Bo'lib to'lash yo'q"
        onRowClick={(p) => { location.href = `/finance/installments/${p.id}`; }}
      />
    </div>
  );
}
