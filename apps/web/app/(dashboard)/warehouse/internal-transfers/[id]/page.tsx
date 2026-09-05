"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type TransferStatus = "draft" | "sent" | "received" | "cancelled";

type TransferItem = {
  product_id: string;
  product_name: string;
  qty: string;
  unit_id: number | null;
  unit_name: string | null;
  cost?: string;
};

type TransferDetail = {
  id: string;
  doc_number: string;
  from_warehouse: number;
  from_name: string;
  to_warehouse: number;
  to_name: string;
  status: TransferStatus;
  notes: string | null;
  created_at: string;
  sent_at: string | null;
  received_at: string | null;
  sent_by: string | null;
  received_by: string | null;
  items: TransferItem[];
};

type ActionKind = "send" | "receive" | "cancel";

function StatusBadge({ status, t }: { status: TransferStatus; t: (k: string) => string }) {
  const map: Record<TransferStatus, string> = {
    draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    sent: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    received: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  };
  const labelMap: Record<TransferStatus, string> = {
    draft: "status_draft",
    sent: "status_sent",
    received: "status_received",
    cancelled: "status_cancelled",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded text-[12px] font-semibold ${map[status]}`}>
      {t(labelMap[status])}
    </span>
  );
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

function fmtQty(v: string) {
  return parseFloat(v).toLocaleString("ru-RU", { maximumFractionDigits: 4 });
}

export default function TransferDetailPage() {
  const t = useTranslations("warehouse.transfers");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [transfer, setTransfer] = useState<TransferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<ActionKind | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<TransferDetail>(`/warehouse/transfers/${id}`);
      setTransfer(res.data);
    } catch (e) {
      setError(getErrorMessage(e, t("error_load")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleAction() {
    if (!confirm) return;
    setActionLoading(true);
    try {
      await api.post(`/warehouse/transfers/${id}/${confirm}`);
      const okMap: Record<ActionKind, string> = {
        send: t("sent_ok"),
        receive: t("received_ok"),
        cancel: t("cancelled_ok"),
      };
      toast.success(okMap[confirm]);
      setConfirm(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, t("error_load")));
    } finally {
      setActionLoading(false);
    }
  }

  const confirmTitles: Record<ActionKind, string> = {
    send: t("send_confirm_title"),
    receive: t("receive_confirm_title"),
    cancel: t("cancel_confirm_title"),
  };
  const confirmMsgs: Record<ActionKind, string> = {
    send: t("send_confirm_msg"),
    receive: t("receive_confirm_msg"),
    cancel: t("cancel_confirm_msg"),
  };

  if (loading) {
    return <div className="text-center py-12 text-ink-400 text-[13px]">{t("loading")}</div>;
  }
  if (error || !transfer) {
    return (
      <div className="text-center py-12 text-rose-600 text-[13px]">
        {error ?? t("error_load")}
      </div>
    );
  }

  const isReceived = transfer.status === "received";
  const canShowCost = isReceived;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.push("/warehouse/internal-transfers")}
          className="mt-1 p-1.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500 transition-colors shrink-0"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[clamp(16px,2.2vw,18px)] font-semibold text-ink-900 dark:text-ink-50 tracking-tight font-mono">
              {transfer.doc_number}
            </h1>
            <StatusBadge status={transfer.status} t={t} />
          </div>
          <div className="flex items-center gap-2 mt-1 text-[13px] text-ink-600 dark:text-ink-400">
            <span>{transfer.from_name}</span>
            <ArrowRight size={14} className="shrink-0" />
            <span>{transfer.to_name}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {transfer.status === "draft" && (
            <button
              onClick={() => setConfirm("send")}
              className="px-3 py-1.5 text-[13px] rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
            >
              {t("send_btn")}
            </button>
          )}
          {transfer.status === "sent" && (
            <button
              onClick={() => setConfirm("receive")}
              className="px-3 py-1.5 text-[13px] rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
            >
              {t("receive_btn")}
            </button>
          )}
          {(transfer.status === "draft" || transfer.status === "sent") && (
            <button
              onClick={() => setConfirm("cancel")}
              className="px-3 py-1.5 text-[13px] rounded-md border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 font-medium transition-colors"
            >
              {t("cancel_transfer_btn")}
            </button>
          )}
        </div>
      </div>

      {/* Meta info grid */}
      <div className="rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetaRow label={t("detail_from")} value={transfer.from_name} />
          <MetaRow label={t("detail_to")} value={transfer.to_name} />
          <MetaRow label={t("detail_status")} value={<StatusBadge status={transfer.status} t={t} />} />
          <MetaRow label={t("detail_created_at")} value={fmtDate(transfer.created_at)} />
          {transfer.sent_at && <MetaRow label={t("detail_sent_at")} value={fmtDate(transfer.sent_at)} />}
          {transfer.received_at && <MetaRow label={t("detail_received_at")} value={fmtDate(transfer.received_at)} />}
          {transfer.sent_by && <MetaRow label={t("detail_sent_by")} value={transfer.sent_by} />}
          {transfer.received_by && <MetaRow label={t("detail_received_by")} value={transfer.received_by} />}
          {transfer.notes && <MetaRow label={t("detail_notes")} value={transfer.notes} />}
        </div>
      </div>

      {/* Items table */}
      <div className="rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 space-y-3">
        <h2 className="text-[14px] font-semibold text-ink-900 dark:text-ink-100">{t("detail_items")}</h2>

        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-ink-50 dark:bg-ink-900/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400">{t("col_product")}</th>
                <th className="px-3 py-2 text-right font-medium text-ink-600 dark:text-ink-400 w-28">{t("col_qty")}</th>
                <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400 w-24">{t("col_unit")}</th>
                {canShowCost && (
                  <th className="px-3 py-2 text-right font-medium text-ink-600 dark:text-ink-400 w-32">{t("col_cost")}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200/60 dark:divide-ink-800/60">
              {transfer.items.map((it) => (
                <tr key={it.product_id} className="hover:bg-ink-50/50 dark:hover:bg-ink-900/20 transition-colors">
                  <td className="px-3 py-2 text-ink-900 dark:text-ink-100">{it.product_name}</td>
                  <td className="px-3 py-2 text-right font-mono text-ink-700 dark:text-ink-300">{fmtQty(it.qty)}</td>
                  <td className="px-3 py-2 text-ink-500 dark:text-ink-400">{it.unit_name ?? "—"}</td>
                  {canShowCost && (
                    <td className="px-3 py-2 text-right font-mono text-ink-700 dark:text-ink-300">
                      {it.cost ? parseFloat(it.cost).toLocaleString("ru-RU") : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="md:hidden space-y-2">
          {transfer.items.map((it) => (
            <li key={it.product_id} className="flex items-center justify-between gap-2 py-2 border-b border-ink-200/60 dark:border-ink-800/60 last:border-0">
              <span className="text-[13px] text-ink-900 dark:text-ink-100 flex-1 min-w-0 truncate">{it.product_name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-mono text-[13px] text-ink-700 dark:text-ink-300">{fmtQty(it.qty)}</span>
                <span className="text-[12px] text-ink-500">{it.unit_name ?? ""}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          open={!!confirm}
          onClose={() => setConfirm(null)}
          onConfirm={handleAction}
          title={confirmTitles[confirm]}
          message={confirmMsgs[confirm]}
          confirmLabel={t("confirm_label")}
          cancelLabel={t("cancel_label")}
          variant={confirm === "cancel" ? "danger" : "warning"}
          loading={actionLoading}
        />
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] font-medium text-ink-500 dark:text-ink-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-[13px] text-ink-900 dark:text-ink-100">{value}</dd>
    </div>
  );
}
