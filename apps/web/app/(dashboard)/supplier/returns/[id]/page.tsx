"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { useTranslations } from "next-intl";

type ReturnStatus = "draft" | "confirmed" | "cancelled";
type RefundMethod = "cash_refund" | "supplier_balance" | "replacement";

type ReturnItem = {
  product_id: string;
  product_name: string;
  quantity: string;
  unit_cost: string;
  amount: string;
};

type SupplierReturnDetail = {
  id: string;
  doc_number: string;
  supplier_id: string;
  supplier_name: string | null;
  warehouse_id: number;
  warehouse_name: string | null;
  original_purchase_id: string | null;
  reason: string | null;
  status: ReturnStatus;
  refund_method: RefundMethod | null;
  total_amount: string;
  created_by: string | null;
  created_by_name: string | null;
  confirmed_by: string | null;
  confirmed_by_name: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  items: ReturnItem[];
};

type ConfirmAction = "confirm" | "cancel" | "delete" | null;

const STATUS_TONE: Record<ReturnStatus, "neutral" | "success" | "danger"> = {
  draft: "neutral",
  confirmed: "success",
  cancelled: "danger",
};

function statusBadge(status: ReturnStatus, t: (k: string) => string) {
  const labelMap: Record<ReturnStatus, string> = {
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

function fmtAmount(v: string | null | undefined) {
  if (!v) return "0";
  return Number(v).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function refundMethodLabel(method: RefundMethod | null, t: (k: string) => string) {
  if (!method) return "—";
  const map: Record<RefundMethod, string> = {
    cash_refund: "refund_cash",
    supplier_balance: "refund_balance",
    replacement: "refund_replacement",
  };
  return t(map[method]);
}

export default function SupplierReturnDetailPage() {
  const t = useTranslations("supplier.returns");
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [detail, setDetail] = useState<SupplierReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ConfirmAction>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SupplierReturnDetail>(`/warehouse/supplier-returns/${id}`);
      setDetail(res.data);
    } catch (e) {
      setError(getErrorMessage(e, t("error_load")));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleAction() {
    if (!pendingAction || !detail) return;
    setActionLoading(true);
    try {
      if (pendingAction === "confirm") {
        await api.post(`/warehouse/supplier-returns/${id}/confirm`);
        toast.success(t("confirmed"));
      } else if (pendingAction === "cancel") {
        await api.post(`/warehouse/supplier-returns/${id}/cancel`);
        toast.success(t("cancelled"));
      } else if (pendingAction === "delete") {
        await api.delete(`/warehouse/supplier-returns/${id}`);
        toast.success(t("deleted"));
        router.push("/supplier/returns");
        return;
      }
      setPendingAction(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, t("error_action")));
    } finally {
      setActionLoading(false);
    }
  }

  const confirmConfig: Record<
    NonNullable<ConfirmAction>,
    { title: string; message: string; variant: "danger" | "warning" }
  > = {
    confirm: { title: t("confirm_title"), message: t("confirm_message"), variant: "warning" },
    cancel: { title: t("cancel_title"), message: t("cancel_message"), variant: "danger" },
    delete: { title: t("delete_title"), message: t("delete_message"), variant: "danger" },
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => router.push("/supplier/returns")} />
        <h1 className="text-xl font-semibold text-ink-900 dark:text-ink-100">{t("detail_title")}</h1>
      </div>

      {loading && (
        <div className="text-center py-16 text-ink-400 text-[13px]">{t("loading")}</div>
      )}
      {!loading && error && (
        <div className="rounded-md bg-danger-50 dark:bg-danger-500/15 border border-danger-500/30 px-4 py-3 text-[13px] text-danger-700 dark:text-danger-500">
          {error}
        </div>
      )}

      {!loading && !error && detail && (
        <>
          {/* Header card */}
          <Card padding="lg" className="space-y-4">
            <div className="flex flex-wrap items-start gap-4 justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[18px] font-semibold text-ink-900 dark:text-ink-100">
                    {detail.doc_number || detail.id.slice(0, 8)}
                  </span>
                  {statusBadge(detail.status, t)}
                </div>
                <p className="text-[13px] text-ink-500">
                  {t("refund_method")}: <span className="font-medium">{refundMethodLabel(detail.refund_method, t)}</span>
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {detail.status === "draft" && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/supplier/returns/${id}/edit`)}>
                      {t("btn_edit")}
                    </Button>
                    <Button variant="success" size="sm" onClick={() => setPendingAction("confirm")}>
                      {t("btn_confirm")}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setPendingAction("delete")}>
                      {t("btn_delete")}
                    </Button>
                  </>
                )}
                {detail.status === "confirmed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-danger-500/40 text-danger-600 dark:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15"
                    onClick={() => setPendingAction("cancel")}
                  >
                    {t("btn_cancel")}
                  </Button>
                )}
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-ink-100 dark:border-ink-800">
              <div>
                <p className="text-[11px] text-ink-500 uppercase tracking-wide">{t("col_supplier")}</p>
                <p className="text-[14px] text-ink-900 dark:text-ink-100 mt-0.5">{detail.supplier_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-ink-500 uppercase tracking-wide">{t("col_warehouse")}</p>
                <p className="text-[14px] text-ink-900 dark:text-ink-100 mt-0.5">{detail.warehouse_name ?? "—"}</p>
              </div>
              {detail.reason && (
                <div className="sm:col-span-2 lg:col-span-1">
                  <p className="text-[11px] text-ink-500 uppercase tracking-wide">{t("reason")}</p>
                  <p className="text-[14px] text-ink-900 dark:text-ink-100 mt-0.5">{detail.reason}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Items table */}
          <Card padding="none">
            <CardHeader title={t("items")} />

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-ink-50/60 dark:bg-ink-900/20">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-ink-600 dark:text-ink-400">{t("col_product")}</th>
                    <th className="text-right px-4 py-2.5 font-medium text-ink-600 dark:text-ink-400 w-28">{t("col_qty")}</th>
                    <th className="text-right px-4 py-2.5 font-medium text-ink-600 dark:text-ink-400 w-36">{t("col_unit_cost")}</th>
                    <th className="text-right px-4 py-2.5 font-medium text-ink-600 dark:text-ink-400 w-36">{t("col_total")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-200/60 dark:divide-ink-800/60">
                  {detail.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-ink-50/30 dark:hover:bg-ink-900/10">
                      <td className="px-4 py-3 text-ink-900 dark:text-ink-100">{item.product_name}</td>
                      <td className="px-4 py-3 text-right font-mono">{Number(item.quantity).toLocaleString("ru-RU", { maximumFractionDigits: 3 })}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmtAmount(item.unit_cost)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{fmtAmount(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-ink-50 dark:bg-ink-900/40 font-semibold">
                    <td className="px-4 py-3" colSpan={3}>{t("total_refund")}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-900 dark:text-ink-100">
                      {fmtAmount(detail.total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile items */}
            <ul className="md:hidden divide-y divide-ink-200/60 dark:divide-ink-800/60">
              {detail.items.map((item, idx) => (
                <li key={idx} className="px-4 py-3 space-y-1">
                  <p className="text-[13px] font-medium text-ink-900 dark:text-ink-100">{item.product_name}</p>
                  <div className="flex justify-between text-[12px] text-ink-600 dark:text-ink-400">
                    <span>{Number(item.quantity).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} × {fmtAmount(item.unit_cost)}</span>
                    <span className="font-mono font-semibold">{fmtAmount(item.amount)}</span>
                  </div>
                </li>
              ))}
              <li className="px-4 py-3 flex justify-between font-semibold text-[13px] bg-ink-50 dark:bg-ink-900/40">
                <span>{t("total_refund")}</span>
                <span className="font-mono">{fmtAmount(detail.total_amount)}</span>
              </li>
            </ul>
          </Card>

          {/* Audit info */}
          <Card padding="lg">
            <h3 className="text-[13px] font-semibold text-ink-700 dark:text-ink-300 mb-3">{t("audit_info")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[13px]">
              <div>
                <span className="text-ink-500">{t("created_by_label")}: </span>
                <span className="text-ink-900 dark:text-ink-100">{detail.created_by_name ?? "—"}</span>
              </div>
              <div>
                <span className="text-ink-500">{t("col_date")}: </span>
                <span className="text-ink-900 dark:text-ink-100">{fmtDate(detail.created_at)}</span>
              </div>
              {detail.confirmed_by_name && (
                <div>
                  <span className="text-ink-500">{t("confirmed_by_label")}: </span>
                  <span className="text-ink-900 dark:text-ink-100">{detail.confirmed_by_name}</span>
                </div>
              )}
              {detail.confirmed_at && (
                <div>
                  <span className="text-ink-500">{t("confirmed_at_label")}: </span>
                  <span className="text-ink-900 dark:text-ink-100">{fmtDate(detail.confirmed_at)}</span>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {/* Confirm dialog */}
      {pendingAction && (
        <ConfirmDialog
          open={!!pendingAction}
          onClose={() => setPendingAction(null)}
          onConfirm={handleAction}
          title={confirmConfig[pendingAction].title}
          message={confirmConfig[pendingAction].message}
          confirmLabel={t("confirm_label")}
          cancelLabel={t("cancel_label")}
          variant={confirmConfig[pendingAction].variant}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
