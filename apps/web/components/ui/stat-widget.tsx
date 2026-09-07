"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

type ColorKey = "brand" | "success" | "danger" | "warn" | "info" | "purple" | "teal" | "ink";

interface StatWidgetProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  color?: ColorKey;
  delta?: number;
  deltaLabel?: string;
  loading?: boolean;
  mono?: boolean;
  className?: string;
}

const ICON_BG: Record<ColorKey, string> = {
  brand:   "bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400",
  success: "bg-success-50 dark:bg-success-500/15 text-success-600 dark:text-success-500",
  danger:  "bg-danger-50 dark:bg-danger-500/15 text-danger-600 dark:text-danger-500",
  warn:    "bg-warn-50 dark:bg-warn-500/15 text-warn-600 dark:text-warn-500",
  info:    "bg-info-50 dark:bg-info-500/15 text-info-600 dark:text-info-500",
  purple:  "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  teal:    "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400",
  ink:     "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400",
};

const fmt = (v: string | number) =>
  typeof v === "number"
    ? v.toLocaleString("ru-RU", { maximumFractionDigits: 0 })
    : v;

export function StatWidget({
  label,
  value,
  subValue,
  icon: Icon,
  color = "brand",
  delta,
  deltaLabel,
  loading = false,
  mono = false,
  className,
}: StatWidgetProps) {
  const hasDelta = delta !== undefined && delta !== null;
  const isUp = hasDelta && delta > 0;
  const isDown = hasDelta && delta < 0;
  const DeltaIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "bg-white dark:bg-ink-950 rounded-lg border border-ink-200/60 dark:border-ink-800/60 p-4 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-ink-500 dark:text-ink-400 uppercase tracking-wider truncate">
            {label}
          </p>

          {loading ? (
            <div className="mt-2 h-7 w-24 rounded bg-ink-100 dark:bg-ink-800 animate-pulse" />
          ) : (
            <p
              className={cn(
                "mt-1.5 text-[clamp(18px,2.5vw,22px)] font-bold text-ink-900 dark:text-ink-50 leading-tight",
                mono && "font-mono"
              )}
            >
              {fmt(value)}
            </p>
          )}

          {subValue && !loading && (
            <p className="mt-0.5 text-[12px] text-ink-500 dark:text-ink-400 truncate">
              {subValue}
            </p>
          )}

          {hasDelta && !loading && (
            <div
              className={cn(
                "mt-2 inline-flex items-center gap-1 text-[11px] font-medium",
                isUp
                  ? "text-success-600 dark:text-success-500"
                  : isDown
                  ? "text-danger-600 dark:text-danger-500"
                  : "text-ink-400"
              )}
            >
              <DeltaIcon size={12} strokeWidth={2.5} />
              <span>
                {isUp && "+"}
                {delta.toFixed(1)}%
                {deltaLabel && <span className="text-ink-400 dark:text-ink-500 font-normal ml-1">{deltaLabel}</span>}
              </span>
            </div>
          )}
        </div>

        {Icon && (
          <div className={cn("shrink-0 rounded-xl p-2.5", ICON_BG[color])}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  );
}
