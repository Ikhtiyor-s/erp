"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Reason = {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
};

export default function StockInReasonPage() {
  const t = useTranslations("warehouse.stock_in_reason");
  const tc = useTranslations("common");

  const [rows, setRows] = useState<Reason[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<Reason | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isActive, setIsActive] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<Reason[]>("/warehouse/stock-in-reasons");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditId(null);
    setName("");
    setCode("");
    setIsActive(true);
    setModalOpen(true);
  }

  function openEdit(r: Reason) {
    setEditId(r.id);
    setName(r.name);
    setCode(r.code || "");
    setIsActive(r.is_active);
    setModalOpen(true);
  }

  async function save() {
    if (!name.trim()) { toast.error(tc("name") + " " + tc("error")); return; }
    try {
      const payload = { name: name.trim(), code: code.trim() || null, is_active: isActive };
      if (editId) {
        await api.patch(`/warehouse/stock-in-reasons/${editId}`, payload);
      } else {
        await api.post("/warehouse/stock-in-reasons", payload);
      }
      toast.success(tc("saved"));
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateLoading(true);
    try {
      await api.delete(`/warehouse/stock-in-reasons/${deactivateTarget.id}`);
      toast.success(t("deactivated"));
      setDeactivateTarget(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setDeactivateLoading(false);
    }
  }

  const columns: Column<Reason>[] = [
    { key: "name", header: t("name") },
    {
      key: "code",
      header: t("code"),
      width: "160px",
      render: (r) => r.code ? <span className="font-mono text-[12px] text-ink-600 dark:text-ink-400">{r.code}</span> : <span className="text-ink-400">—</span>,
    },
    {
      key: "is_active",
      header: t("is_active"),
      width: "100px",
      align: "center",
      render: (r) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
          r.is_active
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
        }`}>
          {r.is_active ? t("is_active") : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        onCreate={openCreate}
        createLabel={t("create")}
      />

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        onEdit={openEdit}
        onDelete={(r) => setDeactivateTarget(r)}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? t("edit") : t("create")}>
        <div className="space-y-3">
          <Field label={t("name")} required>
            <input
              className={input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masalan: found_during_inventory"
            />
          </Field>
          <Field label={t("code")}>
            <input
              className={input}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Masalan: found_during_inventory"
            />
          </Field>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active_check"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-brand-600"
            />
            <label htmlFor="is_active_check" className="text-[13px] text-ink-700 dark:text-ink-300">
              {t("is_active")}
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-[13px] rounded-md border border-ink-300 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800"
            >
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={save}
              className="px-4 py-2 text-[13px] rounded-md bg-brand-600 text-white hover:bg-brand-700"
            >
              {tc("save")}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title={t("deactivate_title")}
        message={t("deactivate_message").replace("{name}", deactivateTarget?.name ?? "")}
        confirmLabel={t("deactivate")}
        cancelLabel={tc("cancel")}
        variant="warning"
        loading={deactivateLoading}
      />
    </div>
  );
}
