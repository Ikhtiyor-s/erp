"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Check, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { input } from "@/components/ui/modal";

export interface PickerItem {
  productId: string;
  productName: string;
  unitId: number;
  unitName: string;
  onHand: number;
  defaultCellCode: string | null;
}

export interface ProductPickerProps {
  warehouseId: number;
  onAdd: (item: PickerItem) => void;
  selectedIds?: string[];
  mode?: "single" | "multi";
}

interface ApiProduct {
  id: string;
  name: string;
  sku: string | null;
  model: string | null;
  product_type: string | null;
  product_type_label: string | null;
  category_id: number | null;
  category_name: string | null;
  unit_id: number;
  unit_name: string;
  on_hand: number;
  default_cell_id: string | null;
  default_cell_code: string | null;
}

interface ApiResponse {
  total: number;
  page: number;
  limit: number;
  items: ApiProduct[];
}

const LIMIT = 30;

const MOCK_ITEMS: ApiProduct[] = [
  {
    id: "1",
    name: "Test mahsulot",
    sku: "TST-01",
    model: null,
    product_type: "finished",
    product_type_label: "Tayyor mahsulot",
    category_id: 1,
    category_name: "Umumiy",
    unit_id: 1,
    unit_name: "dona",
    on_hand: 100,
    default_cell_id: null,
    default_cell_code: null,
  },
  {
    id: "2",
    name: "Xom ashyo namuna",
    sku: "XAN-02",
    model: "M-100",
    product_type: "raw",
    product_type_label: "Xom ashyo",
    category_id: 2,
    category_name: "Materiallar",
    unit_id: 2,
    unit_name: "kg",
    on_hand: 0,
    default_cell_id: null,
    default_cell_code: "A-1",
  },
];

function toPickerItem(p: ApiProduct): PickerItem {
  return {
    productId: p.id,
    productName: p.name,
    unitId: p.unit_id,
    unitName: p.unit_name,
    onHand: p.on_hand,
    defaultCellCode: p.default_cell_code,
  };
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <td key={i} className="px-3 py-2">
          <div className="h-3 rounded bg-ink-200 dark:bg-ink-700 animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonCard() {
  return (
    <li className="p-3 rounded-lg border border-ink-200 dark:border-ink-800 space-y-2">
      <div className="h-3 w-3/4 rounded bg-ink-200 dark:bg-ink-700 animate-pulse" />
      <div className="h-3 w-1/2 rounded bg-ink-200 dark:bg-ink-700 animate-pulse" />
    </li>
  );
}

export function ProductPicker({
  warehouseId,
  onAdd,
  selectedIds = [],
  mode = "multi",
}: ProductPickerProps) {
  const t = useTranslations("warehouse.picker");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productType, setProductType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse>({
    total: 0,
    page: 1,
    limit: LIMIT,
    items: [],
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        warehouse_id: warehouseId,
        page,
        limit: LIMIT,
      };
      if (debouncedSearch) params.q = debouncedSearch;
      if (categoryId) params.category_id = categoryId;
      if (productType) params.product_type = productType;

      const res = await api.get<ApiResponse>("/warehouse/products", { params });
      setData(res.data);
    } catch {
      setData({ total: MOCK_ITEMS.length, page: 1, limit: LIMIT, items: MOCK_ITEMS });
    } finally {
      setLoading(false);
    }
  }, [warehouseId, page, debouncedSearch, categoryId, productType]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function handleCategoryChange(val: string) {
    setCategoryId(val);
    setPage(1);
  }

  function handleProductTypeChange(val: string) {
    setProductType(val);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(data.total / LIMIT));
  const visibleItems = data.items.filter((p) => !selectedIds.includes(p.id));

  const productTypeOptions = [
    { value: "finished", label: t("type_finished") },
    { value: "raw", label: t("type_raw") },
    { value: "semi", label: t("type_semi") },
    { value: "service", label: t("type_service") },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          className={input}
          placeholder={t("search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={input}
          value={categoryId}
          onChange={(e) => handleCategoryChange(e.target.value)}
        >
          <option value="">{t("all_categories")}</option>
        </select>
        <select
          className={input}
          value={productType}
          onChange={(e) => handleProductTypeChange(e.target.value)}
        >
          <option value="">{t("all_types")}</option>
          {productTypeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden md:block overflow-x-auto rounded-md border border-ink-200 dark:border-ink-800">
        <table className="w-full text-[13px]">
          <thead className="bg-ink-50 dark:bg-ink-900/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400 w-10">#</th>
              <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400">{t("col_name")}</th>
              <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400">{t("col_model")}</th>
              <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400">{t("col_category")}</th>
              <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400 w-24">{t("col_on_hand")}</th>
              <th className="px-3 py-2 text-left font-medium text-ink-600 dark:text-ink-400 w-20">{t("col_unit")}</th>
              <th className="px-3 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200/60 dark:divide-ink-800/60">
            {loading &&
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

            {!loading && visibleItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-[13px] text-ink-400 dark:text-ink-500">
                  {t("empty")}
                </td>
              </tr>
            )}

            {!loading &&
              visibleItems.map((p, idx) => {
                const isSelected = selectedIds.includes(p.id);
                const rowIndex = (page - 1) * LIMIT + idx + 1;
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-ink-50/50 dark:hover:bg-ink-800/20 transition-colors"
                  >
                    <td className="px-3 py-2 text-ink-400 dark:text-ink-500">{rowIndex}</td>
                    <td className="px-3 py-2 text-ink-900 dark:text-ink-100 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-ink-500 dark:text-ink-400">
                      {p.product_type_label ?? p.model ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-ink-500 dark:text-ink-400">{p.category_name ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                          p.on_hand > 0
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                        }`}
                      >
                        {p.on_hand.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-ink-500 dark:text-ink-400">{p.unit_name}</td>
                    <td className="px-3 py-2 text-right">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[12px]">
                          <Check size={14} />
                          {t("added")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAdd(toPickerItem(p))}
                          disabled={mode === "single" && selectedIds.length > 0}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[12px] bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Plus size={12} />
                          {t("add_btn")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden space-y-2">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}

        {!loading && visibleItems.length === 0 && (
          <li className="py-6 text-center text-[13px] text-ink-400 dark:text-ink-500">
            {t("empty")}
          </li>
        )}

        {!loading &&
          visibleItems.map((p) => {
            const isSelected = selectedIds.includes(p.id);
            return (
              <li
                key={p.id}
                className="p-3 rounded-lg border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-medium text-ink-900 dark:text-ink-100">{p.name}</p>
                    {p.category_name && (
                      <p className="text-[11px] text-ink-400 dark:text-ink-500">{p.category_name}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${
                      p.on_hand > 0
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                    }`}
                  >
                    {p.on_hand.toLocaleString("ru-RU", { maximumFractionDigits: 3 })} {p.unit_name}
                  </span>
                </div>
                {p.product_type_label && (
                  <p className="text-[11px] text-ink-500 dark:text-ink-400">{p.product_type_label}</p>
                )}
                <div>
                  {isSelected ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[12px]">
                      <Check size={13} />
                      {t("added")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAdd(toPickerItem(p))}
                      disabled={mode === "single" && selectedIds.length > 0}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[12px] bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={12} />
                      {t("add_btn")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
      </ul>

      {data.total > LIMIT && (
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-[12px] border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
            {t("prev")}
          </button>
          <span className="text-[12px] text-ink-500 dark:text-ink-400">
            {t("page_of", { page, total: totalPages })}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-[12px] border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t("next")}
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
