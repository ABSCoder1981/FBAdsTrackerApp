import { ArrowDown, ArrowUp, LucideIcon } from "lucide-react";
import { Card } from "./Card";
import { Sparkline } from "./Sparkline";

export type TileTone = "blue" | "green" | "purple" | "orange" | "gray" | "red";

const TILE_CLASSES: Record<TileTone, string> = {
  blue: "bg-tile-blue-bg text-tile-blue-fg",
  green: "bg-tile-green-bg text-tile-green-fg",
  purple: "bg-tile-purple-bg text-tile-purple-fg",
  orange: "bg-tile-orange-bg text-tile-orange-fg",
  gray: "bg-tile-gray-bg text-tile-gray-fg",
  red: "bg-tile-red-bg text-tile-red-fg",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  changePct,
  emphasis = false,
  note,
  sparkline,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  tone?: TileTone;
  changePct?: number;
  emphasis?: boolean;
  note?: string;
  /** Optional trend points for a small inline sparkline (e.g. daily values). */
  sparkline?: number[];
}) {
  const isPositive = (changePct ?? 0) >= 0;

  return (
    <Card className={emphasis ? "ring-1 ring-primary/15" : ""}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          {Icon && (
            <span className={`flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] ${TILE_CLASSES[tone]}`}>
              <Icon size={17} strokeWidth={2} />
            </span>
          )}
          {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} tone={tone} />}
        </div>
        <div className="text-xs font-medium text-foreground-muted mt-3">{label}</div>
        <div className={`mt-1 font-semibold tracking-tight ${emphasis ? "text-3xl" : "text-2xl"}`}>
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
