"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { input } from "@/components/ui/modal";

type SupplyItem = {
  product_id: string;
  product_name: string;
  quantity: string;
  price: string;
  amount: string;
  received_qty: string;
};

type SupplyDetail = {
  head: {
    id: string;
    doc_number: string | null;
    supplier_id: string;
    warehouse_id: number;
    supply_date: string;
    total_amount: string;
    status: string;
    notes: string | null;
  };
  items: SupplyItem[];
};

const fmt = (v: string | number | null | undefined) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

function statusBadge(status: string) {
  if (status === "received") return <Badge tone="success">Qabul qilindi</Badge>;
  if (status === "partially_received") return <Badge tone="warning">Qisman qabul qilindi</Badge>;
  if (status === "cancelled") return <Badge tone="danger">Bekor qilindi</Badge>;
  return <Badge tone="neutral">Qoralama</Badge>;
}

export default function SupplyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [detail, setDetail] = useState<SupplyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<SupplyDetail>(`/supplier/supplies/${id}`);
      setDetail(res.data);
      const remaining: Record<string, string> = {};
      for (const it of res.data.items) {
        const rem = Number(it.quantity) - Number(it.received_qty);
        if (rem > 0) remaining[it.product_id] = String(rem);
      }
      setReceiveQty(remaining);
    } catch (e) {
      toast.error(getErrorMessage(e, "Yuklashda xato"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function submitReceive() {
    if (!detail) return;
    const items = Object.entries(receiveQty)
      .map(([product_id, qty]) => ({ product_id, qty: Number(qty) }))
      .filter((i) => i.qty > 0);
    if (items.length === 0) return toast.error("Qabul qilinadigan miqdorni kiriting");
    setSaving(true);
    try {
      await api.post(`/supplier/supplies/${id}/receive`, { items });
      toast.success("Qabul qilindi");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "Xato"));
    } finally {
      setSaving(false);
    }
  }

  const canReceive = detail && (detail.head.status === "draft" || detail.head.status === "partially_received");

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => router.push("/supply/purchases")} />
        <h1 className="text-xl font-semibold text-ink-900 dark:text-ink-100">Xarid tafsiloti</h1>
      </div>

      {loading && <div className="text-center py-16 text-ink-400 text-[13px]">Yuklanmoqda...</div>}

      {!loading && detail && (
        <>
          <Card padding="lg" className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[18px] font-semibold text-ink-900 dark:text-ink-100">
                {detail.head.doc_number || detail.head.id.slice(0, 8)}
              </span>
              {statusBadge(detail.head.status)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-ink-100 dark:border-ink-800 text-[13px]">
              <div>
                <p className="text-ink-500">Sana</p>
                <p className="text-ink-900 dark:text-ink-100">{new Date(detail.head.supply_date).toLocaleDateString("ru-RU")}</p>
              </div>
              <div>
                <p className="text-ink-500">Jami summa</p>
                <p className="font-mono text-ink-900 dark:text-ink-100">{fmt(detail.head.total_amount)}</p>
              </div>
              {detail.head.notes && (
                <div>
                  <p className="text-ink-500">Izoh</p>
                  <p className="text-ink-900 dark:text-ink-100">{detail.head.notes}</p>
                </div>
              )}
            </div>
          </Card>

          <Card padding="none">
            <CardHeader title="Tovarlar" />
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-ink-50/60 dark:bg-ink-900/20">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-ink-600 dark:text-ink-400">Tovar</th>
                    <th className="text-right px-4 py-2.5 font-medium text-ink-600 dark:text-ink-400 w-28">Buyurtma</th>
                    <th className="text-right px-4 py-2.5 font-medium text-ink-600 dark:text-ink-400 w-28">Qabul qilingan</th>
                    <th className="text-right px-4 py-2.5 font-medium text-ink-600 dark:text-ink-400 w-28">Qolgan</th>
                    <th className="text-right px-4 py-2.5 font-medium text-ink-600 dark:text-ink-400 w-32">Narx</th>
                    {canReceive && (
                      <th className="text-right px-4 py-2.5 font-medium text-ink-600 dark:text-ink-400 w-36">Qabul qilinsin</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200/60 dark:divide-ink-800/60">
                  {detail.items.map((item) => {
                    const remaining = Number(item.quantity) - Number(item.received_qty);
                    return (
                      <tr key={item.product_id}>
                        <td className="px-4 py-3 text-ink-900 dark:text-ink-100">{item.product_name}</td>
                        <td className="px-4 py-3 text-right font-mono">{fmt(item.quantity)}</td>
                        <td className="px-4 py-3 text-right font-mono">{fmt(item.received_qty)}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          <span className={remaining > 0 ? "text-warn-700 dark:text-warn-500" : "text-success-700 dark:text-success-500"}>
                            {fmt(remaining)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{fmt(item.price)}</td>
                        {canReceive && (
                          <td className="px-4 py-3 text-right">
                            {remaining > 0 ? (
                              <input
                                type="number" step="0.001" min={0} max={remaining}
                                className={`${input} text-right`}
                                value={receiveQty[item.product_id] ?? ""}
                                onChange={(e) => setReceiveQty({ ...receiveQty, [item.product_id]: e.target.value })}
                              />
                            ) : (
                              <span className="text-ink-400">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {canReceive && (
              <div className="flex justify-end gap-2 px-4 py-3 border-t border-ink-200 dark:border-ink-800">
                <Button onClick={submitReceive} disabled={saving}>
                  Qabul qilishni yakunlash
                </Button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
