import type { HealthStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { DECISION_COPY } from "@/lib/health";

const CONFIG: Record<HealthStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  profitable: { label: "On-target", tone: "success" },
  watch: { label: "Watch", tone: "warning" },
  underperforming: { label: "Underperforming", tone: "danger" },
  insufficient_data: { label: "Insufficient data", tone: "neutral" },
};

export function HealthBadge({
  status,
  showDecision = false,
}: {
  status: HealthStatus;
  showDecision?: boolean;
}) {
  const { label, tone } = CONFIG[status];
  return (
    <span className="inline-flex items-center gap-2">
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
      {showDecision && (
        <span className="text-xs text-foreground-muted">{DECISION_COPY[status]}</span>
      )}
    </span>
  );
}
