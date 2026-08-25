import type { HealthStatus } from "@/lib/types";

const STYLES: Record<HealthStatus, { label: string; className: string }> = {
  profitable: { label: "🟢 On-target", className: "bg-green-100 text-green-800" },
  watch: { label: "🟡 Watch", className: "bg-yellow-100 text-yellow-800" },
  underperforming: { label: "🔴 Underperforming", className: "bg-red-100 text-red-800" },
  insufficient_data: { label: "⚪ Insufficient data", className: "bg-gray-100 text-gray-600" },
};

export function HealthBadge({ status }: { status: HealthStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
