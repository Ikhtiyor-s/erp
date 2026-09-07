"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

type StockInStatus = "draft" | "confirmed" | "cancelled";

type StockInItem = {
  product_id: string;
  product_name: string;
  quantity: string;
  unit_cost: string | null;
};

type StockInDetail = {
  id: string;
  doc_number: string | null;
  warehouse_id: number;
  warehouse_name: string | null;
  reason_id: number | null;
  reason_name: string | null;
  reason_text: string | null;
  status: StockInStatus;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  created_by: string | null;
  confirmed_by: string | null;
  items: StockInItem[];
};

const STATUS_TONE: Record<StockInStatus, "neutral" | "success" | "danger"> = {
  draft: "neutral",
  confirmed: "success",
  cancelled: "danger",
};

function statusBadge(status: StockInStatus, t: (k: string) => string) {
  const labelMap: Record<StockInStatus, string> = {
    draft: "status_draft",
    confirmed: "status_confirmed",
    cancelled: "status_cancelled",
  };
  return <Badge tone={STATUS_TONE[status]}>{t(labelMap[status])}</Badge>;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("ru-RU");
}

function fmtNum(v: string | null) {
  if (!v) return "—";
  return Number(v).toLocaleString("ru-RU", { maximumFractionDigits: 4 });
}

