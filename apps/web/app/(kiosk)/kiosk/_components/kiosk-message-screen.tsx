import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Tone = "neutral" | "danger" | "warning" | "success";

const TONE_ICON_CLASS: Record<Tone, string> = {
  neutral: "text-ink-400",
  danger: "text-danger-500",
  warning: "text-warn-500",
  success: "text-success-500",
};

export function KioskMessageScreen({
  icon: Icon,
  tone = "neutral",
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex-1 min-h-[70vh] flex flex-col items-center justify-center text-center px-6 gap-4">
      <Icon size={64} className={TONE_ICON_CLASS[tone]} />
      <h1 className="text-2xl font-semibold text-ink-900 dark:text-ink-50">{title}</h1>
      {message && <p className="text-base text-ink-500 dark:text-ink-400 max-w-md">{message}</p>}
      {action && (
        <Button size="lg" variant="primary" onClick={action.onClick} className="mt-2 min-h-[52px] px-6 text-base">
          {action.label}
        </Button>
      )}
    </div>
  );
}
