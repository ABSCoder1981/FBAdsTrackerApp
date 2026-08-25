import type { Decision } from "./types";

// Default org-wide CPL/CPA ceilings (INR) — placeholder values per PRD §12 Q3,
// seeded until real per-client thresholds are set from observed data.
export const DEFAULT_TARGET_CPL = 500;
export const DEFAULT_TARGET_CPA = 1500;
export const MIN_SPEND_FOR_JUDGEMENT = 1000;
export const MIN_DAYS_FOR_JUDGEMENT = 7;
export const SCALE_THRESHOLD_PCT = 0.8; // ≤80% of target = meaningfully beating it, not just meeting it
export const WATCH_BUFFER_PCT = 0.15;

export type ReasonCode =
  | "insufficient_data"
  | "strong_cpl"
  | "on_target_cpl"
  | "high_cpl"
  | "declining_trend"
  | "improving_trend";

export interface DecisionInput {
  spend: number;
  costPerResult: number | null;
  target: number;
  daysSynced: number;
  /** Optional: recent-vs-prior cost/result split for trend evidence. */
  trend?: { recentCostPerResult: number | null; priorCostPerResult: number | null };
}

export interface DecisionResult {
  decision: Decision;
  reasons: ReasonCode[];
}

// PRD §13.4 / docs/CAMPAIGN_INTELLIGENCE_SPEC.md §8 — Phase 1 rule-based
// implementation. Principle 6 (spec §1): insufficient data always wins over a
// confident-looking bad number, so the gate is checked before anything else.
export function computeDecision(params: DecisionInput): DecisionResult {
  const { spend, costPerResult, target, daysSynced, trend } = params;
  const reasons: ReasonCode[] = [];

  if (spend < MIN_SPEND_FOR_JUDGEMENT || daysSynced < MIN_DAYS_FOR_JUDGEMENT || costPerResult === null) {
    return { decision: "watch", reasons: ["insufficient_data"] };
  }

  if (trend?.recentCostPerResult != null && trend?.priorCostPerResult != null) {
    if (trend.recentCostPerResult < trend.priorCostPerResult * 0.95) {
      reasons.push("improving_trend");
    } else if (trend.recentCostPerResult > trend.priorCostPerResult * 1.05) {
      reasons.push("declining_trend");
    }
  }

  if (costPerResult <= target * SCALE_THRESHOLD_PCT) {
    return { decision: "scale", reasons: ["strong_cpl", ...reasons] };
  }
  if (costPerResult <= target) {
    return { decision: "continue", reasons: ["on_target_cpl", ...reasons] };
  }
  if (costPerResult <= target * (1 + WATCH_BUFFER_PCT)) {
    return { decision: "optimize", reasons: ["high_cpl", ...reasons] };
  }
  return { decision: "close", reasons: ["high_cpl", ...reasons] };
}

export const DECISION_COPY: Record<Decision, string> = {
  scale: "Scale — increase budget",
  continue: "Continue",
  optimize: "Optimize",
  watch: "Watch — insufficient data",
  close: "Close — pause & review",
};

export const REASON_COPY: Record<ReasonCode, string> = {
  insufficient_data: "Below minimum spend or days-synced threshold",
  strong_cpl: "Cost per result meaningfully below target",
  on_target_cpl: "Cost per result at or below target",
  high_cpl: "Cost per result above target",
  declining_trend: "Cost per result trending up over recent days",
  improving_trend: "Cost per result trending down over recent days",
};
