import { cn } from "@/lib/cn";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  shadow?: boolean;
}

interface CardHeaderProps {
  title?: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

const PAD = {
  none: "",
  sm:   "p-3",
  md:   "p-4 sm:p-5",
  lg:   "p-5 sm:p-6",
} as const;

export function Card({ children, className, padding = "md", shadow = true }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-ink-950 rounded-xl border border-ink-200/60 dark:border-ink-800/60 overflow-hidden",
        shadow && "shadow-sm",
        padding !== "none" && PAD[padding],
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, actions, className, children }: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-4 sm:px-5 py-3 border-b border-ink-200/60 dark:border-ink-800/60",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {children ?? (
          <>
            {title && (
              <h3 className="text-[13px] font-semibold text-ink-800 dark:text-ink-100">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-[12px] text-ink-500 dark:text-ink-400 mt-0.5">
                {description}
              </p>
            )}
          </>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ children, className, padding = "md" }: CardBodyProps) {
  return (
    <div className={cn(padding !== "none" && PAD[padding], className)}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={cn(
        "px-4 sm:px-5 py-3 border-t border-ink-200/60 dark:border-ink-800/60 bg-ink-50/50 dark:bg-ink-900/30",
        className
      )}
    >
      {children}
    </div>
  );
}
