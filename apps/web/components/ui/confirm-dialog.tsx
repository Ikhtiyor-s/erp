"use client";

import { AlertTriangle } from "lucide-react";
import { Modal } from "./modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Tasdiqlash",
  cancelLabel = "Bekor",
  variant = "danger",
  loading,
}: Props) {
  const iconBg =
    variant === "danger"
      ? "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400"
      : "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400";
  const confirmBtn =
    variant === "danger"
      ? "bg-rose-600 hover:bg-rose-700"
      : "bg-amber-600 hover:bg-amber-700";

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-3">
        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
          <AlertTriangle size={18} aria-hidden="true" />
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {message}
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          autoFocus
          className={`px-3 py-1.5 text-sm rounded-md text-white ${confirmBtn} disabled:opacity-50`}
        >
          {loading ? "..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
