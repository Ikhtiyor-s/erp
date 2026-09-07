"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Clock, Package } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type RequestRow = {
  id: string;
  doc_number: string;
  from_warehouse: number;
  from_name: string;
  to_warehouse: number | null;
  to_name: string | null;
  status: "pending" | "approved" | "rejected" | "fulfilled";
  item_count: number;
  requested_by_name: string | null;
  created_at: string;
};

type ListResponse = {
  items: RequestRow[];
  total: number;
  page: number;
  limit: number;
};

const STATUS_KEYS: Record<string, string> = {
  pending: "status_pending",
  approved: "status_approved",
  rejected: "status_rejected",
  fulfilled: "status_fulfilled",
};

const STATUS_TONE: Record<string, "warning" | "success" | "danger" | "info"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  fulfilled: "info",
};

const TABS = ["all", "pending", "approved", "rejected", "fulfilled"] as const;

export default function ProductRequestsPage() {
  const t = useTranslations("request");
  const tc = useTranslations("common");
  const router = useRouter();

  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("all");

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "100" };
      if (activeTab !== "all") params.status = activeTab;
      const { data } = await api.get<ListResponse>("/warehouse/requests", { params });
      setRows(data.items);
    } catch (e) {
      toast.error(getErrorMessage(e, t("load_error")));
    } finally {
      setLoading(false);
    }
  }, [activeTab, t]);

  useEffect(() => { load(); }, [load]);

  async function handleAction() {
    if (!confirmId || !confirmAction) return;
    setActionLoading(true);
    try {
      await api.post(`/warehouse/requests/${confirmId}/${confirmAction}`);
      toast.success(confirmAction === "approve" ? t("approved") : t("rejected"));
      setConfirmId(null);
      setConfirmAction(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setActionLoading(false);
    }
  }

  const columns: Column<RequestRow>[] = [
    {
      key: "doc_number",
      header: t("doc_number"),
      width: "130px",
      render: (r) => (
        <span className="font-mono text-[12px] text-brand-700 dark:text-brand-400">
          {r.doc_number || r.id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "from_name",
      header: t("from_warehouse"),
      render: (r) => (
        <span className="text-sm">
          {r.from_name}
          {r.to_name && (
            <span className="text-ink-400 dark:text-ink-500"> → {r.to_name}</span>
          )}
        </span>
      ),
    },
    { key: "item_count", header: t("item_count"), width: "80px", align: "right" },
    {
      key: "status",
      header: tc("status"),
      width: "130px",
      render: (r) => (
        <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
          {r.status === "pending" && <Clock size={10} />}
          {r.status === "approved" && <CheckCircle2 size={10} />}
          {r.status === "rejected" && <XCircle size={10} />}
          {r.status === "fulfilled" && <Package size={10} />}
          {t(STATUS_KEYS[r.status] ?? "status_unknown")}
        </Badge>
      ),
    },
    {
      key: "requested_by_name",
      header: t("requested_by"),
      render: (r) => <span className="text-ink-600 dark:text-ink-400">{r.requested_by_name ?? "—"}</span>,
    },
    {
      key: "created_at",
      header: tc("date"),
      width: "120px",
      render: (r) => new Date(r.created_at).toLocaleDateString("uz-UZ"),
    },
    {
      key: "actions_col" as keyof RequestRow,
      header: "",
      width: "160px",
      render: (r) =>
        r.status === "pending" ? (
          <div className="flex gap-1">
            <Button
              variant="success"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmId(r.id);
                setConfirmAction("approve");
              }}
            >
              {t("approve")}
            </Button>
            <Button
              variant="danger"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmId(r.id);
                setConfirmAction("reject");
              }}
            >
              {t("reject")}
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        onCreate={() => router.push("/warehouse/requests/new")}
        createLabel={t("create")}
      />

      <div className="flex gap-1 border-b border-ink-200 dark:border-ink-800 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? "border-brand-600 text-brand-700 dark:text-brand-400"
                : "border-transparent text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200"
            }`}
          >
            {tab === "all" ? tc("all") : t(STATUS_KEYS[tab])}
          </button>
        ))}
      </div>

      <div className="hidden md:block">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyText={t("empty")}
          onRowClick={(r) => router.push(`/warehouse/requests/${r.id}`)}
        />
      </div>

      <ul className="md:hidden space-y-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="bg-white dark:bg-ink-950 border border-ink-200/60 dark:border-ink-800/60 rounded-md p-3 space-y-1.5 animate-pulse">
                <div className="h-3 w-32 bg-ink-100 dark:bg-ink-800 rounded" />
                <div className="h-3 w-48 bg-ink-100 dark:bg-ink-800 rounded" />
              </li>
            ))
          : rows.length === 0
          ? (
              <li className="text-center py-10 text-ink-400 dark:text-ink-600 text-sm">
                {t("empty")}
              </li>
            )
          : rows.map((r) => (
              <li
                key={r.id}
                onClick={() => router.push(`/warehouse/requests/${r.id}`)}
                className="bg-white dark:bg-ink-950 border border-ink-200/60 dark:border-ink-800/60 rounded-md p-3 cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-900/40 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] text-brand-700 dark:text-brand-400">
                    {r.doc_number || r.id.slice(0, 8)}
                  </span>
                  <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
                    {t(STATUS_KEYS[r.status] ?? "status_unknown")}
                  </Badge>
                </div>
                <div className="text-sm text-ink-700 dark:text-ink-300">{r.from_name}</div>
                <div className="flex items-center justify-between text-[12px] text-ink-500 dark:text-ink-400">
                  <span>{r.requested_by_name ?? "—"}</span>
                  <span>{new Date(r.created_at).toLocaleDateString("uz-UZ")}</span>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-1 pt-1">
                    <Button
                      variant="success"
                      size="sm"
                      fullWidth
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmId(r.id);
                        setConfirmAction("approve");
                      }}
                    >
                      {t("approve")}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      fullWidth
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmId(r.id);
                        setConfirmAction("reject");
                      }}
                    >
                      {t("reject")}
                    </Button>
                  </div>
                )}
              </li>
            ))}
      </ul>

      <ConfirmDialog
        open={!!confirmId && confirmAction === "approve"}
        onClose={() => { setConfirmId(null); setConfirmAction(null); }}
        onConfirm={handleAction}
        title={t("approve_title")}
        message={t("approve_message")}
        confirmLabel={t("approve")}
        cancelLabel={tc("cancel")}
        variant="warning"
        loading={actionLoading}
      />
      <ConfirmDialog
        open={!!confirmId && confirmAction === "reject"}
        onClose={() => { setConfirmId(null); setConfirmAction(null); }}
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
