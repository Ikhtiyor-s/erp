"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/api-error";
import { input } from "@/components/ui/modal";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

type MxikResult = {
  code: string;
  name_uz: string;
  name_ru: string;
  unit: string | null;
};

const RECENT_KEY = "mxik_recent";
const RECENT_MAX = 5;

function loadRecent(): MxikResult[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecent(item: MxikResult) {
  const prev = loadRecent().filter((r) => r.code !== item.code);
  const next = [item, ...prev].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}

export interface MxikComboboxProps {
  value?: string;
  onChange: (code: string, name: string) => void;
}

export function MxikCombobox({ value, onChange }: MxikComboboxProps) {
  const t = useTranslations("warehouse.mxik");
  const locale = useLocale();

  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<MxikResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const [error, setError] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getName(r: MxikResult) {
    return locale === "ru" ? r.name_ru || r.name_uz : r.name_uz;
  }

  useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function triggerSearch(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setResults([]);
      setError("");
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get<MxikResult[]>("/reference/mxik/search", {
          params: { q, limit: 20 },
        });
        setResults(res.data);
      } catch (e) {
        setError(getErrorMessage(e, t("no_results")));
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setSelectedName("");
    setOpen(true);
    triggerSearch(val);
  }

  function handleFocus() {
    setOpen(true);
    if (query.length >= 2) {
      triggerSearch(query);
    }
  }

  function handleSelect(r: MxikResult) {
    const name = getName(r);
    setQuery(r.code);
    setSelectedName(name);
    setOpen(false);
    setResults([]);
    saveRecent(r);
    onChange(r.code, name);
  }

  function handleClear() {
    setQuery("");
    setSelectedName("");
    setResults([]);
    setOpen(false);
    onChange("", "");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") setOpen(false);
  }

  const recent = loadRecent();
  const showRecent = open && query.length < 2 && recent.length > 0;
  const showResults = open && results.length > 0;
  const showEmpty = open && !loading && query.length >= 2 && results.length === 0 && !error;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <input
          type="text"
          className={`${input} pl-8 pr-8`}
          value={query}
          placeholder={t("placeholder")}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          aria-label={t("label")}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {loading && (
          <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-ink-400" />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
            tabIndex={-1}
            aria-label="Tozalash"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {selectedName && (
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400 truncate">{selectedName}</p>
      )}

      {query.length === 1 && open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-md shadow-lg py-2 px-3">
          <p className="text-xs text-ink-400">{t("search_hint")}</p>
        </div>
      )}

      {(showRecent || showResults || showEmpty || error) && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-md shadow-lg overflow-auto"
          style={{ maxHeight: 280 }}
        >
          {showRecent && (
            <>
              <li className="px-3 py-1.5 text-[11px] font-semibold text-ink-400 uppercase tracking-wide select-none">
                {t("recent")}
              </li>
              {recent.map((r) => (
                <li
                  key={r.code}
                  role="option"
                  aria-selected={r.code === value}
                  tabIndex={0}
                  className="px-3 py-2 cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-950/30 focus:bg-brand-50 dark:focus:bg-brand-950/30 outline-none"
                  onClick={() => handleSelect(r)}
                  onKeyDown={(e) => e.key === "Enter" && handleSelect(r)}
                >
                  <span className="font-mono text-xs text-ink-600 dark:text-ink-400">{r.code}</span>
                  <span className="mx-2 text-ink-300">—</span>
                  <span className="text-sm text-ink-800 dark:text-ink-200">{getName(r)}</span>
                  {r.unit && (
                    <span className="ml-2 text-xs text-ink-400">({r.unit})</span>
                  )}
                </li>
              ))}
            </>
          )}

          {showResults &&
            results.map((r) => (
              <li
                key={r.code}
                role="option"
                aria-selected={r.code === value}
                tabIndex={0}
                className="px-3 py-2 cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-950/30 focus:bg-brand-50 dark:focus:bg-brand-950/30 outline-none"
                onClick={() => handleSelect(r)}
                onKeyDown={(e) => e.key === "Enter" && handleSelect(r)}
              >
                <span className="font-mono text-xs text-ink-600 dark:text-ink-400">{r.code}</span>
                <span className="mx-2 text-ink-300">—</span>
                <span className="text-sm text-ink-800 dark:text-ink-200">{getName(r)}</span>
                {r.unit && (
                  <span className="ml-2 text-xs text-ink-400">({r.unit})</span>
                )}
              </li>
            ))}

          {showEmpty && (
            <li className="px-3 py-2 text-sm text-ink-400 select-none">{t("no_results")}</li>
          )}

          {error && (
            <li className="px-3 py-2 text-sm text-rose-600 dark:text-rose-400 select-none">{error}</li>
          )}
        </ul>
      )}
    </div>
  );
}