export default function StockInDetailPage() {
  const t = useTranslations("warehouse.stock_in");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [detail, setDetail] = useState<StockInDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<StockInDetail>(`/warehouse/stock-ins/${id}`);
      setDetail(res.data);
    } catch (e) {
      setError(getErrorMessage(e, t("error_load")));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { load(); }, [load]);

  async function handleConfirm() {
    setActionLoading(true);
    try {
      await api.post(`/warehouse/stock-ins/${id}/confirm`);
      toast.success(t("confirmed"));
      setConfirmOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, t("error_load")));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);
    try {
      await api.post(`/warehouse/stock-ins/${id}/cancel`);
      toast.success(t("cancelled"));
      setCancelOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, t("error_load")));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    setActionLoading(true);
    try {
      await api.delete(`/warehouse/stock-ins/${id}`);
      toast.success(t("deleted"));
      router.push("/warehouse/stock-in");
    } catch (e) {
      toast.error(getErrorMessage(e, t("error_load")));
      setActionLoading(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-400">
        {t("loading")}
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          onClick={() => router.push("/warehouse/stock-in")}
        >
          {t("back_to_list")}
        </Button>
        <div className="rounded-md bg-danger-50 dark:bg-danger-500/15 border border-danger-500/30 px-4 py-3 text-[13px] text-danger-700 dark:text-danger-500">
          {error || t("error_load")}
        </div>
      </div>
    );
  }

  const totalQty = detail.items.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  const totalValue = detail.items.reduce((sum, i) => {
    const q = Number(i.quantity || 0);
    const c = Number(i.unit_cost || 0);
    return sum + q * c;
  }, 0);
  const hasValue = detail.items.some((i) => i.unit_cost && Number(i.unit_cost) > 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          onClick={() => router.push("/warehouse/stock-in")}
        />
        <h1 className="text-[clamp(16px,2.2vw,18px)] font-semibold text-ink-900 dark:text-ink-50 tracking-tight">
          {t("detail_title")} — {detail.doc_number || detail.id.slice(0, 8)}
        </h1>
        {statusBadge(detail.status, t)}
      </div>

      <Card padding="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-[13px]">
          <div>
            <span className="text-ink-500 dark:text-ink-400 block text-[11px] uppercase tracking-wider mb-0.5">{t("detail_warehouse")}</span>
            <span className="text-ink-900 dark:text-ink-100 font-medium">{detail.warehouse_name || "—"}</span>
          </div>
          <div>
            <span className="text-ink-500 dark:text-ink-400 block text-[11px] uppercase tracking-wider mb-0.5">{t("detail_reason")}</span>
            <span className="text-ink-900 dark:text-ink-100">{detail.reason_name || "—"}</span>
            {detail.reason_text && <span className="text-ink-500 ml-1">({detail.reason_text})</span>}
          </div>
          <div>
            <span className="text-ink-500 dark:text-ink-400 block text-[11px] uppercase tracking-wider mb-0.5">{t("detail_status")}</span>
            {statusBadge(detail.status, t)}
          </div>
          {detail.notes && (
            <div className="sm:col-span-2 lg:col-span-3">
              <span className="text-ink-500 dark:text-ink-400 block text-[11px] uppercase tracking-wider mb-0.5">{t("detail_notes")}</span>
              <span className="text-ink-700 dark:text-ink-300">{detail.notes}</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-ink-100 dark:border-ink-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px] text-ink-500 dark:text-ink-400">
          <div>
            <span className="block">{t("detail_created_at")}</span>
            <span className="text-ink-700 dark:text-ink-300">{fmtDate(detail.created_at)}</span>
          </div>
          <div>
            <span className="block">{t("detail_created_by")}</span>
            <span className="text-ink-700 dark:text-ink-300">{detail.created_by || "—"}</span>
          </div>
          {detail.confirmed_at && (
            <div>
              <span className="block">{t("detail_confirmed_at")}</span>
              <span className="text-ink-700 dark:text-ink-300">{fmtDate(detail.confirmed_at)}</span>
            </div>
          )}
          {detail.confirmed_by && (
            <div>
              <span className="block">{t("detail_confirmed_by")}</span>
              <span className="text-ink-700 dark:text-ink-300">{detail.confirmed_by}</span>
            </div>
          )}
        </div>
      </Card>

      <Card padding="none">
        <CardHeader title={t("detail_items")} />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-ink-50 dark:bg-ink-900">
              <tr className="text-ink-500 dark:text-ink-400 text-[11px] uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60">
                <th className="px-4 py-2 text-left font-medium">{t("col_product")}</th>
                <th className="px-4 py-2 text-right font-medium w-32">{t("qty")}</th>
                {hasValue && <th className="px-4 py-2 text-right font-medium w-36">{t("col_unit_cost")}</th>}
                {hasValue && <th className="px-4 py-2 text-right font-medium w-36">= </th>}
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => {
                const lineTotal = Number(item.quantity || 0) * Number(item.unit_cost || 0);
                return (
                  <tr key={item.product_id} className="border-b border-ink-100 dark:border-ink-800/40 last:border-0 hover:bg-ink-50/60 dark:hover:bg-ink-900/30">
                    <td className="px-4 py-2.5 text-ink-800 dark:text-ink-200">{item.product_name}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmtNum(item.quantity)}</td>
                    {hasValue && <td className="px-4 py-2.5 text-right font-mono">{item.unit_cost ? fmtNum(item.unit_cost) : "—"}</td>}
                    {hasValue && <td className="px-4 py-2.5 text-right font-mono">{item.unit_cost ? fmtNum(lineTotal.toString()) : "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-ink-50 dark:bg-ink-900 border-t border-ink-200/60 dark:border-ink-800/60">
              <tr>
                <td className="px-4 py-2.5 text-[12px] font-semibold text-ink-600 dark:text-ink-400">{t("total_qty")}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-ink-900 dark:text-ink-100">
                  {totalQty.toLocaleString("ru-RU", { maximumFractionDigits: 4 })}
                </td>
                {hasValue && <td className="px-4 py-2.5 text-right text-[12px] font-medium text-ink-500 dark:text-ink-400">{t("total_value")}</td>}
                {hasValue && (
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-ink-900 dark:text-ink-100">
                    {totalValue.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {detail.status !== "cancelled" && (
        <div className="flex flex-wrap gap-2">
          {detail.status === "draft" && (
            <>
              <Button
                variant="outline"
                onClick={() => router.push(`/warehouse/stock-in/${id}/edit`)}
              >
                {t("btn_edit")}
              </Button>
              <Button
                variant="success"
                onClick={() => setConfirmOpen(true)}
              >
                {t("btn_confirm")}
              </Button>
              <Button
                variant="danger"
                onClick={() => setDeleteOpen(true)}
              >
                {t("btn_delete")}
              </Button>
            </>
          )}
          {detail.status === "confirmed" && (
            <Button
              variant="outline"
              className="border-danger-500/40 text-danger-600 dark:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15"
              onClick={() => setCancelOpen(true)}
            >
              {t("btn_cancel")}
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title={t("confirm_title")}
        message={t("confirm_message")}
        confirmLabel={t("confirm_label")}
        cancelLabel={t("cancel_label")}
        variant="warning"
        loading={actionLoading}
      />

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        title={t("cancel_title")}
        message={t("cancel_message")}
        confirmLabel={t("confirm_label")}
        cancelLabel={t("cancel_label")}
        variant="danger"
        loading={actionLoading}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t("delete_title")}
        message={t("delete_message")}
        confirmLabel={t("btn_delete")}
        cancelLabel={t("cancel_label")}
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
