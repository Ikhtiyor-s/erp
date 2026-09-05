"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Search, Upload, ClipboardList, Printer, Archive, ArchiveRestore, Barcode } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal, Field, input } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { TagsInput } from "@/components/ui/tags-input";
import { CustomFieldsEditor } from "@/components/ui/custom-fields";
import { usePermissions } from "@/lib/permissions";
import { useTranslations } from "next-intl";
import { BomEditorModal } from "@/components/warehouse/BomEditorModal";
import { MxikCombobox } from "@/components/ui/mxik-combobox";
import { LabelPrint, type LabelData } from "@/components/barcode/label-print";

const MAX_LABEL_SELECT = 100;

function toLabel(r: { name: string; barcode?: string; sku?: string; id: string; sale_price: string; unit_name?: string }): LabelData {
  return {
    name: r.name,
    barcode: r.barcode || r.sku || r.id,
    price: Number(r.sale_price) || undefined,
    unit: r.unit_name,
  };
}

type Product = {
  id: string;
  sku?: string;
  barcode?: string;
  mxik?: string | null;
  name: string;
  sale_price: string;
  purchase_price: string;
  currency_id?: number;
  currency_code?: string;
  unit_id?: number;
  unit_name?: string;
  category_id?: number;
  category_name?: string;
  is_service: boolean;
  is_produced?: boolean;
  total_stock?: string;
  product_type?: string | null;
  default_rack_id?: number | null;
  rack_name?: string | null;
  default_cell_id?: string | null;
  default_cell_code?: string | null;
  is_archived?: boolean;
  default_supplier_id?: string | null;
  default_supplier_name?: string | null;
  primary_barcode?: string | null;
  active_barcode_count?: number;
};

type ProductBarcode = {
  id: string;
  barcode: string;
  is_primary: boolean;
  is_active: boolean;
  created_at?: string;
  deactivated_at?: string | null;
};

type Supplier = { id: string; name: string };
type Ref = { id: number; name: string; code?: string };
type ImportError = { row: number; message: string };
type ImportResult = { created: number; updated: number; errors: ImportError[] };

type Warehouse = { id: number; name: string };
type WarehouseRow = { id: number; name: string };
type Rack = { id: number; name: string };
type Cell = { id: string; code: string; is_active: boolean };

const empty = {
  name: "",
  sku: "",
  barcode: "",
  mxik: "",
  category_id: null as number | null,
  unit_id: null as number | null,
  purchase_price: 0,
  sale_price: 0,
  currency_id: null as number | null,
  is_service: false,
  is_material: false,
  is_semi_product: false,
  is_marked: false,
  has_expiration: false,
  image_url: "",
  box_qty: "",
  box_barcode: "",
  dim_length: "",
  dim_width: "",
  dim_height: "",
  dim_weight: "",
  description: "",
  tag_ids: [] as number[],
  product_type: "",
  default_rack_id: null as number | null,
  default_cell_id: null as string | null,
  default_supplier_id: null as string | null,
};

const fmt = (v: unknown) =>
  Number(v || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });

