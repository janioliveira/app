import { cn } from "@/lib/utils";
import { statusTone } from "@/lib/format";

interface StatusPillProps {
  status: string;
  label?: string;
  className?: string;
  pulse?: boolean;
  testId?: string;
}

export function StatusPill({ status, label, className, pulse, testId }: StatusPillProps) {
  return (
    <span
      data-testid={testId ?? `status-pill-${status}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        statusTone(status),
        pulse && "animate-pix-pulse",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {label ?? status}
    </span>
  );
}
