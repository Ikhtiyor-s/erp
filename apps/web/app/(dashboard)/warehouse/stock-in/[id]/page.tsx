"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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

function statusBadge(status: StockInStatus, t: (k: string) => string) {
  const colorMap: Record<StockInStatus, string> = {
    draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  };
  const labelMap: Record<StockInStatus, string> = {
    draft: "status_draft",
    confirmed: "status_confirmed",
    cancelled: "status_cancelled",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded text-[12px] font-medium ${colorMap[status]}`}>
      {t(labelMap[status])}
    </span>
  );
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
        <button
          onClick={() => router.push("/warehouse/stock-in")}
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-500 hover:text-ink-900 dark:hover:text-ink-100"
        >
          <ArrowLeft size={14} /> {t("back_to_list")}
        </button>
        <div className="rounded-md bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-4 py-3 text-[13px] text-rose-700 dark:text-rose-300">
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
        <button
          onClick={() => router.push("/warehouse/stock-in")}
          className="p-1.5 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-[clamp(16px,2.2vw,18px)] font-semibold text-ink-900 dark:text-ink-50 tracking-tight">
          {t("detail_title")} — {detail.doc_number || detail.id.slice(0, 8)}
        </h1>
        {statusBadge(detail.status, t)}
      </div>

      <div className="bg-white dark:bg-ink-950 rounded-md border border-ink-200/60 dark:border-ink-800/60 p-5">
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
      </div>

      <div className="bg-white dark:bg-ink-950 rounded-md border border-ink-200/60 dark:border-ink-800/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-100 dark:border-ink-800">
          <h2 className="text-[14px] font-semibold text-ink-800 dark:text-ink-100">{t("detail_items")}</h2>
        </div>
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
      </div>

      {detail.status !== "cancelled" && (
        <div className="flex flex-wrap gap-2">
          {detail.status === "draft" && (
            <>
              <button
                onClick={() => router.push(`/warehouse/stock-in/${id}/edit`)}
                className="px-4 py-2 text-[13px] rounded-md border border-ink-300 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800"
              >
                {t("btn_edit")}
              </button>
              <button
                onClick={() => setConfirmOpen(true)}
                className="px-4 py-2 text-[13px] rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {t("btn_confirm")}
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                className="px-4 py-2 text-[13px] rounded-md bg-rose-600 text-white hover:bg-rose-700"
              >
                {t("btn_delete")}
              </button>
            </>
          )}
          {detail.status === "confirmed" && (
            <button
              onClick={() => setCancelOpen(true)}
              className="px-4 py-2 text-[13px] rounded-md border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
            >
              {t("btn_cancel")}
            </button>
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
