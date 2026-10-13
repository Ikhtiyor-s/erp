"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { usePermissions } from "@/lib/permissions";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { input as inputClass } from "@/components/ui/modal";

type PriceOverride = {
  product_id: string;
  product_name: string;
  price: number;
  notes: string | null;
  updated_at: string | null;
};

type ProductSearchResult = {
  id: string;
  name: string;
  sku: string | null;
  sale_price: number | null;
};

const fmt = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

export function CustomerPriceOverrides({
  customerId,
  categoryName,
  categoryDiscountPct,
}: {
  customerId: string;
  categoryName: string | null | undefined;
  categoryDiscountPct: number | null;
}) {
  const t = useTranslations("customer");
  const tc = useTranslations("common");
  const { can } = usePermissions();

  const canCreate = can("customer.create");
  const canDelete = can("customer.delete");

  const [items, setItems] = useState<PriceOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<{ items: PriceOverride[] }>(`/customer/customers/${customerId}/prices`)
      .then((r) => setItems(r.data.items))
      .catch((e) => setError(getErrorMessage(e, t("load_error"))))
      .finally(() => setLoading(false));
  }, [customerId, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!formOpen || selectedProduct) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      api
        .get<ProductSearchResult[]>("/warehouse/products", { params: { q: query, limit: 20 } })
        .then((r) => setResults(r.data))
        .catch((e) => setSearchError(getErrorMessage(e, t("search_error"))))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, formOpen, selectedProduct, t]);

  function openForm() {
    setFormOpen(true);
    setSelectedProduct(null);
    setPriceInput("");
    setNotesInput("");
    setFormError(null);
    setQuery("");
    setResults([]);
  }

  function closeForm() {
    setFormOpen(false);
  }

  function pickProduct(p: ProductSearchResult) {
    setSelectedProduct(p);
    setQuery(p.name);
    setResults([]);
    if (p.sale_price != null) setPriceInput(String(p.sale_price));
  }

  const priceValid =
    priceInput.trim() !== "" && !Number.isNaN(Number(priceInput)) && Number(priceInput) >= 0;

  async function submit() {
    if (!selectedProduct) {
      setFormError(t("select_product_first"));
      return;
    }
    if (!priceValid) {
      setFormError(t("price_invalid"));
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post(`/customer/customers/${customerId}/prices`, {
        product_id: selectedProduct.id,
        price: Number(priceInput),
        notes: notesInput.trim() || null,
      });
      toast.success(tc("saved"));
      closeForm();
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(productId: string) {
    setRemovingId(productId);
    try {
      await api.delete(`/customer/customers/${customerId}/prices/${productId}`);
      toast.success(tc("deleted"));
      setItems((prev) => prev.filter((i) => i.product_id !== productId));
    } catch (e) {
      toast.error(getErrorMessage(e, tc("error")));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card padding="none">
      <CardHeader
        title={t("price_overrides_title")}
        description={t("price_overrides_hint")}
        actions={
          canCreate && !formOpen ? (
            <Button type="button" size="sm" icon={Plus} onClick={openForm}>
              {t("add_override")}
            </Button>
          ) : undefined
        }
      />

      <div className="px-4 sm:px-5 py-3 border-b border-ink-200/60 dark:border-ink-800/60 flex items-center gap-2 flex-wrap text-[12px] text-ink-500 dark:text-ink-400">
        <span>{t("segment_precedence_label")}:</span>
        <Badge tone="primary">{t("precedence_override")}</Badge>
        <span>&rarr;</span>
        {categoryName ? (
          <Badge tone="info">
            {categoryName}
            {categoryDiscountPct != null && categoryDiscountPct > 0 ? ` (-${categoryDiscountPct}%)` : ""}
          </Badge>
        ) : (
          <Badge tone="neutral">{t("no_segment")}</Badge>
        )}
        <span>&rarr;</span>
        <Badge tone="neutral">{t("precedence_standard")}</Badge>
      </div>

      {formOpen && (
        <div className="px-4 sm:px-5 py-4 border-b border-ink-200/60 dark:border-ink-800/60 space-y-3 bg-ink-50/40 dark:bg-ink-900/30">
          <div className="relative">
            <label className="text-[12px] text-ink-600 dark:text-ink-400 font-medium">
              {t("product_label")}
            </label>
            <div className="relative mt-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                className={`${inputClass} pl-8`}
                placeholder={t("product_search_placeholder")}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedProduct(null);
                }}
              />
            </div>
            {query && !selectedProduct && (
              <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-md border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-lg">
                {searching && (
                  <div className="px-3 py-2 text-[12px] text-ink-400">{tc("loading")}</div>
                )}
                {!searching && searchError && (
                  <div className="px-3 py-2 text-[12px] text-danger-600 dark:text-danger-500">
                    {searchError}
                  </div>
                )}
                {!searching && !searchError && results.length === 0 && (
                  <div className="px-3 py-2 text-[12px] text-ink-400">{t("no_products_found")}</div>
                )}
                {!searching &&
                  !searchError &&
                  results.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => pickProduct(p)}
                      className="w-full text-left px-3 py-2 text-[13px] hover:bg-ink-50 dark:hover:bg-ink-800 flex items-center justify-between gap-2"
                    >
                      <span className="text-ink-900 dark:text-ink-100">{p.name}</span>
                      {p.sale_price != null && (
                        <span className="text-ink-400 dark:text-ink-500 font-mono text-[12px]">
                          {fmt(p.sale_price)}
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] text-ink-600 dark:text-ink-400 font-medium">
                {t("price_label")}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={`${inputClass} mt-1 text-right`}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[12px] text-ink-600 dark:text-ink-400 font-medium">
                {tc("notes")}
              </label>
              <input
                className={`${inputClass} mt-1`}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder={t("notes_placeholder")}
              />
            </div>
          </div>

          {formError && <p className="text-[12px] text-danger-600 dark:text-danger-500">{formError}</p>}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={closeForm}>
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={submit}
              loading={submitting}
              disabled={!selectedProduct || !priceValid}
            >
              {tc("save")}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-ink-400 dark:text-ink-500 text-center py-6 text-sm">{tc("loading")}</div>
      ) : error ? (
        <div className="px-4 sm:px-5 py-4 text-[13px] text-danger-700 dark:text-danger-500 bg-danger-50 dark:bg-danger-500/10">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="text-ink-400 dark:text-ink-500 text-center py-6 text-sm">
          {t("no_overrides")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 dark:bg-ink-900">
              <tr className="text-ink-500 dark:text-ink-400 text-[11px] uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60">
                <th className="px-3 py-2 text-left font-medium">{t("product_label")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("price_label")}</th>
                <th className="px-3 py-2 text-left font-medium">{tc("notes")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("updated_at_label")}</th>
                {canDelete && <th className="px-3 py-2 w-10" />}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr
                  key={it.product_id}
                  className="border-b border-ink-100 dark:border-ink-800/40 last:border-0 hover:bg-ink-50/60 dark:hover:bg-ink-900/30"
                >
                  <td className="px-3 py-2.5 text-ink-900 dark:text-ink-100">{it.product_name}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-ink-900 dark:text-ink-100">
                    {fmt(it.price)}
                  </td>
                  <td className="px-3 py-2.5 text-ink-700 dark:text-ink-300">{it.notes || "—"}</td>
                  <td className="px-3 py-2.5 text-ink-700 dark:text-ink-300">
                    {it.updated_at ? new Date(it.updated_at).toLocaleString("ru-RU") : "—"}
                  </td>
                  {canDelete && (
                    <td className="px-3 py-2.5 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        icon={Trash2}
                        loading={removingId === it.product_id}
                        onClick={() => remove(it.product_id)}
                        className="text-danger-500 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/15"
                        aria-label={tc("delete")}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
