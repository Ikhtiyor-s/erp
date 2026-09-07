"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

type Rack = {
  id: number;
  row_id: number;
  name: string;
  sort_order: number;
};

type Cell = {
  id: string;
  code: string;
  is_active: boolean;
};

type RowInfo = { id: number; name: string; warehouse_id: number };
type Warehouse = { id: number; name: string };

type RackFormState = { name: string; sort_order: string };
const EMPTY_RACK_FORM: RackFormState = { name: "", sort_order: "0" };

type CellFormState = { code: string; is_active: boolean };
const EMPTY_CELL_FORM: CellFormState = { code: "", is_active: true };

function CellsSection({ rackId, tc }: { rackId: number; tc: ReturnType<typeof useTranslations<"common">> }) {
  const t = useTranslations("warehouse.cells");
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CellFormState>(EMPTY_CELL_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmCell, setConfirmCell] = useState<Cell | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<Cell[]>(`/warehouse/racks/${rackId}/cells`);
      setCells(r.data);
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [rackId]);

  function openCreate() {
    setForm(EMPTY_CELL_FORM);
    setEditId(null);
    setModalOpen(true);
  }

  function openEdit(cell: Cell) {
    setForm({ code: cell.code, is_active: cell.is_active });
    setEditId(cell.id);
    setModalOpen(true);
  }

  async function save() {
    if (!form.code.trim()) {
      toast.error(t("code_required"));
      return;
    }
    setSaving(true);
    try {
      if (editId !== null) {
        await api.patch(`/warehouse/racks/${rackId}/cells/${editId}`, {
          code: form.code.trim(),
          is_active: form.is_active,
        });
      } else {
        await api.post(`/warehouse/racks/${rackId}/cells`, { code: form.code.trim() });
      }
      toast.success(tc("saved"));
      setModalOpen(false);
      load();
    } catch (e: any) {
      if (e?.response?.status === 409) {
        toast.error(getErrorMessage(e, t("code_required")));
      } else {
        toast.error(getErrorMessage(e, tc("error")));
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteCell(cell: Cell) {
    setDeleting(true);
    try {
      await api.delete(`/warehouse/racks/${rackId}/cells/${cell.id}`);
      toast.success(tc("deleted"));
      setConfirmCell(null);
      load();
    } catch (e: any) {
      if (e?.response?.status === 409) {
        toast.error(t("cell_has_product"));
      } else {
        toast.error(getErrorMessage(e, tc("error")));
      }
      setConfirmCell(null);
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<Cell>[] = [
    { key: "code", header: t("col_code") },
    {
      key: "is_active",
      header: t("col_active"),
      width: "90px",
      align: "center",
      render: (c) => <Badge tone={c.is_active ? "success" : "danger"}>{c.is_active ? tc("yes") : tc("no")}</Badge>,
    },
  ];

  return (
    <div className="mt-3 border-t border-ink-100 dark:border-ink-800 pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide">
          {t("title")}
        </span>
        <Button variant="outline" size="xs" onClick={openCreate}>
          + {t("new_cell")}
        </Button>
      </div>

      <div className="hidden md:block">
        <DataTable
          columns={columns}
          rows={cells}
          loading={loading}
          onEdit={openEdit}
          onDelete={(c) => setConfirmCell(c)}
          rowKey={(c) => c.id}
        />
      </div>

      <ul className="md:hidden space-y-2">
        {loading && (
          <li className="text-center text-xs text-ink-400 py-4">{tc("loading")}</li>
        )}
        {!loading && cells.length === 0 && (
          <li className="text-center text-xs text-ink-400 py-4">{tc("no_data")}</li>
        )}
        {cells.map((c) => (
          <li
            key={c.id}
            className="bg-white dark:bg-ink-900 rounded border border-ink-200 dark:border-ink-800 p-3 flex items-center justify-between gap-2"
          >
            <div>
              <span className="font-mono text-sm text-ink-900 dark:text-ink-100">{c.code}</span>
              {!c.is_active && (
                <Badge tone="danger" className="ml-2">{tc("no")}</Badge>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="xs" onClick={() => openEdit(c)}>
                {tc("edit")}
              </Button>
              <Button
                variant="outline"
                size="xs"
                className="border-danger-500/40 text-danger-600 dark:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15"
                onClick={() => setConfirmCell(c)}
              >
                {tc("delete")}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId !== null ? t("edit_cell") : t("new_cell")}
      >
        <div className="space-y-3">
          <Field label={t("code_label")} required>
            <input
              className={input}
              value={form.code}
              placeholder={t("code_placeholder")}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </Field>
          {editId !== null && (
            <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              {t("col_active")}
            </label>
          )}
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
        open={confirmCell !== null}
        onClose={() => setConfirmCell(null)}
        onConfirm={() => { if (confirmCell) deleteCell(confirmCell); }}
        title={t("delete_title")}
        message={t("delete_message")}
        confirmLabel={tc("delete")}
        loading={deleting}
      />
    </div>
  );
}

export default function WarehouseRacksPage() {
  const t = useTranslations("warehouse");
  const tc = useTranslations("common");
  const params = useParams<{ wid: string; rid: string }>();
  const wid = Number(params.wid);
  const rid = Number(params.rid);

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null);
  const [rowInfo, setRowInfo] = useState<RowInfo | null>(null);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<RackFormState>(EMPTY_RACK_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmItem, setConfirmItem] = useState<Rack | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedRackId, setExpandedRackId] = useState<number | null>(null);

  async function loadMeta() {
    try {
      const [whRes, rowsRes] = await Promise.all([
        api.get<Warehouse[]>("/warehouse/warehouses"),
        api.get<RowInfo[]>(`/warehouse/${wid}/rows`),
      ]);
      const wh = whRes.data.find((w) => w.id === wid) ?? null;
      const row = rowsRes.data.find((r) => r.id === rid) ?? null;
      setWarehouse(wh);
      setRowInfo(row);
    } catch {
      // breadcrumbs will fallback to IDs
    }
  }

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<Rack[]>(`/warehouse/rows/${rid}/racks`);
      setRacks(r.data);
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMeta();
    load();
  }, [wid, rid]);

  function openCreate() {
    setForm(EMPTY_RACK_FORM);
    setEditId(null);
    setModalOpen(true);
  }

  function openEdit(rack: Rack) {
    setForm({ name: rack.name, sort_order: String(rack.sort_order) });
    setEditId(rack.id);
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
        await api.put(`/warehouse/racks/${editId}`, payload);
      } else {
        await api.post(`/warehouse/rows/${rid}/racks`, payload);
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

  async function deleteRack(rack: Rack) {
    setDeleting(true);
    try {
      await api.delete(`/warehouse/racks/${rack.id}`);
      toast.success(tc("deleted"));
      setConfirmItem(null);
      load();
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 409) {
        toast.error(t("rack_has_products"));
      } else {
        toast.error(getErrorMessage(e, tc("error")));
      }
      setConfirmItem(null);
    } finally {
      setDeleting(false);
    }
  }

  const whName = warehouse?.name ?? `#${wid}`;
  const rowName = rowInfo?.name ?? `#${rid}`;
  const tc_cells = useTranslations("warehouse.cells");

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-ink-500 dark:text-ink-400 flex-wrap">
        <Link href="/warehouse/warehouses" className="hover:text-ink-700 dark:hover:text-ink-200">
          {t("warehouses")}
        </Link>
        <ChevronRight size={14} />
        <Link href={`/warehouse/${wid}/rows`} className="hover:text-ink-700 dark:hover:text-ink-200">
          {whName}
        </Link>
        <ChevronRight size={14} />
        <Link href={`/warehouse/${wid}/rows`} className="hover:text-ink-700 dark:hover:text-ink-200">
          {t("rows")}
        </Link>
        <ChevronRight size={14} />
        <span className="text-ink-900 dark:text-ink-100 font-medium">{rowName}</span>
        <ChevronRight size={14} />
        <span className="text-ink-900 dark:text-ink-100 font-medium">{t("racks")}</span>
      </nav>

      <PageHeader
        title={`${rowName} — ${t("racks")}`}
        description={t("racks_desc")}
        onCreate={openCreate}
        createLabel={t("new_rack")}
      />

      {/* Desktop: racks table with inline expand */}
      <div className="hidden md:block space-y-2">
        {loading && (
          <div className="bg-white dark:bg-ink-950 rounded-md border border-ink-200/60 dark:border-ink-800/60 px-4 py-10 text-center text-sm text-ink-400">
            {tc("loading")}
          </div>
        )}
        {!loading && racks.length === 0 && (
          <div className="bg-white dark:bg-ink-950 rounded-md border border-ink-200/60 dark:border-ink-800/60 px-4 py-10 text-center text-sm text-ink-400">
            {tc("no_data")}
          </div>
        )}
        {racks.map((r) => (
          <div
            key={r.id}
            className="bg-white dark:bg-ink-950 rounded-md border border-ink-200/60 dark:border-ink-800/60 overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => setExpandedRackId(expandedRackId === r.id ? null : r.id)}
                className="flex items-center gap-1.5 text-sm font-medium text-ink-900 dark:text-ink-100 hover:text-brand-600 flex-1 min-w-0 text-left"
              >
                {expandedRackId === r.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <span className="truncate">{r.name}</span>
                <span className="text-xs text-ink-400 font-mono ml-1">#{r.sort_order}</span>
              </button>
              <span className="text-xs text-ink-400 dark:text-ink-500 shrink-0">
                {tc_cells("expand_cells")}
              </span>
              <div className="flex gap-1 shrink-0">
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
            {expandedRackId === r.id && (
              <div className="px-6 pb-4">
                <CellsSection rackId={r.id} tc={tc} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-3">
        {loading && (
          <li className="text-center text-sm text-ink-400 py-8">{tc("loading")}</li>
        )}
        {!loading && racks.length === 0 && (
          <li className="text-center text-sm text-ink-400 py-8">{tc("no_data")}</li>
        )}
        {racks.map((r) => (
          <li
            key={r.id}
            className="bg-white dark:bg-ink-900 rounded-lg border border-ink-200 dark:border-ink-800 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-900 dark:text-ink-100">{r.name}</p>
                <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                  {t("sort_order")}: {r.sort_order}
                </p>
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
            <button
              onClick={() => setExpandedRackId(expandedRackId === r.id ? null : r.id)}
              className="mt-3 w-full flex items-center justify-between text-xs text-ink-500 dark:text-ink-400 border-t border-ink-100 dark:border-ink-800 pt-2"
            >
              <span>{tc_cells("expand_cells")}</span>
              {expandedRackId === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expandedRackId === r.id && (
              <div className="pt-2">
                <CellsSection rackId={r.id} tc={tc} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId !== null ? t("edit_rack") : t("new_rack")}
      >
        <div className="space-y-3">
          <Field label={t("rack_name")} required>
            <input
              className={input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("rack_name_placeholder")}
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
        onConfirm={() => { if (confirmItem) deleteRack(confirmItem); }}
        title={t("delete_rack_title")}
        message={t("delete_rack_message")}
        confirmLabel={tc("delete")}
        loading={deleting}
      />
    </div>
  );
}
