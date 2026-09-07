import { cn } from "@/lib/cn";

type Tone = "success" | "warning" | "danger" | "info" | "primary" | "neutral" | "teal" | "purple";

interface BadgeProps {
  tone?: Tone;
  soft?: boolean;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}

const SOLID: Record<Tone, string> = {
  success: "bg-success-600 text-white",
  warning: "bg-warn-500 text-white",
  danger:  "bg-danger-600 text-white",
  info:    "bg-info-500 text-white",
  primary: "bg-brand-600 text-white",
  neutral: "bg-ink-500 text-white",
  teal:    "bg-teal-500 text-white",
  purple:  "bg-purple-600 text-white",
};

const SOFT: Record<Tone, string> = {
  success: "bg-success-50 dark:bg-success-500/15 text-success-700 dark:text-success-500",
  warning: "bg-warn-50 dark:bg-warn-500/15 text-warn-700 dark:text-warn-500",
  danger:  "bg-danger-50 dark:bg-danger-500/15 text-danger-700 dark:text-danger-500",
  info:    "bg-info-50 dark:bg-info-500/15 text-info-700 dark:text-info-500",
  primary: "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400",
  neutral: "bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400",
  teal:    "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400",
  purple:  "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
};

const DOT: Record<Tone, string> = {
  success: "bg-success-500",
  warning: "bg-warn-500",
  danger:  "bg-danger-500",
  info:    "bg-info-500",
  primary: "bg-brand-500",
  neutral: "bg-ink-400",
  teal:    "bg-teal-500",
  purple:  "bg-purple-500",
};

export function Badge({ tone = "neutral", soft = true, dot = false, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium leading-none whitespace-nowrap",
        soft ? SOFT[tone] : SOLID[tone],
        className
      )}
    >
      {dot && (
        <span className={cn("size-1.5 rounded-full shrink-0", DOT[tone])} aria-hidden="true" />
      )}
      {children}
    </span>
  );
}
