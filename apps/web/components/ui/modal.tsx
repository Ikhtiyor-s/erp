"use client";

import { X } from "lucide-react";
import { Children, cloneElement, isValidElement, useEffect, useId, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, children, size = "md" }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    // Remember what had focus before, restore on close
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    function getFocusable(): HTMLElement[] {
      const dlg = dialogRef.current;
      if (!dlg) return [];
      return Array.from(dlg.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    }

    // Auto-focus first focusable element inside the dialog
    const focusables = getFocusable();
    if (focusables.length > 0) {
      focusables[0]?.focus();
    } else {
      dialogRef.current?.focus();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      // Restore focus to whatever opened the modal
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh] bg-ink-900/30 dark:bg-ink-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-white dark:bg-ink-900 text-ink-900 dark:text-ink-100 rounded-lg border border-ink-200/60 dark:border-ink-800/60 shadow-lg w-full ${widths[size]} max-h-[85vh] overflow-auto focus:outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-200/60 dark:border-ink-800/60">
          <h2 id={titleId} className="text-[14px] font-semibold tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] rounded bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 font-mono">
              Esc
            </kbd>
            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="p-1 rounded hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-100"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
  id?: string;
};

export function Field({ label, children, required, hint, id: idProp }: FieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  // Inject id into the first input/select/textarea child
  const childWithId = Children.map(children, (child, index) => {
    if (index === 0 && isValidElement(child)) {
      const el = child as React.ReactElement<{ id?: string }>;
      if (!el.props.id) {
        return cloneElement(el, { id });
      }
    }
    return child;
  });

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[12px] text-ink-600 dark:text-ink-400 font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {childWithId}
      {hint && (
        <p className="text-[11px] text-ink-400 dark:text-ink-500">{hint}</p>
      )}
    </div>
  );
}

export const input =
  "w-full border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-950 text-ink-900 dark:text-ink-100 rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 placeholder:text-ink-400 dark:placeholder:text-ink-600 transition-colors";
