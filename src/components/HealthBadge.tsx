import type { HealthStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

const CONFIG: Record<HealthStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  profitable: { label: "On-target", tone: "success" },
  watch: { label: "Watch", tone: "warning" },
  underperforming: { label: "Underperforming", tone: "danger" },
  insufficient_data: { label: "Insufficient data", tone: "neutral" },
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  const { label, tone } = CONFIG[status];
  return (
    <Badge tone={tone}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          tone === "success"
            ? "bg-success-fg"
            : tone === "warning"
              ? "bg-warning-fg"
              : tone === "danger"
                ? "bg-danger-fg"
                : "bg-foreground-muted"
        }`}
      />
      {label}
    </Badge>
  );
}
