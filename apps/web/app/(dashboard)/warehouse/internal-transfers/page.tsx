"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

type TransferStatus = "draft" | "sent" | "received" | "cancelled";

type Transfer = {
  id: string;
  doc_number: string;
  from_warehouse: number;
  from_name: string;
  to_warehouse: number;
  to_name: string;
  status: TransferStatus;
  item_count: number;
  created_by_name: string | null;
  created_at: string;
  sent_at: string | null;
  received_at: string | null;
};

type Warehouse = { id: number; name: string };

type PaginatedTransfers = {
  items: Transfer[];
  total: number;
  page: number;
  limit: number;
};

const STATUS_TABS: Array<{ key: "all" | TransferStatus; i18nKey: string }> = [
  { key: "all", i18nKey: "status_all" },
  { key: "draft", i18nKey: "status_draft" },
  { key: "sent", i18nKey: "status_sent" },
  { key: "received", i18nKey: "status_received" },
  { key: "cancelled", i18nKey: "status_cancelled" },
];

const STATUS_TONE: Record<TransferStatus, "neutral" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  sent: "warning",
  received: "success",
  cancelled: "danger",
};

function statusBadge(status: TransferStatus, t: (k: string) => string) {
  const labelMap: Record<TransferStatus, string> = {
    draft: "status_draft",
    sent: "status_sent",
    received: "status_received",
    cancelled: "status_cancelled",
  };
  return <Badge tone={STATUS_TONE[status]}>{t(labelMap[status])}</Badge>;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("ru-RU");
}

type ActionState = {
  id: string;
  action: "send" | "receive" | "cancel";
} | null;

