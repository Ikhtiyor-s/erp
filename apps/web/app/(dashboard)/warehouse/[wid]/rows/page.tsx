"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

type Row = {
  id: number;
  warehouse_id: number;
  name: string;
  sort_order: number;
  rack_count: number;
};

type Warehouse = { id: number; name: string };

type FormState = { name: string; sort_order: string };
const EMPTY_FORM: FormState = { name: "", sort_order: "0" };

export default function WarehouseRowsPage() {
  const t = useTranslations("warehouse");
  const tc = useTranslations("common");
  const params = useParams<{ wid: string }>();
  const router = useRouter();
  const wid = Number(params.wid);

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmItem, setConfirmItem] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadWarehouse() {
    try {
      const r = await api.get<Warehouse[]>("/warehouse/warehouses");
      const wh = r.data.find((w) => w.id === wid) ?? null;
      setWarehouse(wh);
    } catch {
      // warehouse name stays null — breadcrumb will show id
    }
  }

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<Row[]>(`/warehouse/${wid}/rows`);
      setRows(r.data);
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouse();
    load();
  }, [wid]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModalOpen(true);
  }

  function openEdit(row: Row) {
    setForm({ name: row.name, sort_order: String(row.sort_order) });
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
      const payload = { name: form.name.trim(), sort_order: Number(form.sort_order) || 0 };
      if (editId !== null) {
        await api.put(`/warehouse/rows/${editId}`, payload);
      } else {
        await api.post(`/warehouse/${wid}/rows`, payload);
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

  async function deleteRow(row: Row) {
    setDeleting(true);
    try {
      await api.delete(`/warehouse/rows/${row.id}`);
      toast.success(tc("deleted"));
      setConfirmItem(null);
      load();
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 409) {
        toast.error(t("row_has_racks"));
      } else {
        toast.error(getErrorMessage(e, tc("error")));
      }
      setConfirmItem(null);
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: t("row_name"),
      render: (r) => (
        <button
          onClick={() => router.push(`/warehouse/${wid}/rows/${r.id}/racks`)}
          className="text-brand-600 hover:text-brand-700 hover:underline font-medium text-left"
        >
          {r.name}
        </button>
      ),
    },
    {
      key: "rack_count",
      header: t("rack_count"),
      align: "right",
      width: "120px",
      render: (r) => (
        <span className="font-mono text-ink-700 dark:text-ink-300">{r.rack_count}</span>
      ),
    },
    {
      key: "sort_order",
      header: t("sort_order"),
      align: "right",
      width: "120px",
      render: (r) => <span className="font-mono">{r.sort_order}</span>,
    },
  ];

  const whName = warehouse?.name ?? `#${wid}`;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400">
        <Link href="/warehouse/warehouses" className="hover:text-ink-700 dark:hover:text-ink-200">
          {t("warehouses")}
        </Link>
        <ChevronRight size={14} />
        <span className="text-ink-900 dark:text-ink-100 font-medium">{whName}</span>
        <ChevronRight size={14} />
        <span className="text-ink-900 dark:text-ink-100 font-medium">{t("rows")}</span>
      </nav>

      <PageHeader
        title={`${whName} — ${t("rows")}`}
        description={t("rows_desc")}
        onCreate={openCreate}
        createLabel={t("new_row")}
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
                <button
                  onClick={() => router.push(`/warehouse/${wid}/rows/${r.id}/racks`)}
                  className="font-medium text-brand-600 hover:text-brand-700 hover:underline text-left"
                >
                  {r.name}
                </button>
                <div className="flex gap-4 mt-1 text-xs text-ink-500 dark:text-ink-400">
                  <span>{t("rack_count")}: {r.rack_count}</span>
                  <span>{t("sort_order")}: {r.sort_order}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="xs" onClick={() => openEdit(r)}>
                  {tc("edit")}
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  className="border-danger-500/40 text-danger-600 dark:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15"
                  onClick={() => setConfirmItem(r)}
                >
                  {tc("delete")}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId !== null ? t("edit_row") : t("new_row")}
      >
        <div className="space-y-3">
          <Field label={t("row_name")} required>
            <input
              className={input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("row_name_placeholder")}
            />
          </Field>
          <Field label={t("sort_order")}>
            <input
              type="number"
              className={input}
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              min={0}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-ink-200 dark:border-ink-800">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button variant="primary" onClick={save} disabled={saving} loading={saving}>
              {tc("save")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmItem !== null}
        onClose={() => setConfirmItem(null)}
        onConfirm={() => { if (confirmItem) deleteRow(confirmItem); }}
        title={t("delete_row_title")}
        message={t("delete_row_message")}
        confirmLabel={tc("delete")}
        loading={deleting}
      />
    </div>
  );
}
