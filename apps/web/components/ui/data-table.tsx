"use client";

import { Pencil, Trash2, Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export type Column<T> = {
  key: keyof T | string;
  header: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => React.ReactNode;
  width?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
  emptyHint?: React.ReactNode;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T) => string | number;
};

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  loading,
  emptyText,
  emptyHint,
  onEdit,
  onDelete,
  onRowClick,
  rowKey = (r) => r.id,
}: Props<T>) {
  const t = useTranslations("common");
  const hasActions = !!(onEdit || onDelete);
  const empty = emptyText ?? t("no_data");

  return (
    <div className="bg-white dark:bg-ink-950 rounded-md border border-ink-200/60 dark:border-ink-800/60 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-ink-500 dark:text-ink-500 text-[11px] uppercase tracking-wider border-b border-ink-200/60 dark:border-ink-800/60">
              {columns.map((c) => (
                <th
                  key={String(c.key)}
                  style={{ width: c.width }}
                  className={cn(
                    "px-3 py-2 font-medium",
                    c.align === "right"
                      ? "text-right"
                      : c.align === "center"
                      ? "text-center"
                      : "text-left"
                  )}
                >
                  {c.header}
                </th>
              ))}
              {hasActions && <th className="px-3 py-2 w-16" />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr
                  key={i}
                  className="border-b border-ink-100 dark:border-ink-800/40 last:border-0"
                >
                  {columns.map((c) => (
                    <td key={String(c.key)} className="px-3 py-2.5">
                      <div className="h-2.5 rounded bg-ink-100 dark:bg-ink-800 animate-pulse" />
                    </td>
                  ))}
                  {hasActions && <td className="px-3 py-2.5" />}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (hasActions ? 1 : 0)}
                  className="text-center py-14"
                >
                  <div className="inline-flex flex-col items-center gap-2 text-ink-400 dark:text-ink-600">
                    <Inbox size={28} strokeWidth={1.5} />
                    <div className="text-[13px]">{empty}</div>
                    {emptyHint && (
                      <div className="text-[12px] mt-1 text-ink-500">
                        {emptyHint}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-ink-100 dark:border-ink-800/40 last:border-0 transition-colors",
                    "hover:bg-ink-50/80 dark:hover:bg-ink-900/40",
                    "text-ink-700 dark:text-ink-300",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={String(c.key)}
                      className={cn(
                        "px-3 py-2",
                        c.align === "right"
                          ? "text-right"
                          : c.align === "center"
                          ? "text-center"
                          : "text-left"
                      )}
                    >
                      {c.render
                        ? c.render(row)
                        : (row[c.key as keyof T] as React.ReactNode)}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="px-2 py-1.5 text-right">
                      <div className="row-actions inline-flex gap-0.5">
                        {onEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(row);
                            }}
                            className="p-1 rounded hover:bg-ink-200/70 dark:hover:bg-ink-800 text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-100 transition-colors"
                            title={t("edit")}
                            aria-label={t("edit")}
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(row);
                            }}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-ink-500 dark:text-ink-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title={t("delete")}
                            aria-label={t("delete")}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && rows.length > 0 && (
        <div className="px-3 py-1.5 text-[11px] text-ink-400 dark:text-ink-600 border-t border-ink-200/60 dark:border-ink-800/60">
          {rows.length}
        </div>
      )}
    </div>
  );
}
