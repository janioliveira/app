import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  testId?: string;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  testId = "empty-state",
  className,
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "border-border/70 bg-muted/30 flex flex-col items-start gap-3 rounded-2xl border border-dashed p-8",
        className,
      )}
    >
      <span className="bg-background text-muted-foreground grid size-12 place-items-center rounded-xl shadow-sm">
        <Icon className="size-6" />
      </span>
      <div>
        <p className="text-base font-semibold">{title}</p>
        {description ? (
          <p className="text-muted-foreground mt-1 max-w-prose text-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
