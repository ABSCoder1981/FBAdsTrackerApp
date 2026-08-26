import type { LucideIcon } from "lucide-react";
import { TrendingUp, Play, SlidersHorizontal, Eye, XCircle } from "lucide-react";
import type { Decision } from "@/lib/types";
import type { TileTone } from "@/components/ui/KpiCard";

const DECISION_ICON: Record<Decision, LucideIcon> = {
  scale: TrendingUp,
  continue: Play,
  optimize: SlidersHorizontal,
  watch: Eye,
  close: XCircle,
};

const DECISION_TILE_TONE: Record<Decision, TileTone> = {
  scale: "green",
  continue: "blue",
  optimize: "orange",
  watch: "gray",
  close: "red",
};

const DECISION_LABEL: Record<Decision, string> = {
  scale: "Scale",
  continue: "Continue",
  optimize: "Optimize",
  watch: "Watch",
  close: "Close",
};

const TILE_CLASSES: Record<TileTone, string> = {
  blue: "bg-tile-blue-bg text-tile-blue-fg",
  green: "bg-tile-green-bg text-tile-green-fg",
  purple: "bg-tile-purple-bg text-tile-purple-fg",
  orange: "bg-tile-orange-bg text-tile-orange-fg",
  gray: "bg-tile-gray-bg text-tile-gray-fg",
  red: "bg-tile-red-bg text-tile-red-fg",
};

export function DecisionSummaryCard({ decision, count, note }: { decision: Decision; count: number; note?: string }) {
  const Icon = DECISION_ICON[decision];
  const tone = DECISION_TILE_TONE[decision];

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${TILE_CLASSES[tone]}`}>
        <Icon size={18} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="text-lg font-semibold leading-tight">{count}</div>
        <div className="text-xs text-foreground-muted truncate">{DECISION_LABEL[decision]}</div>
        {note && <div className="text-[11px] text-foreground-muted truncate">{note}</div>}
      </div>
    </div>
  );
}