export default function InternalTransfersPage() {
  const t = useTranslations("warehouse.transfers");
  const router = useRouter();

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | TransferStatus>("all");
  const [fromWh, setFromWh] = useState<number | "">("");
  const [toWh, setToWh] = useState<number | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [actionState, setActionState] = useState<ActionState>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (fromWh) params.from_warehouse = fromWh;
      if (toWh) params.to_warehouse = toWh;
      const res = await api.get<PaginatedTransfers>("/warehouse/transfers", { params });
      setTransfers(res.data.items);
    } catch (e) {
      setError(getErrorMessage(e, t("error_load")));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, fromWh, toWh]);

  useEffect(() => {
    api.get<Warehouse[]>("/warehouse/warehouses").then((r) => setWarehouses(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAction() {
    if (!actionState) return;
    setActionLoading(true);
    try {
      await api.post(`/warehouse/transfers/${actionState.id}/${actionState.action}`);
      const okMap = { send: t("sent_ok"), receive: t("received_ok"), cancel: t("cancelled_ok") };
      toast.success(okMap[actionState.action]);
      setActionState(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, t("error_load")));
    } finally {
      setActionLoading(false);
    }
  }

  const confirmTitles = {
    send: t("send_confirm_title"),
    receive: t("receive_confirm_title"),
    cancel: t("cancel_confirm_title"),
  };
  const confirmMsgs = {
    send: t("send_confirm_msg"),
    receive: t("receive_confirm_msg"),
    cancel: t("cancel_confirm_msg"),
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        onCreate={() => router.push("/warehouse/internal-transfers/new")}
        createLabel={t("new_btn")}
      />

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap border-b border-ink-200 dark:border-ink-800">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
              statusFilter === tab.key
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-ink-500 hover:text-ink-900 dark:hover:text-ink-100"
            }`}
          >
            {t(tab.i18nKey)}
          </button>
        ))}
      </div>

      {/* Filter panel toggle (mobile-friendly) */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          iconRight={filtersOpen ? ChevronUp : ChevronDown}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          {t("filter_collapse")}
        </Button>

        {filtersOpen && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-lg border border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-900/30">
            <div className="space-y-1">
              <label className="text-[12px] text-ink-600 dark:text-ink-400 font-medium">{t("filter_from_wh")}</label>
              <select
                value={fromWh}
                onChange={(e) => setFromWh(e.target.value ? Number(e.target.value) : "")}
                className="w-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-brand-500"
              >
                <option value="">{t("filter_wh_all")}</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[12px] text-ink-600 dark:text-ink-400 font-medium">{t("filter_to_wh")}</label>
              <select
                value={toWh}
                onChange={(e) => setToWh(e.target.value ? Number(e.target.value) : "")}
                className="w-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-brand-500"
              >
                <option value="">{t("filter_wh_all")}</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[12px] text-ink-600 dark:text-ink-400 font-medium">{t("filter_date_from")}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[12px] text-ink-600 dark:text-ink-400 font-medium">{t("filter_date_to")}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Loading / Error / Empty */}
      {loading && (
        <div className="text-center py-12 text-ink-400 text-[13px]">{t("loading")}</div>
      )}
      {!loading && error && (
        <div className="text-center py-12 text-danger-600 dark:text-danger-500 text-[13px]">{error}</div>
      )}
      {!loading && !error && transfers.length === 0 && (
        <div className="text-center py-12 text-ink-400 text-[13px]">{t("empty")}</div>
      )}

      {/* Desktop table */}
      {!loading && !error && transfers.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-ink-200 dark:border-ink-800">
            <table className="w-full text-[13px]">
              <thead className="bg-ink-50 dark:bg-ink-900/40">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-ink-600 dark:text-ink-400 whitespace-nowrap">{t("col_doc")}</th>
                  <th className="px-4 py-3 text-left font-medium text-ink-600 dark:text-ink-400">{t("col_from")}</th>
                  <th className="px-4 py-3 text-left font-medium text-ink-600 dark:text-ink-400">{t("col_to")}</th>
                  <th className="px-4 py-3 text-center font-medium text-ink-600 dark:text-ink-400 whitespace-nowrap">{t("col_items")}</th>
                  <th className="px-4 py-3 text-left font-medium text-ink-600 dark:text-ink-400 whitespace-nowrap">{t("col_status")}</th>
                  <th className="px-4 py-3 text-left font-medium text-ink-600 dark:text-ink-400 whitespace-nowrap">{t("col_created_by")}</th>
                  <th className="px-4 py-3 text-left font-medium text-ink-600 dark:text-ink-400 whitespace-nowrap">{t("col_created_at")}</th>
                  <th className="px-4 py-3 text-right font-medium text-ink-600 dark:text-ink-400">{t("col_actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-200/60 dark:divide-ink-800/60">
                {transfers.map((tr) => (
                  <tr key={tr.id} className="hover:bg-ink-50/50 dark:hover:bg-ink-900/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-brand-600 dark:text-brand-400">
                      <button
                        onClick={() => router.push(`/warehouse/internal-transfers/${tr.id}`)}
                        className="hover:underline"
                      >
                        {tr.doc_number}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-ink-900 dark:text-ink-100">{tr.from_name}</td>
                    <td className="px-4 py-3 text-ink-900 dark:text-ink-100">{tr.to_name}</td>
                    <td className="px-4 py-3 text-center text-ink-600 dark:text-ink-400">{tr.item_count}</td>
                    <td className="px-4 py-3">{statusBadge(tr.status, t)}</td>
                    <td className="px-4 py-3 text-ink-600 dark:text-ink-400">{tr.created_by_name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-600 dark:text-ink-400 whitespace-nowrap">{fmtDate(tr.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <RowActions tr={tr} onAction={setActionState} onView={() => router.push(`/warehouse/internal-transfers/${tr.id}`)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="md:hidden space-y-3">
            {transfers.map((tr) => (
              <li
                key={tr.id}
                className="rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => router.push(`/warehouse/internal-transfers/${tr.id}`)}
                    className="font-mono text-brand-600 dark:text-brand-400 text-[13px] hover:underline"
                  >
                    {tr.doc_number}
                  </button>
                  {statusBadge(tr.status, t)}
                </div>
                <div className="text-[13px] text-ink-700 dark:text-ink-300">
                  {tr.from_name} → {tr.to_name}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-ink-500">{fmtDate(tr.created_at)}</span>
                  <RowActions tr={tr} onAction={setActionState} onView={() => router.push(`/warehouse/internal-transfers/${tr.id}`)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Confirm dialog */}
      {actionState && (
        <ConfirmDialog
          open={!!actionState}
          onClose={() => setActionState(null)}
          onConfirm={handleAction}
          title={confirmTitles[actionState.action]}
          message={confirmMsgs[actionState.action]}
          confirmLabel={t("confirm_label")}
          cancelLabel={t("cancel_label")}
          variant={actionState.action === "cancel" ? "danger" : "warning"}
          loading={actionLoading}
        />
      )}
    </div>
  );
}

function RowActions({
  tr,
  onAction,
  onView,
}: {
  tr: Transfer;
  onAction: (s: ActionState) => void;
  onView: () => void;
}) {
  const t = useTranslations("warehouse.transfers");
  return (
    <div className="flex items-center gap-1 justify-end flex-wrap">
      <Button variant="outline" size="xs" onClick={onView}>
        {t("detail_title")}
      </Button>
      {tr.status === "draft" && (
        <Button
          variant="warning"
          size="xs"
          onClick={() => onAction({ id: tr.id, action: "send" })}
        >
          {t("send_btn")}
        </Button>
      )}
      {tr.status === "sent" && (
        <Button
          variant="success"
          size="xs"
          onClick={() => onAction({ id: tr.id, action: "receive" })}
        >
          {t("receive_btn")}
        </Button>
      )}
      {(tr.status === "draft" || tr.status === "sent") && (
        <Button
          variant="light"
          size="xs"
          className="bg-danger-50 hover:bg-danger-100 dark:bg-danger-500/15 dark:hover:bg-danger-500/25 text-danger-600 dark:text-danger-500"
          onClick={() => onAction({ id: tr.id, action: "cancel" })}
        >
          {t("cancel_transfer_btn")}
        </Button>
      )}
    </div>
  );
}
