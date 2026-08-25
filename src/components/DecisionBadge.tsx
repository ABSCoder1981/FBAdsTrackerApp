import type { Decision } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { DECISION_COPY } from "@/lib/health";

// Color convention — docs/CAMPAIGN_INTELLIGENCE_SPEC.md §4:
// 🟢 Scale/Continue · 🟡 Optimize · ⚪ Watch (insufficient data, always wins
// over a confident-looking bad number — spec Principle 6) · 🔴 Close
const CONFIG: Record<Decision, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  scale: { label: "Scale", tone: "success" },
  continue: { label: "Continue", tone: "success" },
  optimize: { label: "Optimize", tone: "warning" },
  watch: { label: "Watch", tone: "neutral" },
  close: { label: "Close", tone: "danger" },
};

export function DecisionBadge({
  decision,
  showAction = false,
}: {
  decision: Decision;
  showAction?: boolean;
}) {
  const { label, tone } = CONFIG[decision];
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
      {showAction && <span className="text-xs text-foreground-muted">{DECISION_COPY[decision]}</span>}
    </span>
  );
}
