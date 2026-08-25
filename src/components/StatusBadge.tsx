import { Badge } from "@/components/ui/Badge";

// Derives a single display status from is_enabled + delivery_status (PRD §6.2 —
// the two fields can disagree, e.g. enabled but delivery paused by Meta).
export function StatusBadge({
  isEnabled,
  deliveryStatus,
}: {
  isEnabled: boolean;
  deliveryStatus: string | null;
}) {
  const status = (deliveryStatus ?? (isEnabled ? "active" : "paused")).toLowerCase();

  const tone =
    status === "active"
      ? "success"
      : status === "paused"
        ? "neutral"
        : status === "in review"
          ? "info"
          : status === "disapproved"
            ? "danger"
            : "neutral";

  return (
    <Badge tone={tone}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          tone === "success"
            ? "bg-success-fg"
            : tone === "info"
              ? "bg-info-fg"
              : tone === "danger"
                ? "bg-danger-fg"
                : "bg-foreground-muted"
        }`}
      />
      {deliveryStatus ?? (isEnabled ? "Active" : "Paused")}
    </Badge>
  );
}
