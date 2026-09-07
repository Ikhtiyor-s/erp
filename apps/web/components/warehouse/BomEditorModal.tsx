"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, X, Check, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { Modal, Field, input } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useTranslations } from "next-intl";

type BomRow = {
  id: number;
  component_product_id: string;
  component_name: string;
  quantity: string;
  unit_id: number | null;
  unit_name: string | null;
  notes: string | null;
};

type Unit = { id: number; name: string };
type ProductOption = { id: string; name: string };

const emptyForm = {
  component_product_id: "",
  quantity: "",
  unit_id: "" as string | number,
  notes: "",
};

function ProductSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (id: string, name: string) => void;
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState("");

  useEffect(() => {
    if (!value) {
      setSelectedName("");
      setQ("");
    }
  }, [value]);

  useEffect(() => {
    if (q.length < 1) {
      setOptions([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .get<ProductOption[]>(`/warehouse/products?q=${encodeURIComponent(q)}&limit=20`)
        .then((r) => {
          const data = r.data;
          if (Array.isArray(data)) {
            setOptions(data);
          } else if (data && typeof data === "object" && "items" in data) {
            setOptions((data as { items: ProductOption[] }).items);
          } else {
            setOptions([]);
          }
          setOpen(true);
        })
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  function select(opt: ProductOption) {
    setSelectedName(opt.name);
    setQ("");
    setOpen(false);
    onChange(opt.id, opt.name);
  }

  return (
    <div className="relative">
      {selectedName ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[13px] text-ink-900 dark:text-ink-100 border border-ink-200 dark:border-ink-800 rounded-md px-2.5 py-1.5 bg-white dark:bg-ink-950 truncate">
            {selectedName}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedName("");
              onChange("", "");
            }}
            className="p-1 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-400"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <input
          className={input}
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.length >= 1 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      )}
      {loading && (
        <Loader2
          size={14}
          className="absolute right-2.5 top-2.5 animate-spin text-ink-400"
        />
      )}
      {open && options.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-800 rounded-md shadow-lg max-h-48 overflow-auto text-[13px]">
          {options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-brand-50 dark:hover:bg-ink-800 text-ink-900 dark:text-ink-100 truncate"
                onMouseDown={() => select(opt)}
              >
                {opt.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
};

export function BomEditorModal({ open, onClose, productId, productName }: Props) {
  const tb = useTranslations("warehouse.bom");
  const tc = useTranslations("common");

  const [rows, setRows] = useState<BomRow[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedProductName, setSelectedProductName] = useState("");
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState<BomRow | null>(null);
  const [editForm, setEditForm] = useState({ quantity: "", unit_id: "" as string | number, notes: "" });
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BomRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadBom() {
    setLoading(true);
    try {
      const r = await api.get<BomRow[]>(`/warehouse/products/${productId}/bom`);
      setRows(r.data);
    } catch (e) {
      toast.error(getErrorMessage(e, tb("load_error")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setAddOpen(false);
    setForm(emptyForm);
    setSelectedProductName("");
    setEditTarget(null);
    loadBom();
    api
      .get<Unit[]>("/reference/units")
      .then((r) => setUnits(r.data))
      .catch(() => {});
  }, [open, productId]);

  async function handleAdd() {
    if (!form.component_product_id) {
      toast.error(tb("validation_product"));
      return;
    }
    const qty = parseFloat(form.quantity);
    if (!qty || qty <= 0) {
      toast.error(tb("validation_qty"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        component_product_id: form.component_product_id,
        quantity: qty,
        unit_id: form.unit_id ? Number(form.unit_id) : null,
        notes: form.notes.trim() || null,
      };
      const r = await api.post<BomRow>(`/warehouse/products/${productId}/bom`, payload);
      setRows((prev) => [...prev, r.data]);
      setForm(emptyForm);
      setSelectedProductName("");
      setAddOpen(false);
      toast.success(tc("saved"));
    } catch (e) {
      toast.error(getErrorMessage(e, tb("cycle_error")));
    } finally {
      setSaving(false);
    }
  }

  function openEdit(row: BomRow) {
    setEditTarget(row);
    setEditForm({
      quantity: row.quantity,
      unit_id: row.unit_id ?? "",
      notes: row.notes ?? "",
    });
  }

  async function handleEdit() {
    if (!editTarget) return;
    const qty = parseFloat(editForm.quantity);
    if (!qty || qty <= 0) {
      toast.error(tb("validation_qty"));
      return;
    }
    setEditSaving(true);
    try {
      const payload = {
        quantity: qty,
        unit_id: editForm.unit_id ? Number(editForm.unit_id) : null,
        notes: editForm.notes.trim() || null,
      };
      const r = await api.patch<BomRow>(
        `/warehouse/products/${productId}/bom/${editTarget.id}`,
        payload
      );
      setRows((prev) => prev.map((row) => (row.id === editTarget.id ? r.data : row)));
      setEditTarget(null);
      toast.success(tc("saved"));
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/warehouse/products/${productId}/bom/${deleteTarget.id}`);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success(tc("deleted"));
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={`${tb("modal_title")} — ${productName}`} size="xl">
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-ink-400 gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">{tc("loading")}</span>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto rounded border border-ink-200/60 dark:border-ink-800/60">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-ink-50 dark:bg-ink-900 text-ink-500 dark:text-ink-400 text-[11px] uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60">
                      <th className="px-3 py-2 text-left w-8">#</th>
                      <th className="px-3 py-2 text-left">{tb("col_component")}</th>
                      <th className="px-3 py-2 text-right w-28">{tb("col_qty")}</th>
                      <th className="px-3 py-2 text-left w-24">{tb("col_unit")}</th>
                      <th className="px-3 py-2 text-left">{tb("col_notes")}</th>
                      <th className="px-3 py-2 text-center w-24">{tc("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && !addOpen && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-8 text-center text-ink-400 text-sm"
                        >
                          {tb("empty")}
                        </td>
                      </tr>
                    )}
                    {rows.map((row, i) => (
                      <tr
                        key={row.id}
                        className="border-b border-ink-100 dark:border-ink-800 last:border-0 hover:bg-ink-50/60 dark:hover:bg-ink-900/60"
                      >
                        <td className="px-3 py-2 text-ink-400">{i + 1}</td>
                        {editTarget?.id === row.id ? (
                          <>
                            <td className="px-3 py-2 text-ink-700 dark:text-ink-300">
                              {row.component_name}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.0001"
                                min="0.0001"
                                className={`${input} text-right`}
                                value={editForm.quantity}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, quantity: e.target.value })
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              <select
                                className={input}
                                value={editForm.unit_id}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, unit_id: e.target.value })
                                }
                              >
                                <option value="">—</option>
                                {units.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                className={input}
                                value={editForm.notes}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, notes: e.target.value })
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={handleEdit}
                                  disabled={editSaving}
                                  className="p-1 rounded text-success-600 hover:bg-success-50 dark:hover:bg-success-500/15 disabled:opacity-50"
                                  aria-label={tc("save")}
                                >
                                  {editSaving ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Check size={14} />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditTarget(null)}
                                  className="p-1 rounded text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
                                  aria-label={tc("cancel")}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 font-medium text-ink-800 dark:text-ink-200">
                              {row.component_name}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-ink-700 dark:text-ink-300">
                              {row.quantity}
                            </td>
                            <td className="px-3 py-2 text-ink-500 dark:text-ink-400">
                              {row.unit_name || "—"}
                            </td>
                            <td className="px-3 py-2 text-ink-500 dark:text-ink-400">
                              {row.notes || "—"}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEdit(row)}
                                  className="p-1 rounded text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950"
                                  aria-label={tc("edit")}
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(row)}
                                  className="p-1 rounded text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/15"
                                  aria-label={tc("delete")}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="md:hidden space-y-2">
                {rows.length === 0 && (
                  <li className="text-center text-sm text-ink-400 py-6">{tb("empty")}</li>
                )}
                {rows.map((row, i) => (
                  <li
                    key={row.id}
                    className="bg-white dark:bg-ink-900 rounded-lg border border-ink-200 dark:border-ink-800 p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-ink-900 dark:text-ink-100 truncate">
                          {i + 1}. {row.component_name}
                        </div>
                        <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                          {tb("col_qty")}: <span className="font-mono">{row.quantity}</span>
                          {row.unit_name && ` ${row.unit_name}`}
                        </div>
                        {row.notes && (
                          <div className="text-xs text-ink-400 mt-0.5 truncate">{row.notes}</div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="text-xs text-brand-600 hover:text-brand-700"
                        >
                          {tc("edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(row)}
                          className="text-xs text-danger-600 hover:text-danger-700"
                        >
                          {tc("delete")}
                        </button>
                      </div>
                    </div>
                    {editTarget?.id === row.id && (
                      <div className="mt-3 pt-3 border-t border-ink-100 dark:border-ink-800 space-y-2">
                        <Field label={tb("col_qty")}>
                          <input
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            className={input}
                            value={editForm.quantity}
                            onChange={(e) =>
                              setEditForm({ ...editForm, quantity: e.target.value })
                            }
                          />
                        </Field>
                        <Field label={tb("col_unit")}>
                          <select
                            className={input}
                            value={editForm.unit_id}
                            onChange={(e) =>
                              setEditForm({ ...editForm, unit_id: e.target.value })
                            }
                          >
                            <option value="">—</option>
                            {units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label={tb("col_notes")}>
                          <input
                            className={input}
                            value={editForm.notes}
                            onChange={(e) =>
                              setEditForm({ ...editForm, notes: e.target.value })
                            }
                          />
                        </Field>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleEdit}
                            disabled={editSaving}
                            className="px-3 py-1.5 text-xs rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                          >
                            {editSaving ? "..." : tc("save")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTarget(null)}
                            className="px-3 py-1.5 text-xs rounded-md border border-ink-300 dark:border-ink-600"
                          >
                            {tc("cancel")}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {/* Add form */}
              {addOpen ? (
                <div className="border border-ink-200 dark:border-ink-800 rounded-lg p-4 space-y-3 bg-ink-50/50 dark:bg-ink-900/50">
                  <p className="text-[12px] font-semibold text-ink-600 dark:text-ink-400 uppercase tracking-wide">
                    {tb("add_title")}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <Field label={tb("field_component")} required>
                        <ProductSearch
                          value={form.component_product_id}
                          onChange={(id, name) => {
                            setForm({ ...form, component_product_id: id });
                            setSelectedProductName(name);
                          }}
                          placeholder={tb("search_placeholder")}
                        />
                      </Field>
                    </div>
                    <Field label={tb("field_qty")} required>
                      <input
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        className={input}
                        value={form.quantity}
                        onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                      />
                    </Field>
                    <Field label={tb("field_unit")}>
                      <select
                        className={input}
                        value={form.unit_id}
                        onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
                      >
                        <option value="">—</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label={tb("field_notes")}>
                        <textarea
                          className={`${input} h-16`}
                          value={form.notes}
                          onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAdd}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      {tb("save_btn")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddOpen(false);
                        setForm(emptyForm);
                        setSelectedProductName("");
                      }}
                      className="px-4 py-2 text-sm rounded-md border border-ink-300 dark:border-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800"
                    >
                      {tc("cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-dashed border-brand-400 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors"
                >
                  <Plus size={15} />
                  {tb("add_btn")}
                </button>
              )}
            </>
          )}

          <div className="flex justify-end pt-3 border-t border-ink-200 dark:border-ink-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md border border-ink-300 dark:border-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800"
            >
              {tc("cancel")}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={tb("delete_title")}
        message={tb("delete_message", { name: deleteTarget?.component_name ?? "" })}
        loading={deleting}
      />
    </>
  );
}
