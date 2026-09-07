"use client";

import { AlertTriangle } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./button";

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
      ? "bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-500"
      : "bg-warn-50 text-warn-600 dark:bg-warn-500/15 dark:text-warn-500";

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-3">
        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconBg}`}>
          <AlertTriangle size={18} aria-hidden="true" />
        </div>
        <p className="text-sm text-ink-700 dark:text-ink-300 leading-relaxed">
          {message}
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" size="md" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={variant === "danger" ? "danger" : "warning"}
          size="md"
          onClick={onConfirm}
          disabled={loading}
          loading={loading}
          autoFocus
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
