"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, Field, input } from "@/components/ui/modal";

type Run = {
  id: string;
  period_month: string;
  status: "draft" | "approved" | "paid";
  tax_rate: number;
  employee_count: number;
  total_net: number;
};

const STATUS_TONE: Record<Run["status"], "neutral" | "info" | "success"> = {
  draft: "neutral",
  approved: "info",
  paid: "success",
};
const STATUS_LABEL: Record<Run["status"], string> = {
  draft: "Qoralama",
  approved: "Tasdiqlangan",
  paid: "To'langan",
};

const fmt = (v: number) => Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export default function PayrollPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [periodMonth, setPeriodMonth] = useState(() => new Date().toISOString().slice(0, 7) + "-01");
  const [taxRate, setTaxRate] = useState("12");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<Run[]>("/hr/payroll/runs");
      setRows(data);
    } catch (e) {
      toast.error(getErrorMessage(e, "Yuklashda xato"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setSaving(true);
    try {
      const { data } = await api.post("/hr/payroll/runs", {
        period_month: periodMonth,
        tax_rate: Number(taxRate) || 0,
      });
      toast.success("Hisob-kitob yaratildi");
      setOpen(false);
      router.push(`/hr/payroll/${data.id}`);
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<Run>[] = [
    {
      key: "period_month",
      header: "Davr",
      render: (r) => new Date(r.period_month).toLocaleDateString("ru-RU", { year: "numeric", month: "long" }),
    },
    { key: "employee_count", header: "Xodimlar soni", align: "right", width: "140px" },
    {
      key: "total_net",
      header: "Jami (sof)",
      align: "right",
      width: "160px",
      render: (r) => <span className="font-mono">{fmt(r.total_net)}</span>,
    },
    {
      key: "status",
      header: "Holat",
      width: "140px",
      render: (r) => <Badge tone={STATUS_TONE[r.status]} soft>{STATUS_LABEL[r.status]}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ish haqi"
        description="Oylik hisob-kitoblar — oklad, bonus, chegirma, avans hisobga olib to'lanadi"
        actions={<Button icon={Plus} onClick={() => setOpen(true)}>Yangi hisob-kitob</Button>}
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/hr/payroll/${r.id}`)}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Yangi hisob-kitob" size="sm">
        <div className="space-y-4">
          <Field label="Davr" required>
            <input type="month" className={input}
              value={periodMonth.slice(0, 7)}
              onChange={(e) => setPeriodMonth(e.target.value + "-01")} />
          </Field>
          <Field label="Soliq stavkasi (%)" hint="NDFL — o'zingiz kiriting, tizimda qattiq yozilmagan">
            <input type="number" className={input} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Bekor</Button>
            <Button onClick={create} loading={saving}>Yaratish</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
