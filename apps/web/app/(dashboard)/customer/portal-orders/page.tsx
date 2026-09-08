"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type PortalOrder = {
  id: string;
  order_number: string;
  status: string;
  notes: string | null;
  total_amount: string;
  created_at: string;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  item_count: number;
};

type PortalOrderItem = {
  id: number;
  product_id: string;
  product_name: string;
  sku: string | null;
  quantity: string;
  note: string | null;
  unit_price: string;
  line_total: string;
};

type PortalOrderDetail = {
  id: string;
  order_number: string;
  status: string;
  notes: string | null;
  total_amount: string;
  created_at: string;
  customer_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  items: PortalOrderItem[];
};

const STATUS_LABEL: Record<string, string> = {
  new: "Yangi",
  confirmed: "Tasdiqlangan",
  cancelled: "Bekor qilingan",
  delivered: "Yetkazilgan",
};

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "danger"> = {
  new: "neutral",
  confirmed: "info",
  delivered: "success",
  cancelled: "danger",
};

const fmt = (v: string | number) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

const fmtDate = (v: string) => new Date(v).toLocaleDateString("ru-RU");

export default function CustomerPortalOrdersPage() {
  const [rows, setRows] = useState<PortalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PortalOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const res = await api.get<PortalOrder[]>(`/customer/portal-orders${qs}`);
      setRows(res.data);
    } catch (e) {
      setLoadError(getErrorMessage(e, "Buyurtmalarni yuklashda xatolik"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await api.get<PortalOrderDetail>(`/customer/portal-orders/${id}`);
      setDetail(res.data);
    } catch (e) {
      setDetailError(getErrorMessage(e, "Buyurtma ma'lumotlarini yuklashda xatolik"));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function openDetail(row: PortalOrder) {
    setSelectedId(row.id);
    setDetail(null);
    setDetailError(null);
    loadDetail(row.id);
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    setCancelConfirmOpen(false);
  }

  async function updateStatus(status: string) {
    if (!selectedId) return;
    setActionLoading(true);
    try {
      await api.put(`/customer/portal-orders/${selectedId}/status`, { status });
      toast.success("Status yangilandi");
      setCancelConfirmOpen(false);
      await Promise.all([load(), loadDetail(selectedId)]);
    } catch (e) {
      toast.error(getErrorMessage(e, "Statusni yangilashda xatolik"));
    } finally {
      setActionLoading(false);
    }
  }

  const columns: Column<PortalOrder>[] = [
    { key: "order_number", header: "Raqami", width: "110px" },
    {
      key: "customer_name",
      header: "Mijoz",
      render: (r) => (
        <div>
          <div className="text-ink-900 dark:text-ink-100">{r.customer_name || "—"}</div>
          {r.customer_phone && (
            <div className="text-[11px] text-ink-500 dark:text-ink-400">{r.customer_phone}</div>
          )}
        </div>
      ),
    },
    {
      key: "item_count",
      header: "Mahsulot soni",
      align: "right",
      width: "120px",
    },
    {
      key: "total_amount",
      header: "Summa",
      align: "right",
      width: "140px",
      render: (r) => (
        <span className="font-mono text-ink-900 dark:text-ink-100">{fmt(r.total_amount)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "150px",
      render: (r) => (
        <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
          {STATUS_LABEL[r.status] ?? r.status}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "Sana",
      width: "120px",
      render: (r) => fmtDate(r.created_at),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace buyurtmalari"
        description="Mijozlar tomonidan marketplace-portal orqali yuborilgan buyurtmalar"
      />

      <Card padding="sm">
        <div className="max-w-xs">
          <label className="text-xs text-ink-500 dark:text-ink-400 block mb-1">Status</label>
          <select
            className="w-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Hammasi</option>
            <option value="new">Yangi</option>
            <option value="confirmed">Tasdiqlangan</option>
            <option value="cancelled">Bekor qilingan</option>
            <option value="delivered">Yetkazilgan</option>
          </select>
        </div>
      </Card>

      {loadError ? (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-danger-600 dark:text-danger-500">{loadError}</p>
              <Button variant="outline" size="sm" onClick={load}>
                Qayta urinish
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          onRowClick={openDetail}
          emptyText="Buyurtmalar topilmadi"
        />
      )}

      <Modal
        open={!!selectedId}
        onClose={closeDetail}
        size="lg"
        title={detail ? `Buyurtma ${detail.order_number}` : "Buyurtma"}
      >
        {detailLoading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-ink-400 dark:text-ink-600">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Yuklanmoqda...</span>
          </div>
        ) : detailError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-danger-600 dark:text-danger-500">{detailError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectedId && loadDetail(selectedId)}
            >
              Qayta urinish
            </Button>
          </div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[11px] text-ink-500 dark:text-ink-400">Mijoz</div>
                <div className="text-ink-900 dark:text-ink-100">{detail.customer_name || "—"}</div>
              </div>
              <div>
                <div className="text-[11px] text-ink-500 dark:text-ink-400">Telefon</div>
                <div className="text-ink-900 dark:text-ink-100">{detail.customer_phone || "—"}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-[11px] text-ink-500 dark:text-ink-400">Manzil</div>
                <div className="text-ink-900 dark:text-ink-100">{detail.customer_address || "—"}</div>
              </div>
            </div>

            <div className="border border-ink-200 dark:border-ink-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 dark:bg-ink-900/40 text-ink-700 dark:text-ink-300">
                  <tr>
                    <th className="text-left px-3 py-2">Mahsulot</th>
                    <th className="text-right px-3 py-2 w-24">Miqdor</th>
                    <th className="text-right px-3 py-2 w-32">Narxi</th>
                    <th className="text-right px-3 py-2 w-32">Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((it) => (
                    <tr key={it.id} className="border-t border-ink-200 dark:border-ink-800">
                      <td className="px-3 py-2">
                        <div className="text-ink-900 dark:text-ink-100">{it.product_name}</div>
                        {it.sku && (
                          <div className="text-[11px] text-ink-500 dark:text-ink-400">{it.sku}</div>
                        )}
                        {it.note && (
                          <div className="text-[11px] text-ink-500 dark:text-ink-400">{it.note}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{fmt(it.quantity)}</td>
                      <td className="px-3 py-2 text-right font-mono text-ink-900 dark:text-ink-100">
                        {fmt(it.unit_price)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-ink-900 dark:text-ink-100">
                        {fmt(it.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {detail.notes && (
              <div>
                <div className="text-[11px] text-ink-500 dark:text-ink-400">Izoh</div>
                <div className="text-sm text-ink-900 dark:text-ink-100">{detail.notes}</div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-ink-200 dark:border-ink-800">
              <span className="text-sm text-ink-500 dark:text-ink-400">Jami</span>
              <span className="font-mono text-base font-semibold text-ink-900 dark:text-ink-100">
                {fmt(detail.total_amount)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              {detail.status === "new" && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={actionLoading}
                  >
                    Bekor qilish
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => updateStatus("confirmed")}
                    loading={actionLoading}
                  >
                    Tasdiqlash
                  </Button>
                </>
              )}
              {detail.status === "confirmed" && (
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={actionLoading}
                  >
                    Bekor qilish
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => updateStatus("delivered")}
                    loading={actionLoading}
                  >
                    Yetkazildi deb belgilash
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={() => updateStatus("cancelled")}
        title="Buyurtmani bekor qilish"
        message={
          detail
            ? `Buyurtma ${detail.order_number} bekor qilinsinmi?`
            : "Buyurtma bekor qilinsinmi?"
        }
        confirmLabel="Bekor qilish"
        cancelLabel="Yopish"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