function CellPicker({
  rackValue,
  cellValue,
  onRackChange,
  onCellChange,
  warehouses,
  tw,
}: {
  rackValue: number | null;
  cellValue: string | null;
  onRackChange: (id: number | null) => void;
  onCellChange: (id: string | null) => void;
  warehouses: Warehouse[];
  tw: ReturnType<typeof useTranslations<"warehouse.products">>;
}) {
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const [rowId, setRowId] = useState<number | null>(null);
  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);

  useEffect(() => {
    setRowId(null);
    setRacks([]);
    setCells([]);
    onRackChange(null);
    onCellChange(null);
    if (!warehouseId) {
      setRows([]);
      return;
    }
    api
      .get<WarehouseRow[]>(`/warehouse/${warehouseId}/rows`)
      .then((r) => setRows(r.data))
      .catch(() => setRows([]));
  }, [warehouseId]);

  useEffect(() => {
    setRacks([]);
    setCells([]);
    onRackChange(null);
    onCellChange(null);
    if (!rowId) return;
    api
      .get<Rack[]>(`/warehouse/rows/${rowId}/racks`)
      .then((r) => setRacks(r.data))
      .catch(() => setRacks([]));
  }, [rowId]);

  function handleRackChange(rackId: number | null) {
    onRackChange(rackId);
    onCellChange(null);
    setCells([]);
    if (!rackId) return;
    api
      .get<Cell[]>(`/warehouse/racks/${rackId}/cells`)
      .then((r) => setCells(r.data.filter((c) => c.is_active)))
      .catch(() => setCells([]));
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
      <div>
        <label className="text-[11px] text-ink-500 dark:text-ink-400 block mb-1">
          {tw("rack_warehouse")}
        </label>
        <select
          className={input}
          value={warehouseId ?? ""}
          onChange={(e) =>
            setWarehouseId(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">{tw("rack_select_warehouse")}</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[11px] text-ink-500 dark:text-ink-400 block mb-1">
          {tw("rack_row")}
        </label>
        <select
          className={input}
          value={rowId ?? ""}
          disabled={!warehouseId}
          onChange={(e) =>
            setRowId(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">{tw("rack_select_row")}</option>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[11px] text-ink-500 dark:text-ink-400 block mb-1">
          {tw("rack_label")}
        </label>
        <select
          className={input}
          value={rackValue ?? ""}
          disabled={!rowId}
          onChange={(e) =>
            handleRackChange(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">{tw("rack_select_rack")}</option>
          {racks.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[11px] text-ink-500 dark:text-ink-400 block mb-1">
          {tw("cell_label")}
        </label>
        <select
          className={input}
          value={cellValue ?? ""}
          disabled={!rackValue}
          onChange={(e) =>
            onCellChange(e.target.value ? e.target.value : null)
          }
        >
          <option value="">{tw("cell_select_cell")}</option>
          {cells.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ImportModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const tw = useTranslations("warehouse.products");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx")) {
      toast.error(tw("only_xlsx"));
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<ImportResult>(
        "/warehouse/products/import",
        fd,
        { timeout: 120000 }
      );
      setResult(res.data);
      if (res.data.errors.length === 0) {
        toast.success(
          `${tw("result_created", { n: res.data.created })} / ${tw("result_updated", { n: res.data.updated })}`
        );
        onSuccess();
      }
    } catch (e) {
      toast.error(getErrorMessage(e, tw("only_xlsx")));
    } finally {
      setUploading(false);
    }
  }

  async function downloadTemplate() {
    try {
      const res = await api.get("/warehouse/products/import/template", {
        responseType: "blob",
        timeout: 30000,
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "products-template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(getErrorMessage(e, "Shablon yuklab olinmadi"));
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={tw("import_modal_title")} size="lg">
      <div className="space-y-4">
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 underline underline-offset-2"
        >
          <Download size={14} />
          {tw("template_download")}
        </button>

        <Field label={tw("file_label")}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className={`${input} file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100`}
          />
        </Field>

        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
        >
          <Upload size={14} />
          {uploading ? tw("uploading") : tw("upload_btn")}
        </button>

        {result && (
          <div className="space-y-2 pt-2 border-t border-ink-200 dark:border-ink-800">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                {tw("result_created", { n: result.created })}
              </span>
              <span className="text-brand-700 dark:text-brand-400 font-medium">
                {tw("result_updated", { n: result.updated })}
              </span>
              {result.errors.length > 0 && (
                <span className="inline-flex items-center gap-1 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {tw("result_errors", { n: result.errors.length })}
                </span>
              )}
            </div>

            {result.errors.length > 0 && (
              <div
                className="overflow-auto rounded border border-rose-200 dark:border-rose-800"
                style={{ maxHeight: 300 }}
              >
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-rose-50 dark:bg-rose-950 text-left">
                      <th className="px-3 py-2 font-medium text-rose-700 dark:text-rose-300 w-20">
                        {tw("error_row")} №
                      </th>
                      <th className="px-3 py-2 font-medium text-rose-700 dark:text-rose-300">
                        {tw("error_message")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, i) => (
                      <tr
                        key={i}
                        className="border-t border-rose-100 dark:border-rose-900 odd:bg-white dark:odd:bg-ink-950 even:bg-rose-50/40 dark:even:bg-rose-950/30"
                      >
                        <td className="px-3 py-1.5 font-mono text-rose-600 dark:text-rose-400">
                          {err.row}
                        </td>
                        <td className="px-3 py-1.5 text-ink-700 dark:text-ink-300">
                          {err.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-ink-200 dark:border-ink-800">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-md border border-ink-300 dark:border-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            {tw("close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function BarcodesModal({
  open,
  onClose,
  productId,
  productName,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
}) {
  const tw = useTranslations("warehouse.products");
  const [barcodes, setBarcodes] = useState<ProductBarcode[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [newBarcode, setNewBarcode] = useState("");
  const [adding, setAdding] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<ProductBarcode | null>(null);

  async function loadBarcodes() {
    if (!productId) return;
    setLoading(true);
    try {
      const res = await api.get<ProductBarcode[]>(
        `/warehouse/products/${productId}/barcodes`
      );
      setBarcodes(res.data);
    } catch (e) {
      toast.error(getErrorMessage(e, tw("barcode_loading")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && productId) {
      loadBarcodes();
      setNewBarcode("");
      setShowInactive(false);
    }
  }, [open, productId]);

  async function handleAdd() {
    const val = newBarcode.trim();
    if (!val) return;
    setAdding(true);
    try {
      await api.post(`/warehouse/products/${productId}/barcodes`, {
        barcode: val,
      });
      setNewBarcode("");
      await loadBarcodes();
      toast.success(tw("barcode_add"));
    } catch (e) {
      toast.error(getErrorMessage(e, tw("barcode_add")));
    } finally {
      setAdding(false);
    }
  }

  async function handleSetPrimary(bid: string) {
    try {
      await api.post(`/warehouse/products/${productId}/barcodes/${bid}/set-primary`);
      await loadBarcodes();
    } catch (e) {
      toast.error(getErrorMessage(e, tw("barcode_set_primary")));
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    try {
      await api.post(
        `/warehouse/products/${productId}/barcodes/${deactivateTarget.id}/deactivate`
      );
      setDeactivateTarget(null);
      await loadBarcodes();
    } catch (e) {
      toast.error(getErrorMessage(e, tw("barcode_deactivate")));
    }
  }

  async function handleReactivate(bid: string) {
    try {
      await api.post(
        `/warehouse/products/${productId}/barcodes/${bid}/reactivate`
      );
      await loadBarcodes();
    } catch (e) {
      toast.error(getErrorMessage(e, tw("barcode_reactivate")));
    }
  }

  const visible = showInactive
    ? barcodes
    : barcodes.filter((b) => b.is_active);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`${tw("barcodes_title")} — ${productName}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              className={`${input} flex-1`}
              placeholder={tw("barcode_placeholder")}
              value={newBarcode}
              onChange={(e) => setNewBarcode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding || !newBarcode.trim()}
              className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-2 rounded-md transition-colors whitespace-nowrap"
            >
              {tw("barcode_add")}
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400 py-4 text-center">{tw("barcode_loading")}</p>
          ) : barcodes.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">{tw("barcode_empty")}</p>
          ) : (
            <>
              <div className="space-y-2">
                {visible.map((b) => (
                  <div
                    key={b.id}
                    className={`flex items-center gap-2 p-2 rounded border ${
                      b.is_active
                        ? "border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900"
                        : "border-ink-100 dark:border-ink-800 bg-slate-50 dark:bg-ink-950 opacity-60"
                    }`}
                  >
                    <span
                      className={`font-mono text-sm flex-1 ${
                        !b.is_active ? "line-through text-ink-400" : ""
                      }`}
                    >
                      {b.barcode}
                    </span>
                    {b.is_primary && b.is_active && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300">
                        {tw("barcode_primary_badge")}
                      </span>
                    )}
                    {b.is_active && !b.is_primary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(b.id)}
                        className="text-xs text-brand-600 hover:text-brand-700 whitespace-nowrap"
                      >
                        {tw("barcode_set_primary")}
                      </button>
                    )}
                    {b.is_active ? (
                      <button
                        type="button"
                        onClick={() => setDeactivateTarget(b)}
                        className="text-xs text-rose-600 hover:text-rose-700 whitespace-nowrap"
                      >
                        {tw("barcode_deactivate")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReactivate(b.id)}
                        className="text-xs text-emerald-600 hover:text-emerald-700 whitespace-nowrap"
                      >
                        {tw("barcode_reactivate")}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {barcodes.some((b) => !b.is_active) && (
                <button
                  type="button"
                  onClick={() => setShowInactive((v) => !v)}
                  className="text-xs text-ink-500 hover:text-ink-700 underline"
                >
                  {showInactive ? tw("barcode_hide_inactive") : tw("barcode_show_inactive")}
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
              {tw("close")}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title={tw("barcode_deactivate_title")}
        message={tw("barcode_deactivate_message", {
          barcode: deactivateTarget?.barcode ?? "",
        })}
      />
    </>
  );
}

export default function ProductsPage() {
  const t = useTranslations("ui");
  const tw = useTranslations("warehouse.products");
  const { can } = usePermissions();

  const [rows, setRows] = useState<Product[]>([]);
  const [cats, setCats] = useState<Ref[]>([]);
  const [units, setUnits] = useState<Ref[]>([]);
  const [currencies, setCurrencies] = useState<Ref[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    q: "",
    category_id: "",
    is_service: "",
    include_archived: false,
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof empty>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bomTarget, setBomTarget] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [printTarget, setPrintTarget] = useState<Product | null>(null);
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false);
  const [barcodesTarget, setBarcodesTarget] = useState<Product | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ product: Product; action: "archive" | "unarchive" } | null>(null);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set("limit", "200");
      if (filters.q) p.set("q", filters.q);
      if (filters.category_id) p.set("category_id", filters.category_id);
      if (filters.is_service) p.set("is_service", filters.is_service);
      if (filters.include_archived) p.set("include_archived", "true");
      setRows((await api.get<Product[]>(`/warehouse/products?${p}`)).data);
    } catch (e) {
      toast.error(getErrorMessage(e, t("ui__ошибка_c6fd3c6a")));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      api.get<Ref[]>("/warehouse/categories").then((r) => setCats(r.data)).catch(() => {}),
      api.get<Ref[]>("/reference/units").then((r) => setUnits(r.data)).catch(() => {}),
      api.get<Ref[]>("/reference/currencies").then((r) => setCurrencies(r.data)).catch(() => {}),
      api
        .get<Warehouse[]>("/warehouse/warehouses")
        .then((r) => setWarehouses(r.data))
        .catch(() => {}),
      api
        .get<Supplier[]>("/supplier/suppliers")
        .then((r) => setSuppliers(r.data))
        .catch(() => {}),
    ]);
    load();
  }, []);

  async function save() {
    try {
      const toNum = (v: unknown) =>
        v === "" || v == null ? null : Number(v);
      const payload = {
        ...form,
        purchase_price: Number(form.purchase_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        category_id: form.category_id || null,
        unit_id: form.unit_id || null,
        currency_id: form.currency_id || null,
        mxik: form.mxik?.trim() || null,
        box_qty: toNum(form.box_qty),
        dim_length: toNum(form.dim_length),
        dim_width: toNum(form.dim_width),
        dim_height: toNum(form.dim_height),
        dim_weight: toNum(form.dim_weight),
        tag_ids: form.tag_ids || [],
        product_type: form.product_type?.trim() || null,
        default_rack_id: form.default_rack_id || null,
        default_cell_id: form.default_cell_id || null,
        default_supplier_id: form.default_supplier_id || null,
      };
      if (editId) await api.put(`/warehouse/products/${editId}`, payload);
      else await api.post("/warehouse/products", payload);
      toast.success(t("ui__сохранено_54a59b19"));
      setOpen(false);
      load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "MXIK xato"));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/warehouse/products/${deleteTarget.id}`);
      toast.success(t("ui__удалено_0c450c40"));
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, t("ui__ошибка_c6fd3c6a")));
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (filters.category_id) params.category_id = filters.category_id;
      const res = await api.get("/warehouse/products/export", {
        params,
        responseType: "blob",
        timeout: 60000,
      });
      const blob = res.data as Blob;
      const cd: string =
        res.headers["content-disposition"] || res.headers["Content-Disposition"] || "";
      const match = cd.match(/filename="?([^";\n]+)"?/);
      const date = new Date().toISOString().slice(0, 10);
      const filename = match?.[1] || `products-${date}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(getErrorMessage(e, tw("export_loading")));
    } finally {
      setExporting(false);
    }
  }

  async function openEdit(r: Product) {
    try {
      const full = await api.get<Record<string, unknown>>(
        `/warehouse/products/${r.id}/full`
      );
      const d = full.data;
      setForm({
        ...empty,
        name: String(d.name ?? ""),
        sku: String(d.sku ?? ""),
        barcode: String(d.barcode ?? ""),
        mxik: String(d.mxik ?? ""),
        category_id: (d.category_id as number) || null,
        unit_id: (d.unit_id as number) || null,
        purchase_price: d.purchase_price as number,
        sale_price: d.sale_price as number,
        currency_id: (d.currency_id as number) || null,
        is_service: !!(d.is_service),
        is_material: !!(d.is_material),
        is_semi_product: !!(d.is_semi_product),
        is_marked: !!(d.is_marked),
        has_expiration: !!(d.has_expiration),
        image_url: String(d.image_url ?? ""),
        box_qty: String(d.box_qty ?? ""),
        box_barcode: String(d.box_barcode ?? ""),
        dim_length: String(d.dim_length ?? ""),
        dim_width: String(d.dim_width ?? ""),
        dim_height: String(d.dim_height ?? ""),
        dim_weight: String(d.dim_weight ?? ""),
        description: String(d.description ?? ""),
        tag_ids: ((d.tags as Array<{ id: number }>) || []).map((tg) => tg.id),
        product_type: String(d.product_type ?? ""),
        default_rack_id: (d.default_rack_id as number) || null,
        default_cell_id: (d.default_cell_id as string) || null,
        default_supplier_id: (d.default_supplier_id as string) || null,
      });
    } catch {
      setForm({
        ...empty,
        name: r.name,
        sku: r.sku || "",
        barcode: r.barcode || "",
        category_id: r.category_id || null,
        unit_id: r.unit_id || null,
        purchase_price: r.purchase_price as unknown as number,
        sale_price: r.sale_price as unknown as number,
        currency_id: r.currency_id || null,
        is_service: r.is_service,
        product_type: r.product_type || "",
        default_rack_id: r.default_rack_id || null,
        default_cell_id: r.default_cell_id || null,
        default_supplier_id: r.default_supplier_id || null,
      });
    }
    setEditId(r.id);
    setOpen(true);
  }

  async function handleArchiveAction() {
    if (!archiveTarget) return;
    const { product, action } = archiveTarget;
    setArchiving(true);
    try {
      await api.post(`/warehouse/products/${product.id}/${action}`);
      toast.success(
        action === "archive" ? tw("action_archive") : tw("action_unarchive")
      );
      setArchiveTarget(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, t("ui__ошибка_c6fd3c6a")));
    } finally {
      setArchiving(false);
    }
  }

  async function handleBulkArchive() {
    setArchiving(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          api.post(`/warehouse/products/${id}/archive`)
        )
      );
      toast.success(tw("bulk_archive"));
      setSelectedIds(new Set());
      setBulkArchiveOpen(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, t("ui__ошибка_c6fd3c6a")));
    } finally {
      setArchiving(false);
    }
  }

  const tb = useTranslations("warehouse.bom");
  const tbc = useTranslations("barcode.print");

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_LABEL_SELECT) next.add(id);
      else toast.warning(tbc("max_warning"));
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      const ids = rows.slice(0, MAX_LABEL_SELECT).map((r) => r.id);
      if (rows.length > MAX_LABEL_SELECT) toast.warning(tbc("max_warning"));
      setSelectedIds(new Set(ids));
    }
  }

  const selectedProducts = rows.filter((r) => selectedIds.has(r.id));
  const bulkLabels = selectedProducts.map(toLabel);

  const columns: Column<Product>[] = [
    {
      key: "id" as keyof Product,
      header: (
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-slate-300 text-brand-600 cursor-pointer"
          checked={rows.length > 0 && selectedIds.size === rows.length}
          ref={(el) => {
            if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < rows.length;
          }}
          onChange={toggleSelectAll}
          aria-label={tbc("select_labels")}
        />
      ) as unknown as string,
      width: "40px",
      align: "center" as const,
      render: (r: Product) => (
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-slate-300 text-brand-600 cursor-pointer"
          checked={selectedIds.has(r.id)}
          onChange={(e) => { e.stopPropagation(); toggleSelect(r.id); }}
          onClick={(e) => e.stopPropagation()}
          aria-label={r.name}
        />
      ),
    },
    { key: "sku", header: "SKU", width: "120px", render: (r) => r.sku || "—" },
    {
      key: "barcode",
      header: tw("col_barcode"),
      width: "160px",
      render: (r) => {
        const primary = r.primary_barcode || r.barcode;
        const count = r.active_barcode_count;
        if (!primary) return <span className="text-ink-400">—</span>;
        return (
          <span className="font-mono text-xs flex items-center gap-1">
            {primary}
            {count && count > 1 && (
              <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1 rounded">
                {tw("col_barcode_count", { n: count - 1 })}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "mxik",
      header: t("mxik"),
      width: "130px",
      render: (r) => (
        <span className="font-mono text-xs">{r.mxik || "—"}</span>
      ),
    },
    {
      key: "name",
      header: t("ui__название_602680ed"),
      render: (r) => (
        <span className="flex items-center gap-1.5">
          {r.name}
          {r.is_archived && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
              {tw("archived")}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "category_name",
      header: t("ui__категория_c95a1e2d"),
      width: "140px",
      render: (r) => r.category_name || "—",
    },
    {
      key: "default_supplier_name" as keyof Product,
      header: tw("col_supplier"),
      width: "140px",
      render: (r) => r.default_supplier_name || "—",
    },
    {
      key: "product_type",
      header: tw("col_product_type"),
      width: "120px",
      render: (r) => r.product_type || "—",
    },
    {
      key: "rack_name",
      header: tw("col_rack"),
      width: "100px",
      render: (r) => r.rack_name || "—",
    },
    {
      key: "default_cell_code",
      header: tw("col_cell"),
      width: "90px",
      render: (r) =>
        r.default_cell_code ? (
          <span className="font-mono text-xs">{r.default_cell_code}</span>
        ) : (
          "—"
        ),
    },
    {
      key: "unit_name",
      header: t("ui__ед_11f95ddc"),
      width: "80px",
      render: (r) => r.unit_name || "—",
    },
    {
      key: "purchase_price",
      header: t("ui__закуп_57c36fc5"),
      align: "right",
      width: "120px",
      render: (r) => <span className="font-mono">{fmt(r.purchase_price)}</span>,
    },
    {
      key: "sale_price",
      header: t("ui__продажа_78b786c5"),
      align: "right",
      width: "140px",
      render: (r) => (
        <span className="font-mono">
          {fmt(r.sale_price)} {r.currency_code}
        </span>
      ),
    },
    {
      key: "total_stock",
      header: t("ui__остаток_9a6054b1"),
      align: "right",
      width: "100px",
      render: (r) => (
        <span className="font-mono">
          {r.is_service ? "—" : fmt(r.total_stock)}
        </span>
      ),
    },
    {
      key: "is_service",
      header: t("ui__тип_345805b8"),
      align: "center",
      width: "100px",
      render: (r) =>
        r.is_service ? (
          <span className="text-xs text-blue-700 dark:text-blue-400">
            {t("ui__услуга_8bf3c249")}
          </span>
        ) : r.is_produced ? (
          <span className="text-xs text-purple-700 dark:text-purple-400">
            {t("ui__произв_ea4594a1")}
          </span>
        ) : (
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {t("ui__товар_8b35db64")}
          </span>
        ),
    },
    ...(can("warehouse.bom.view")
      ? [
          {
            key: "bom_action" as keyof Product,
            header: tb("col_header"),
            align: "center" as const,
            width: "80px",
            render: (r: Product) => (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setBomTarget(r);
                }}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-brand-300 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30 transition-colors"
                title={tb("tab_label")}
              >
                <ClipboardList size={12} />
                BOM
              </button>
            ),
          },
        ]
      : []),
    {
      key: "barcode_action" as keyof Product,
      header: "",
      align: "center" as const,
      width: "70px",
      render: (r: Product) => (
        <button
          type="button"
          title={tw("barcodes_title")}
          onClick={(e) => {
            e.stopPropagation();
            setBarcodesTarget(r);
          }}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-ink-300 dark:border-ink-600 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
        >
          <Barcode size={12} />
        </button>
      ),
    },
    ...(can("warehouse.product_archive")
      ? [
          {
            key: "archive_action" as keyof Product,
            header: "",
            align: "center" as const,
            width: "70px",
            render: (r: Product) =>
              r.is_archived ? (
                <button
                  type="button"
                  title={tw("action_unarchive")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setArchiveTarget({ product: r, action: "unarchive" });
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                >
                  <ArchiveRestore size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  title={tw("action_archive")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setArchiveTarget({ product: r, action: "archive" });
                  }}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Archive size={12} />
                </button>
              ),
          },
        ]
      : []),
    {
      key: "print_action" as keyof Product,
      header: "",
      align: "center" as const,
      width: "70px",
      render: (r: Product) => {
        const hasBarcode = !!(r.barcode || r.sku || r.id);
        return (
          <button
            type="button"
            disabled={!hasBarcode}
            title={hasBarcode ? tbc("row_action") : tbc("no_barcode")}
            onClick={(e) => {
              e.stopPropagation();
              setPrintTarget(r);
            }}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-ink-300 dark:border-ink-600 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Printer size={12} />
            {tbc("row_action")}
          </button>
        );
      },
    },
  ];

  const toolbarActions = (
    <div className="flex items-center gap-2 flex-wrap">
      {selectedIds.size > 0 && can("warehouse.product_archive") && (
        <button
          type="button"
          onClick={() => setBulkArchiveOpen(true)}
          className="inline-flex items-center gap-1.5 border border-zinc-400 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900/30 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 text-zinc-700 dark:text-zinc-300 text-[clamp(12px,1.6vw,13px)] font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
        >
          <Archive size={14} />
          {tw("bulk_archive")} ({selectedIds.size})
        </button>
      )}
      {selectedIds.size > 0 && (
        <button
          type="button"
          onClick={() => setBulkPrintOpen(true)}
          className="inline-flex items-center gap-1.5 border border-brand-400 dark:border-brand-600 bg-brand-50 dark:bg-brand-950/30 hover:bg-brand-100 dark:hover:bg-brand-950/50 text-brand-700 dark:text-brand-300 text-[clamp(12px,1.6vw,13px)] font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
        >
          <Printer size={14} />
          {tbc("bulk_print")} ({selectedIds.size})
        </button>
      )}
      {can("warehouse.product.export") && (
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-900 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-60 text-ink-700 dark:text-ink-200 text-[clamp(12px,1.6vw,13px)] font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
        >
          <Download size={14} />
          {exporting ? tw("export_loading") : tw("export_btn")}
        </button>
      )}
      {can("warehouse.product.import") && (
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-1.5 border border-ink-300 dark:border-ink-600 bg-white dark:bg-ink-900 hover:bg-ink-50 dark:hover:bg-ink-800 text-ink-700 dark:text-ink-200 text-[clamp(12px,1.6vw,13px)] font-medium px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
        >
          <Upload size={14} />
          {tw("import_btn")}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ui__товары_2ccd69a3")}
        description={t("ui__каталог_товаров_и_услуг_b8c9dd1f")}
        actions={toolbarActions}
        onCreate={() => {
          setForm(empty);
          setEditId(null);
          setOpen(true);
        }}
      />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="col-span-1 sm:col-span-2 relative">
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__поиск_название_sku_штрих_код_369d9946")}
          </label>
          <Search size={14} className="absolute left-2.5 top-[34px] text-slate-400" />
          <input
            className={`${input} pl-8`}
            placeholder={t("ui__поиск_b84a8f87")}
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
            {t("ui__категория_c95a1e2d")}
          </label>
          <select
            className={input}
            value={filters.category_id}
            onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
          >
            <option value="">{t("ui__все_a07b234e")}</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2 flex-col sm:flex-row">
          <div className="flex-1 w-full">
            <select
              className={input}
              value={filters.is_service}
              onChange={(e) => setFilters({ ...filters, is_service: e.target.value })}
            >
              <option value="">{t("ui__все_типы_eb6499ca")}</option>
              <option value="false">{t("ui__товары_2ccd69a3")}</option>
              <option value="true">{t("ui__услуги_4e1a0e95")}</option>
            </select>
          </div>
          <button
            onClick={load}
            className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700 whitespace-nowrap"
          >
            {t("ui__фильтр_2f884b41")}
          </button>
        </div>
        <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-slate-300 text-brand-600 cursor-pointer"
              checked={filters.include_archived}
              onChange={(e) =>
                setFilters({ ...filters, include_archived: e.target.checked })
              }
            />
            {tw("filter_include_archived")}
          </label>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          onEdit={(r) => openEdit(r)}
          onDelete={(r) => setDeleteTarget(r)}
        />
      </div>

      {/* Mobile cards */}
      <ul className="md:hidden space-y-2">
        {loading && (
          <li className="text-center text-sm text-slate-400 py-8">
            {t("ui__загрузка_43e40d49")}
          </li>
        )}
        {!loading && rows.length === 0 && (
          <li className="text-center text-sm text-slate-400 py-8">
            {t("ui__нет_данных_dee9a2d8")}
          </li>
        )}
        {rows.map((r) => (
          <li
            key={r.id}
            className={`bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-sm ${r.is_archived ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate flex items-center gap-1.5">
                  {r.name}
                  {r.is_archived && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                      {tw("archived")}
                    </span>
                  )}
                </div>
                {r.sku && (
                  <div className="text-xs text-slate-500 font-mono truncate">SKU: {r.sku}</div>
                )}
                {r.mxik && (
                  <div className="text-xs text-slate-500 font-mono truncate">
                    {t("mxik")}: {r.mxik}
                  </div>
                )}
                {(r.primary_barcode || r.barcode) && (
                  <div className="text-xs text-slate-500 font-mono truncate">
                    {tw("col_barcode")}: {r.primary_barcode || r.barcode}
                    {r.active_barcode_count && r.active_barcode_count > 1 && (
                      <span className="ml-1 text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 px-1 rounded">
                        {tw("col_barcode_count", { n: r.active_barcode_count - 1 })}
                      </span>
                    )}
                  </div>
                )}
                {r.category_name && (
                  <div className="text-xs text-slate-400 truncate">{r.category_name}</div>
                )}
                {r.default_supplier_name && (
                  <div className="text-xs text-slate-400 truncate">
                    {tw("col_supplier")}: {r.default_supplier_name}
                  </div>
                )}
                {r.product_type && (
                  <div className="text-xs text-slate-400 truncate">{r.product_type}</div>
                )}
                {r.rack_name && (
                  <div className="text-xs text-slate-400 truncate">
                    {tw("col_rack")}: {r.rack_name}
                  </div>
                )}
                {r.default_cell_code && (
                  <div className="text-xs text-slate-400 font-mono truncate">
                    {tw("col_cell")}: {r.default_cell_code}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-sm">
                  {fmt(r.sale_price)} {r.currency_code}
                </div>
                <div className="text-xs text-slate-500">{r.unit_name || "—"}</div>
                {!r.is_service && (
                  <div className="text-xs text-slate-400">
                    {t("ui__остаток_9a6054b1")}: {fmt(r.total_stock)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex-wrap">
              <button
                aria-label="Tahrirlash"
                onClick={() => openEdit(r)}
                className="text-xs text-brand-600 hover:text-brand-700"
              >
                Tahrir
              </button>
              <button
                aria-label="O'chirish"
                onClick={() => setDeleteTarget(r)}
                className="text-xs text-rose-600 hover:text-rose-700"
              >
                O&apos;chir
              </button>
              {can("warehouse.bom.view") && (
                <button
                  type="button"
                  onClick={() => setBomTarget(r)}
                  className="text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
                >
                  <ClipboardList size={11} />
                  BOM
                </button>
              )}
              <button
                type="button"
                onClick={() => setBarcodesTarget(r)}
                className="text-xs text-ink-600 dark:text-ink-300 hover:text-ink-800 inline-flex items-center gap-1"
                title={tw("barcodes_title")}
              >
                <Barcode size={11} />
                {tw("barcodes_title")}
              </button>
              {can("warehouse.product_archive") && (
                r.is_archived ? (
                  <button
                    type="button"
                    onClick={() => setArchiveTarget({ product: r, action: "unarchive" })}
                    className="text-xs text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                  >
                    <ArchiveRestore size={11} />
                    {tw("action_unarchive")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setArchiveTarget({ product: r, action: "archive" })}
                    className="text-xs text-zinc-600 hover:text-zinc-700 inline-flex items-center gap-1"
                  >
                    <Archive size={11} />
                    {tw("action_archive")}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setPrintTarget(r)}
                className="text-xs text-ink-600 dark:text-ink-300 hover:text-ink-800 inline-flex items-center gap-1"
                title={tbc("row_action")}
              >
                <Printer size={11} />
                {tbc("row_action")}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
        size="lg"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label={t("ui__название_602680ed")} required>
              <input
                className={input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
          </div>
          <Field label="SKU">
            <input
              className={input}
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </Field>
          <Field label={t("mxik")}>
            <MxikCombobox
              value={form.mxik || ""}
              onChange={(code) => setForm({ ...form, mxik: code })}
            />
          </Field>
          <Field label={t("ui__штрих_код_067fa0f2")}>
            <input
              className={input}
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            />
          </Field>
          <Field label={t("ui__категория_c95a1e2d")}>
            <select
              className={input}
              value={form.category_id || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  category_id: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">{t("ui__нет_7b07413e")}</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("ui__единица_c0ffee84")}>
            <select
              className={input}
              value={form.unit_id || ""}
              onChange={(e) =>
                setForm({ ...form, unit_id: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">{t("ui__нет_7b07413e")}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("ui__цена_закупа_9ae1384c")}>
            <input
              type="number"
              step="0.01"
              className={input}
              value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })}
            />
          </Field>
          <Field label={t("ui__цена_продажи_b379afd3")}>
            <input
              type="number"
              step="0.01"
              className={input}
              value={form.sale_price}
              onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })}
            />
          </Field>
          <Field label={t("ui__валюта_cf55d9a9")}>
            <select
              className={input}
              value={form.currency_id || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  currency_id: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">{t("ui__нет_7b07413e")}</option>
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c as { code?: string }).code || c.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="col-span-2">
            <Field label={tw("default_supplier")}>
              <select
                className={input}
                value={form.default_supplier_id || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    default_supplier_id: e.target.value || null,
                  })
                }
              >
                <option value="">{tw("default_supplier_placeholder")}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="col-span-2">
            <Field label={tw("product_type_label")}>
              <input
                className={input}
                placeholder={tw("product_type_placeholder")}
                value={form.product_type || ""}
                onChange={(e) => setForm({ ...form, product_type: e.target.value })}
              />
            </Field>
          </div>

          {/* Default cell — cascade warehouse → row → rack → cell */}
          <div className="col-span-2">
            <label className="text-[12px] text-ink-600 dark:text-ink-400 font-medium block mb-1">
              {tw("cell_label")}
            </label>
            <CellPicker
              rackValue={form.default_rack_id}
              cellValue={form.default_cell_id}
              onRackChange={(id) => setForm({ ...form, default_rack_id: id })}
              onCellChange={(id) => setForm({ ...form, default_cell_id: id })}
              warehouses={warehouses}
              tw={tw}
            />
          </div>

          <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded border border-slate-200 dark:border-slate-700">
            <div className="col-span-3 text-xs font-semibold text-slate-500 uppercase">
              Tur va flag&apos;lar
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_service}
                onChange={(e) => setForm({ ...form, is_service: e.target.checked })}
              />
              Xizmat (sklad yo&apos;q)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_material}
                onChange={(e) => setForm({ ...form, is_material: e.target.checked })}
              />
              Xom-ashyo (material)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_semi_product}
                onChange={(e) => setForm({ ...form, is_semi_product: e.target.checked })}
              />
              Yarim tayyor mahsulot
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_marked}
                onChange={(e) => setForm({ ...form, is_marked: e.target.checked })}
              />
              Markirovkali (Soliq.uz)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.has_expiration}
                onChange={(e) => setForm({ ...form, has_expiration: e.target.checked })}
              />
              Yaroqlilik muddati bor
            </label>
          </div>

          {editId && (
            <div className="col-span-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">
                {tw("barcodes_title")}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  const product = rows.find((r) => r.id === editId);
                  if (product) setBarcodesTarget(product);
                }}
                className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 underline underline-offset-2"
              >
                <Barcode size={14} />
                {tw("barcodes_title")}
              </button>
            </div>
          )}

          <div className="col-span-2 grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2 text-xs font-semibold text-slate-500 uppercase">
              Qo&apos;shimcha ma&apos;lumotlar
            </div>
            <Field label="Quti shtrix-kodi">
              <input
                className={input}
                value={form.box_barcode}
                onChange={(e) => setForm({ ...form, box_barcode: e.target.value })}
              />
            </Field>
            <Field label="Quti hajmi (ta)">
              <input
                type="number"
                className={input}
                value={form.box_qty}
                onChange={(e) => setForm({ ...form, box_qty: e.target.value })}
              />
            </Field>
          </div>

          <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 text-xs font-semibold text-slate-500 uppercase">
              O&apos;lcham va vazn
            </div>
            <Field label="Uzunlik (sm)">
              <input
                type="number"
                step="0.1"
                className={input}
                value={form.dim_length}
                onChange={(e) => setForm({ ...form, dim_length: e.target.value })}
              />
            </Field>
            <Field label="Eni (sm)">
              <input
                type="number"
                step="0.1"
                className={input}
                value={form.dim_width}
                onChange={(e) => setForm({ ...form, dim_width: e.target.value })}
              />
            </Field>
            <Field label="Bo'yi (sm)">
              <input
                type="number"
                step="0.1"
                className={input}
                value={form.dim_height}
                onChange={(e) => setForm({ ...form, dim_height: e.target.value })}
              />
            </Field>
            <Field label="Vazn (kg)">
              <input
                type="number"
                step="0.001"
                className={input}
                value={form.dim_weight}
                onChange={(e) => setForm({ ...form, dim_weight: e.target.value })}
              />
            </Field>
          </div>

          <div className="col-span-2 mt-2">
            <Field label="Rasm URL">
              <input
                className={input}
                value={form.image_url}
                placeholder="https://..."
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
            </Field>
          </div>

          <div className="col-span-2 mt-2">
            <Field label="Tavsif">
              <textarea
                className={`${input} h-16`}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>

          <div className="col-span-2 mt-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">
              Teglar
            </label>
            <TagsInput
              value={form.tag_ids}
              onChange={(ids) => setForm({ ...form, tag_ids: ids })}
            />
          </div>

          {editId && <CustomFieldsEditor entityType="product" entityId={editId} />}

          <div className="col-span-2 flex justify-end gap-2 pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              {t("ui__отмена_987b33c6")}
            </button>
            <button
              onClick={save}
              className="px-4 py-2 text-sm rounded-md bg-brand-600 text-white hover:bg-brand-700"
            >
              {t("ui__сохранить_74ea58b6")}
            </button>
          </div>
        </div>
      </Modal>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          setImportOpen(false);
          load();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="O'chirishni tasdiqlang"
        message={`«${deleteTarget?.name}» mahsulotini o'chirishni tasdiqlaysizmi?`}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchiveAction}
        title={
          archiveTarget?.action === "archive"
            ? tw("archive_title")
            : tw("unarchive_title")
        }
        message={
          archiveTarget?.action === "archive"
            ? tw("archive_message", { name: archiveTarget.product.name })
            : tw("unarchive_message", { name: archiveTarget?.product.name ?? "" })
        }
      />

      <ConfirmDialog
        open={bulkArchiveOpen}
        onClose={() => setBulkArchiveOpen(false)}
        onConfirm={handleBulkArchive}
        title={tw("bulk_archive")}
        message={`${selectedIds.size} ta mahsulot arxivlanadi. Davom etasizmi?`}
      />

      <BomEditorModal
        open={!!bomTarget}
        onClose={() => setBomTarget(null)}
        productId={bomTarget?.id ?? ""}
        productName={bomTarget?.name ?? ""}
      />

      <BarcodesModal
        open={!!barcodesTarget}
        onClose={() => setBarcodesTarget(null)}
        productId={barcodesTarget?.id ?? ""}
        productName={barcodesTarget?.name ?? ""}
      />

      <LabelPrint
        items={printTarget ? [toLabel(printTarget)] : []}
        format="A4"
        open={!!printTarget}
        onClose={() => setPrintTarget(null)}
      />

      <LabelPrint
        items={bulkLabels}
        format="A4"
        open={bulkPrintOpen}
        onClose={() => setBulkPrintOpen(false)}
      />
    </div>
  );
}
