"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Clock, Pause, Play, CheckCircle, XCircle, RotateCcw, History, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { Modal, Field, input } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type InventoryStatus =
  | "draft"
  | "in_progress"
  | "paused"
  | "pending_confirmation"
  | "completed"
  | "cancelled";

type InventoryHead = {
  id: string;
  doc_number: string | null;
  warehouse_id: number;
  warehouse_name: string | null;
  status: InventoryStatus;
  blind_count: boolean;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
};

type InventoryItem = {
  product_id: string;
  product_name: string;
  expected_qty: string | null;
  actual_qty: string;
  diff_qty: string;
  notes: string | null;
};

type ScanEvent = {
  id: string;
  user_name: string | null;
  quantity: string;
  scanned_at: string;
  device_id: string | null;
};

type Product = { id: string; name: string; sku?: string };

const STATUS_COLORS: Record<InventoryStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  paused: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  pending_confirmation: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const fmt = (v: string | number | null | undefined) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 3 });

export default function InventoryDetailPage() {
  const t = useTranslations("warehouse.inventory");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [head, setHead] = useState<InventoryHead | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const [scanHistoryProduct, setScanHistoryProduct] = useState<InventoryItem | null>(null);
  const [scanEvents, setScanEvents] = useState<ScanEvent[]>([]);
  const [scanEventsLoading, setScanEventsLoading] = useState(false);
  const [undoTarget, setUndoTarget] = useState<ScanEvent | null>(null);

  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanProductSearch, setScanProductSearch] = useState("");
  const [scanProductOptions, setScanProductOptions] = useState<Product[]>([]);
  const [scanProductId, setScanProductId] = useState("");
  const [scanProductName, setScanProductName] = useState("");
  const [scanBarcode, setScanBarcode] = useState("");
  const [scanQty, setScanQty] = useState("1");
  const [scanDevice, setScanDevice] = useState("");
  const [scanSaving, setScanSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/warehouse/inventories/${id}`);
      setHead(data.head ?? data);
      setItems(data.items ?? []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, t("detail_error")));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (scanProductSearch.length < 2) { setScanProductOptions([]); return; }
    const timer = setTimeout(() => {
      api
        .get<Product[]>(`/warehouse/products?q=${encodeURIComponent(scanProductSearch)}`)
        .then((r) => setScanProductOptions(r.data.slice(0, 10)))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [scanProductSearch]);

  async function doAction(action: string, successKey: string) {
    setActionLoading(true);
    try {
      await api.post(`/warehouse/inventories/${id}/${action}`);
      toast.success(t(successKey as Parameters<typeof t>[0]));
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, t("load_error")));
    } finally {
      setActionLoading(false);
    }
  }

  async function openScanHistory(item: InventoryItem) {
    setScanHistoryProduct(item);
    setScanEventsLoading(true);
    try {
      const { data } = await api.get(`/warehouse/inventories/${id}/scan-events`, {
        params: { product_id: item.product_id },
      });
      setScanEvents(Array.isArray(data) ? data : data.items ?? []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, t("load_error")));
    } finally {
      setScanEventsLoading(false);
    }
  }

  async function doUndoScan() {
    if (!undoTarget) return;
    try {
      await api.delete(`/warehouse/inventories/${id}/scan-events/${undoTarget.id}`);
      toast.success(t("scan_deleted_ok"));
      setUndoTarget(null);
      if (scanHistoryProduct) await openScanHistory(scanHistoryProduct);
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, t("load_error")));
    }
  }

  function pickScanProduct(p: Product) {
    setScanProductId(p.id);
    setScanProductName(p.name);
    setScanProductSearch("");
    setScanProductOptions([]);
  }

  function openScanModal() {
    setScanProductId("");
    setScanProductName("");
    setScanBarcode("");
    setScanQty("1");
    setScanDevice("");
    setScanProductSearch("");
    setScanProductOptions([]);
    setScanModalOpen(true);
  }

  async function submitScan() {
    if (!scanProductId) { toast.error(t("scan_product_label")); return; }
    const qty = parseFloat(scanQty);
    if (!qty || qty <= 0) { toast.error(t("scan_qty_label")); return; }
    setScanSaving(true);
    try {
      await api.post(`/warehouse/inventories/${id}/scan-events`, {
        product_id: scanProductId,
        quantity: qty,
        barcode: scanBarcode || undefined,
        device_id: scanDevice || undefined,
      });
      toast.success(t("scan_added_ok", { qty: fmt(qty), name: scanProductName }));
      setScanModalOpen(false);
      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, t("load_error")));
    } finally {
      setScanSaving(false);
    }
  }

  const countedItems = items.filter((i) => Number(i.actual_qty) > 0).length;
  const isReadOnly = head?.status === "completed" || head?.status === "cancelled";
  const canScan = head?.status === "in_progress";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-ink-400 dark:text-ink-500">
        {t("load_error").length > 0 && "..."}
      </div>
    );
  }

  if (!head) {
    return (
      <div className="flex items-center justify-center h-48 text-rose-500">
        {t("detail_error")}
      </div>
    );
  }

  const statusLabel = t(`status_${head.status}` as Parameters<typeof t>[0]);
  const statusClass = STATUS_COLORS[head.status] ?? STATUS_COLORS.draft;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold truncate">
              {head.doc_number || id.slice(0, 8)}
            </h1>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusClass}`}>
              {statusLabel}
            </span>
            {head.blind_count && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                {t("blind_count_badge")}
              </span>
            )}
          </div>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
            {head.warehouse_name ?? "—"}
          </p>
        </div>
      </div>

      {!isReadOnly && (
        <div className="flex flex-wrap gap-2">
          {head.status === "draft" && (
            <button
              disabled={actionLoading}
              onClick={() => doAction("start", "started_ok")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Play size={14} /> {t("action_start")}
            </button>
          )}
          {head.status === "in_progress" && (
            <>
              <button
                disabled={actionLoading}
                onClick={() => doAction("pause", "paused_ok")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-ink-300 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50"
              >
                <Pause size={14} /> {t("action_pause")}
              </button>
              <button
                disabled={actionLoading}
                onClick={() => doAction("submit", "submitted_ok")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                <CheckCircle size={14} /> {t("action_submit")}
              </button>
            </>
          )}
          {head.status === "paused" && (
            <>
              <button
                disabled={actionLoading}
                onClick={() => doAction("resume", "resumed_ok")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Play size={14} /> {t("action_resume")}
              </button>
              <button
                disabled={actionLoading}
                onClick={() => setCancelOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50"
              >
                <XCircle size={14} /> {t("action_cancel")}
              </button>
            </>
          )}
          {head.status === "pending_confirmation" && (
            <>
              <button
                disabled={actionLoading}
                onClick={() => setConfirmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle size={14} /> {t("action_confirm")}
              </button>
              <button
                disabled={actionLoading}
                onClick={() => setRejectOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-ink-300 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50"
              >
                <RotateCcw size={14} /> {t("action_reject")}
              </button>
            </>
          )}
          {(head.status === "draft" || head.status === "in_progress") && (
            <button
              disabled={actionLoading}
              onClick={() => setCancelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50"
            >
              <XCircle size={14} /> {t("action_cancel")}
            </button>
          )}
        </div>
      )}

      {isReadOnly && (
        <div className="rounded-md bg-ink-50 dark:bg-ink-900/40 border border-ink-200 dark:border-ink-800 px-4 py-3 text-sm text-ink-500 dark:text-ink-400">
          {head.status === "completed" ? t("read_only_completed") : t("read_only_cancelled")}
        </div>
      )}

      <div className="rounded-md bg-ink-50 dark:bg-ink-900/40 border border-ink-200 dark:border-ink-800 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-ink-600 dark:text-ink-400">
          <Clock size={14} />
          <span>{t("progress")}: </span>
          <span className="font-semibold text-ink-900 dark:text-ink-100">
            {t("progress_label", { done: countedItems, total: items.length })}
          </span>
        </div>
        {items.length > 0 && (
          <div className="mt-2 h-2 rounded-full bg-ink-200 dark:bg-ink-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(countedItems / items.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">{t("items_title")}</h2>
          {canScan && (
            <button
              onClick={openScanModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700"
            >
              <Plus size={14} /> {t("scan_add")}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-ink-400 dark:text-ink-500 py-6 text-center">{t("items_empty")}</p>
        ) : (
          <div className="hidden md:block border rounded-md overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900/40 text-ink-500 dark:text-ink-400">
                <tr>
                  <th className="px-3 py-2 text-left">{t("col_product")}</th>
                  {!head.blind_count && <th className="px-3 py-2 text-right w-28">{t("col_expected")}</th>}
                  <th className="px-3 py-2 text-right w-28">{t("col_actual")}</th>
                  {!head.blind_count && <th className="px-3 py-2 text-right w-28">{t("col_variance")}</th>}
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const diff = Number(item.diff_qty);
                  const diffClass =
                    diff < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : diff > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-zinc-400";
                  return (
                    <tr key={item.product_id} className="border-t hover:bg-ink-50/50 dark:hover:bg-ink-900/20">
                      <td className="px-3 py-2 font-medium">{item.product_name}</td>
                      {!head.blind_count && (
                        <td className="px-3 py-2 text-right font-mono text-ink-500">
                          {item.expected_qty != null ? fmt(item.expected_qty) : "—"}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right font-mono">{fmt(item.actual_qty)}</td>
                      {!head.blind_count && (
                        <td className={`px-3 py-2 text-right font-mono ${diffClass}`}>
                          {diff > 0 ? `+${fmt(diff)}` : fmt(diff)}
                        </td>
                      )}
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => openScanHistory(item)}
                          title={t("scan_history")}
                          className="p-1 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400"
                        >
                          <History size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <ul className="md:hidden space-y-2">
          {items.map((item) => {
            const diff = Number(item.diff_qty);
            const diffClass =
              diff < 0
                ? "text-rose-600"
                : diff > 0
                ? "text-amber-600"
                : "text-zinc-400";
            return (
              <li key={item.product_id} className="border rounded-md px-3 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{item.product_name}</span>
                  <button
                    onClick={() => openScanHistory(item)}
                    className="p-1 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400"
                  >
                    <History size={14} />
                  </button>
                </div>
                <div className="flex gap-4 text-xs text-ink-500 dark:text-ink-400">
                  {!head.blind_count && (
                    <span>
                      {t("col_expected")}: <span className="font-mono">{item.expected_qty != null ? fmt(item.expected_qty) : "—"}</span>
                    </span>
                  )}
                  <span>
                    {t("col_actual")}: <span className="font-mono">{fmt(item.actual_qty)}</span>
                  </span>
                  {!head.blind_count && (
                    <span className={diffClass}>
                      {t("col_variance")}: <span className="font-mono">{diff > 0 ? `+${fmt(diff)}` : fmt(diff)}</span>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); doAction("confirm", "confirmed_ok"); }}
        title={t("confirm_title")}
        message={t("confirm_warning_message")}
        confirmLabel={t("action_confirm")}
        variant="warning"
        loading={actionLoading}
      />

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => { setCancelOpen(false); doAction("cancel", "cancelled_ok"); }}
        title={t("cancel_title")}
        message={t("cancel_message")}
        confirmLabel={t("action_cancel")}
        variant="danger"
        loading={actionLoading}
      />

      <ConfirmDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={() => { setRejectOpen(false); doAction("reject", "rejected_ok"); }}
        title={t("reject_title")}
        message={t("reject_message")}
        confirmLabel={t("action_reject")}
        variant="warning"
        loading={actionLoading}
      />

      <ConfirmDialog
        open={!!undoTarget}
        onClose={() => setUndoTarget(null)}
        onConfirm={doUndoScan}
        title={t("scan_undo_title")}
        message={t("scan_undo_message")}
        confirmLabel={t("scan_undo")}
        variant="danger"
      />

      <Modal
        open={!!scanHistoryProduct}
        onClose={() => setScanHistoryProduct(null)}
        title={t("scan_history_title", { name: scanHistoryProduct?.product_name ?? "" })}
        size="lg"
      >
        {scanEventsLoading ? (
          <p className="text-sm text-ink-400 text-center py-6">{t("load_error")}</p>
        ) : scanEvents.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-6">{t("scan_empty")}</p>
        ) : (
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 dark:bg-ink-900/40 text-ink-500 dark:text-ink-400">
                <tr>
                  <th className="px-3 py-2 text-left">{t("col_user")}</th>
                  <th className="px-3 py-2 text-right w-24">{t("col_qty")}</th>
                  <th className="px-3 py-2 text-left w-40">{t("col_scanned_at")}</th>
                  <th className="px-3 py-2 text-left w-28">{t("col_device")}</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {scanEvents.map((ev) => (
                  <tr key={ev.id} className="border-t">
                    <td className="px-3 py-2">{ev.user_name ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(ev.quantity)}</td>
                    <td className="px-3 py-2 text-ink-500 text-xs">
                      {new Date(ev.scanned_at).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-3 py-2 text-ink-400 text-xs">{ev.device_id ?? "—"}</td>
                    <td className="px-3 py-2 text-center">
                      {canScan && (
                        <button
                          onClick={() => setUndoTarget(ev)}
                          className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500"
                          title={t("scan_undo")}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        title={t("scan_modal_title")}
        size="md"
      >
        <div className="space-y-3">
          <Field label={t("scan_product_label")} required>
            <div className="relative">
              <input
                className={input}
                placeholder={t("product_search")}
                value={scanProductName || scanProductSearch}
                onChange={(e) => {
                  setScanProductName("");
                  setScanProductId("");
                  setScanProductSearch(e.target.value);
                }}
              />
              {scanProductOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-md shadow-lg max-h-48 overflow-auto">
                  {scanProductOptions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickScanProduct(p)}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-ink-50 dark:hover:bg-ink-800"
                    >
                      {p.name} {p.sku && <span className="text-ink-400">({p.sku})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <Field label={t("scan_barcode_label")}>
            <input
              className={input}
              placeholder={t("scan_barcode_placeholder")}
              value={scanBarcode}
              onChange={(e) => setScanBarcode(e.target.value)}
            />
          </Field>

          <Field label={t("scan_qty_label")} required>
            <input
              type="number"
              step="0.001"
              min="0.001"
              className={input}
              value={scanQty}
              onChange={(e) => setScanQty(e.target.value)}
            />
          </Field>

          <Field label={t("scan_device_label")}>
            <input
              className={input}
              value={scanDevice}
              onChange={(e) => setScanDevice(e.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setScanModalOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-ink-300 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800"
            >
              {t("action_cancel")}
            </button>
            <button
              type="button"
              disabled={scanSaving}
              onClick={submitScan}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {scanSaving ? "..." : t("scan_save_btn")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
