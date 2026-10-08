import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "pix" | "azure" | "warning" | "danger";
  testId: string;
  className?: string;
}

const TONES: Record<string, string> = {
  default: "bg-primary/10 text-primary",
  pix: "bg-[var(--pix)]/12 text-[var(--pix)]",
  azure: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  warning: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  danger: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
};

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  testId,
  className,
}: MetricCardProps) {
  return (
    <Card
      data-testid={testId}
      className={cn(
        "border-border/70 rounded-2xl shadow-sm transition-shadow duration-200 hover:shadow-md",
        className,
      )}
    >
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight" data-testid={`${testId}-value`}>
            {value}
          </p>
          {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
        </div>
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", TONES[tone])}>
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}
