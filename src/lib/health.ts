import type { HealthStatus } from "./types";

// Default org-wide CPL/CPA ceilings (INR) — placeholder values per PRD §12 Q3,
// seeded until real per-client thresholds are set from observed data.
export const DEFAULT_TARGET_CPL = 500;
export const DEFAULT_TARGET_CPA = 1500;
export const MIN_SPEND_FOR_JUDGEMENT = 1000;
export const WATCH_BUFFER_PCT = 0.15;

export function computeHealthStatus(params: {
  spend: number;
  costPerResult: number | null;
  target: number;
}): HealthStatus {
  const { spend, costPerResult, target } = params;

  if (spend < MIN_SPEND_FOR_JUDGEMENT || costPerResult === null) {
    return "insufficient_data";
  }
  if (costPerResult <= target) {
    return "profitable";
  }
  if (costPerResult <= target * (1 + WATCH_BUFFER_PCT)) {
    return "watch";
  }
  return "underperforming";
}
