"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "danger" | "success" | "warning" | "ghost" | "outline" | "light";
type Size = "xs" | "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white border-transparent shadow-sm",
  secondary:
    "bg-ink-100 hover:bg-ink-200 active:bg-ink-300 dark:bg-ink-800 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-200 border-transparent",
  danger:
    "bg-danger-500 hover:bg-danger-600 active:bg-danger-700 text-white border-transparent shadow-sm",
  success:
    "bg-success-500 hover:bg-success-600 active:bg-success-700 text-white border-transparent shadow-sm",
  warning:
    "bg-warn-500 hover:bg-warn-600 active:bg-warn-700 text-white border-transparent shadow-sm",
  ghost:
    "bg-transparent hover:bg-ink-100 dark:hover:bg-ink-800 text-ink-600 dark:text-ink-300 border-transparent",
  outline:
    "bg-white dark:bg-ink-900 hover:bg-ink-50 dark:hover:bg-ink-800 text-ink-700 dark:text-ink-200 border-ink-300 dark:border-ink-700",
  light:
    "bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/20 dark:hover:bg-brand-900/30 text-brand-700 dark:text-brand-300 border-transparent",
};

const SIZE_CLASSES: Record<Size, string> = {
  xs: "text-[11px] px-2 py-0.5 gap-1 rounded",
  sm: "text-[12px] px-2.5 py-1 gap-1.5 rounded-md",
  md: "text-[13px] px-3 py-1.5 gap-1.5 rounded-md",
  lg: "text-[14px] px-4 py-2 gap-2 rounded-md",
};

const ICON_SIZE: Record<Size, number> = { xs: 11, sm: 12, md: 14, lg: 16 };

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  iconRight?: React.ComponentType<{ size?: number; className?: string }>;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon: Icon,
      iconRight: IconRight,
      fullWidth = false,
      className,
      children,
      disabled,
      ...rest
    },
    ref
  ) => {
    const iconSz = ICON_SIZE[size];
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center font-medium border transition-colors whitespace-nowrap select-none",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          fullWidth && "w-full",
          className
        )}
        {...rest}
      >
        {loading ? (
          <Loader2 size={iconSz} className="animate-spin shrink-0" />
        ) : Icon ? (
          <Icon size={iconSz} className="shrink-0" />
        ) : null}
        {children}
        {!loading && IconRight && (
          <IconRight size={iconSz} className="shrink-0 ml-auto" />
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
