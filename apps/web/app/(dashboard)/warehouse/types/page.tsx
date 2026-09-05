"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type WhType = {
  id: number;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
};

type FormState = { name: string; code: string };

const CODE_OPTIONS = ["central", "pos", "transit", "scrap", "custom"] as const;
const EMPTY_FORM: FormState = { name: "", code: "" };

export default function WarehouseTypesPage() {
  const t = useTranslations("warehouse");
  const tc = useTranslations("common");

  const [rows, setRows] = useState<WhType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmItem, setConfirmItem] = useState<WhType | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<WhType[]>("/warehouse/types");
      setRows(r.data);
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModalOpen(true);
  }

  function openEdit(row: WhType) {
    setForm({ name: row.name, code: row.code ?? "" });
    setEditId(row.id);
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error(t("name_required"));
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), code: form.code || null };
      if (editId !== null) {
        await api.put(`/warehouse/types/${editId}`, payload);
      } else {
        await api.post("/warehouse/types", payload);
      }
      toast.success(tc("saved"));
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(row: WhType) {
    setDeactivating(true);
    try {
      await api.delete(`/warehouse/types/${row.id}`);
      toast.success(t("type_deactivated"));
      setConfirmItem(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setDeactivating(false);
    }
  }

  const columns: Column<WhType>[] = [
    { key: "name", header: tc("name") },
    {
      key: "code",
      header: tc("code"),
      render: (r) => r.code ? (
        <span className="font-mono text-xs bg-ink-100 dark:bg-ink-800 px-1.5 py-0.5 rounded">
          {r.code}
        </span>
      ) : "—",
    },
    {
      key: "is_active",
      header: tc("status"),
      render: (r) => r.is_active ? (
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {t("active")}
        </span>
      ) : (
        <span className="text-xs font-medium text-rose-500 dark:text-rose-400">
          {t("inactive")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("types_title")}
        description={t("types_desc")}
        onCreate={openCreate}
        createLabel={t("new_type")}
      />

      <div className="hidden md:block">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          onEdit={openEdit}
          onDelete={(r) => setConfirmItem(r)}
        />
      </div>

      <ul className="md:hidden space-y-3">
        {loading && (
          <li className="text-center text-sm text-ink-400 py-8">{tc("loading")}</li>
        )}
        {!loading && rows.length === 0 && (
          <li className="text-center text-sm text-ink-400 py-8">{tc("no_data")}</li>
        )}
        {rows.map((r) => (
          <li
            key={r.id}
            className="bg-white dark:bg-ink-900 rounded-lg border border-ink-200 dark:border-ink-800 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-900 dark:text-ink-100 truncate">{r.name}</p>
                {r.code && (
                  <p className="text-xs font-mono text-ink-500 dark:text-ink-400 mt-0.5">{r.code}</p>
                )}
                <p className={`text-xs mt-1 font-medium ${r.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                  {r.is_active ? t("active") : t("inactive")}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openEdit(r)}
                  className="text-xs text-brand-600 hover:text-brand-700 px-2 py-1 rounded border border-brand-200"
                >
                  {tc("edit")}
                </button>
                <button
                  onClick={() => setConfirmItem(r)}
                  className="text-xs text-rose-600 hover:text-rose-700 px-2 py-1 rounded border border-rose-200"
                >
                  {t("deactivate")}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId !== null ? t("edit_type") : t("new_type")}
      >
        <div className="space-y-3">
          <Field label={tc("name")} required>
            <input
              className={input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("type_name_placeholder")}
            />
          </Field>
          <Field label={tc("code")}>
            <select
              className={input}
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            >
              <option value="">{t("code_none")}</option>
              {CODE_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
            <button
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-md border border-ink-300 dark:border-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50"
            >
              {tc("cancel")}
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "..." : tc("save")}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmItem !== null}
        onClose={() => setConfirmItem(null)}
        onConfirm={() => { if (confirmItem) deactivate(confirmItem); }}
        title={t("deactivate_title")}
        message={t("deactivate_message")}
        confirmLabel={t("deactivate")}
        loading={deactivating}
      />
    </div>
  );
}
