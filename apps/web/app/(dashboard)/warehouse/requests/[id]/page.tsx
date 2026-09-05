"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Package } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type RequestItem = {
  id: number;
  product_id: string;
  product_name: string;
  category_id: number | null;
  qty_requested: string;
  qty_on_hand: string;
};

type RequestDetail = {
  id: string;
  doc_number: string;
  from_warehouse: number;
  from_name: string;
  to_warehouse: number | null;
  to_name: string | null;
  status: "pending" | "approved" | "rejected" | "fulfilled";
  notes: string | null;
  requested_by_name: string | null;
  approved_by_name: string | null;
  created_at: string;
  updated_at: string;
  items: RequestItem[];
};

const STATUS_KEYS: Record<string, string> = {
  pending: "status_pending",
  approved: "status_approved",
  rejected: "status_rejected",
  fulfilled: "status_fulfilled",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400",
  fulfilled: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
};

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("request");
  const tc = useTranslations("common");

  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<RequestDetail>(`/warehouse/requests/${id}`);
      setDetail(data);
    } catch (e) {
      setError(getErrorMessage(e, t("load_error")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleAction() {
    if (!confirmAction || !detail) return;
    setActionLoading(true);
    try {
      await api.post(`/warehouse/requests/${detail.id}/${confirmAction}`);
      toast.success(confirmAction === "approve" ? t("approved") : t("rejected"));
      setConfirmAction(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-ink-400 dark:text-ink-600 text-sm animate-pulse">
        {tc("loading")}
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-rose-600 dark:text-rose-400 text-sm">{error ?? t("load_error")}</p>
        <button
          onClick={() => router.push("/warehouse/requests")}
          className="text-sm text-brand-600 hover:text-brand-700"
        >
          {tc("back")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/warehouse/requests")}
          className="p-1.5 rounded-md hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500 dark:text-ink-400 transition-colors"
          aria-label={tc("back")}
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[clamp(15px,2vw,17px)] font-semibold text-ink-900 dark:text-ink-50 tracking-tight font-mono">
              {detail.doc_number}
            </h1>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[detail.status] ?? ""}`}
            >
              {detail.status === "pending" && <Clock size={10} />}
              {detail.status === "approved" && <CheckCircle2 size={10} />}
              {detail.status === "rejected" && <XCircle size={10} />}
              {detail.status === "fulfilled" && <Package size={10} />}
              {t(STATUS_KEYS[detail.status] ?? "status_unknown")}
            </span>
          </div>
        </div>
        {detail.status === "pending" && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setConfirmAction("approve")}
              className="px-3 py-1.5 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              {t("approve")}
            </button>
            <button
              onClick={() => setConfirmAction("reject")}
              className="px-3 py-1.5 text-sm rounded-md bg-rose-600 hover:bg-rose-700 text-white transition-colors"
            >
              {t("reject")}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-ink-950 rounded-md border border-ink-200/60 dark:border-ink-800/60 p-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-[11px] text-ink-400 dark:text-ink-500 font-medium uppercase tracking-wider mb-0.5">
              {t("from_warehouse")}
            </dt>
            <dd className="text-ink-800 dark:text-ink-200">{detail.from_name}</dd>
          </div>
          {detail.to_name && (
            <div>
              <dt className="text-[11px] text-ink-400 dark:text-ink-500 font-medium uppercase tracking-wider mb-0.5">
                {t("to_warehouse")}
              </dt>
              <dd className="text-ink-800 dark:text-ink-200">{detail.to_name}</dd>
            </div>
          )}
          <div>
            <dt className="text-[11px] text-ink-400 dark:text-ink-500 font-medium uppercase tracking-wider mb-0.5">
              {t("requested_by")}
            </dt>
            <dd className="text-ink-800 dark:text-ink-200">{detail.requested_by_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-400 dark:text-ink-500 font-medium uppercase tracking-wider mb-0.5">
              {tc("date")}
            </dt>
            <dd className="text-ink-800 dark:text-ink-200">
              {new Date(detail.created_at).toLocaleString("uz-UZ")}
            </dd>
          </div>
          {detail.approved_by_name && (
            <div>
              <dt className="text-[11px] text-ink-400 dark:text-ink-500 font-medium uppercase tracking-wider mb-0.5">
                {t("approved_by")}
              </dt>
              <dd className="text-ink-800 dark:text-ink-200">{detail.approved_by_name}</dd>
            </div>
          )}
          {detail.notes && (
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-[11px] text-ink-400 dark:text-ink-500 font-medium uppercase tracking-wider mb-0.5">
                {tc("notes")}
              </dt>
              <dd className="text-ink-800 dark:text-ink-200 whitespace-pre-line">{detail.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="bg-white dark:bg-ink-950 rounded-md border border-ink-200/60 dark:border-ink-800/60 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] text-ink-500 uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60 bg-ink-50/50 dark:bg-ink-900/30">
                <th className="px-3 py-2 text-left">{t("product")}</th>
                <th className="px-3 py-2 text-right w-36">{t("qty_on_hand")}</th>
                <th className="px-3 py-2 text-right w-36">{t("qty_requested")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => {
                const exceedsSnapshot = parseFloat(item.qty_requested) > parseFloat(item.qty_on_hand);
                return (
                  <tr
                    key={item.id}
                    className="border-b border-ink-100 dark:border-ink-800/40 last:border-0 text-ink-700 dark:text-ink-300"
                  >
                    <td className="px-3 py-2">{item.product_name}</td>
                    <td className="px-3 py-2 text-right font-mono text-ink-500 dark:text-ink-400">
                      {parseFloat(item.qty_on_hand).toLocaleString()}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono font-medium ${
                        exceedsSnapshot ? "text-rose-600 dark:text-rose-400" : ""
                      }`}
                    >
                      {parseFloat(item.qty_requested).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ul className="md:hidden divide-y divide-ink-100 dark:divide-ink-800/40">
          {detail.items.map((item) => {
            const exceedsSnapshot = parseFloat(item.qty_requested) > parseFloat(item.qty_on_hand);
            return (
              <li key={item.id} className="px-3 py-2.5 space-y-1">
                <div className="text-sm font-medium text-ink-800 dark:text-ink-200">{item.product_name}</div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-ink-500 dark:text-ink-400">
                    {t("qty_on_hand")}: {parseFloat(item.qty_on_hand).toLocaleString()}
                  </span>
                  <span
                    className={`font-mono font-medium ${
                      exceedsSnapshot ? "text-rose-600 dark:text-rose-400" : "text-ink-700 dark:text-ink-300"
                    }`}
                  >
                    {t("qty_requested")}: {parseFloat(item.qty_requested).toLocaleString()}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <ConfirmDialog
        open={confirmAction === "approve"}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleAction}
        title={t("approve_title")}
        message={t("approve_message")}
        confirmLabel={t("approve")}
        cancelLabel={tc("cancel")}
        variant="warning"
        loading={actionLoading}
      />
      <ConfirmDialog
        open={confirmAction === "reject"}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleAction}
        title={t("reject_title")}
        message={t("reject_message")}
        confirmLabel={t("reject")}
        cancelLabel={tc("cancel")}
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
