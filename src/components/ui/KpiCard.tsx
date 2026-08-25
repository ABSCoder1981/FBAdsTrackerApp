import { ArrowDown, ArrowUp, LucideIcon } from "lucide-react";
import { Card } from "./Card";

export function KpiCard({
  label,
  value,
  icon: Icon,
  changePct,
  emphasis = false,
  note,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  changePct?: number;
  emphasis?: boolean;
  note?: string;
}) {
  const isPositive = (changePct ?? 0) >= 0;

  return (
    <Card className={emphasis ? "border-primary/20" : ""}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground-muted">{label}</span>
          {Icon && <Icon size={16} className="text-foreground-muted" strokeWidth={1.75} />}
        </div>
        <div className={`mt-2 font-semibold tracking-tight ${emphasis ? "text-3xl" : "text-2xl"}`}>
          {value}
        </div>
        {changePct !== undefined ? (
          <div className="mt-1.5 flex items-center gap-1 text-xs">
            <span
              className={`inline-flex items-center gap-0.5 font-medium ${
                isPositive ? "text-success-fg" : "text-danger-fg"
              }`}
            >
              {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              {Math.abs(changePct).toFixed(1)}%
            </span>
            <span className="text-foreground-muted">vs previous period</span>
          </div>
        ) : note ? (
          <div className="mt-1.5 text-xs text-foreground-muted">{note}</div>
        ) : null}
      </div>
    </Card>
  );
}
