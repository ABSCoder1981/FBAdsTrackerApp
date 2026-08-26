// docs/CAMPAIGN_INTELLIGENCE_SPEC.md §9 — rule-based deviation-from-trailing-
// average, not ML. Every number here is directly computed from real synced
// insight_snapshots rows; nothing is a forecast or a fabricated confidence
// score (spec Principle 8).

export type AnomalyType = "cpl_spike" | "spend_spike" | "ctr_collapse" | "tracking_issue";

export interface Anomaly {
  type: AnomalyType;
  severity: "high" | "medium";
  headline: string;
  detail: string;
}

export interface DailyPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
}

const MIN_TRAILING_DAYS = 5; // minimum prior days needed to trust a "normal" baseline
const MIN_LATEST_SPEND = 100; // ignore near-zero-spend days — too noisy to judge

function fmtMoney(n: number) {
  return `₹${n.toFixed(0)}`;
}
function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(0)}%`;
}

/**
 * Compares the most recent synced day against the trailing average of the
 * days before it. Returns [] if there isn't enough history to trust a
 * baseline — an empty result here means "not enough data," not "all clear."
 */
export function detectAnomalies(dailyPointsAscending: DailyPoint[]): Anomaly[] {
  if (dailyPointsAscending.length < MIN_TRAILING_DAYS + 1) return [];

  const latest = dailyPointsAscending[dailyPointsAscending.length - 1];
  const trailing = dailyPointsAscending.slice(-8, -1); // up to 7 prior days, excluding latest
  if (trailing.length < MIN_TRAILING_DAYS) return [];

  const anomalies: Anomaly[] = [];

  if (latest.spend < MIN_LATEST_SPEND) return anomalies;

  // --- CPL spike ---
  const trailingWithResults = trailing.filter((d) => d.results > 0);
  if (trailingWithResults.length >= 3 && latest.results > 0) {
    const trailingAvgCpl =
      trailingWithResults.reduce((s, d) => s + d.spend / d.results, 0) / trailingWithResults.length;
    const latestCpl = latest.spend / latest.results;
    if (latestCpl > trailingAvgCpl * 1.5) {
      const pct = ((latestCpl - trailingAvgCpl) / trailingAvgCpl) * 100;
      anomalies.push({
        type: "cpl_spike",
        severity: latestCpl > trailingAvgCpl * 2 ? "high" : "medium",
        headline: `Cost/result up ${fmtPct(pct)} vs trailing average`,
        detail: `${fmtMoney(latestCpl)} on ${latest.date} vs ${fmtMoney(trailingAvgCpl)} average over the prior ${trailingWithResults.length} days with results`,
      });
    }
  }

  // --- Spend spike ---
  const trailingAvgSpend = trailing.reduce((s, d) => s + d.spend, 0) / trailing.length;
  if (trailingAvgSpend > 0 && latest.spend > trailingAvgSpend * 2) {
    const pct = ((latest.spend - trailingAvgSpend) / trailingAvgSpend) * 100;
    anomalies.push({
      type: "spend_spike",
      severity: latest.spend > trailingAvgSpend * 3 ? "high" : "medium",
      headline: `Spend up ${fmtPct(pct)} vs trailing average`,
      detail: `${fmtMoney(latest.spend)} on ${latest.date} vs ${fmtMoney(trailingAvgSpend)} average over the prior ${trailing.length} days`,
    });
  }

  // --- CTR collapse ---
  const trailingWithImpressions = trailing.filter((d) => d.impressions > 0);
  if (trailingWithImpressions.length >= 3 && latest.impressions > 0) {
    const trailingAvgCtr =
      trailingWithImpressions.reduce((s, d) => s + d.clicks / d.impressions, 0) / trailingWithImpressions.length;
    const latestCtr = latest.clicks / latest.impressions;
    if (trailingAvgCtr > 0 && latestCtr < trailingAvgCtr * 0.5) {
      const pct = ((latestCtr - trailingAvgCtr) / trailingAvgCtr) * 100;
      anomalies.push({
        type: "ctr_collapse",
        severity: latestCtr < trailingAvgCtr * 0.25 ? "high" : "medium",
        headline: `CTR down ${fmtPct(pct)} vs trailing average`,
        detail: `${(latestCtr * 100).toFixed(2)}% on ${latest.date} vs ${(trailingAvgCtr * 100).toFixed(2)}% average over the prior ${trailingWithImpressions.length} days`,
      });
    }
  }

  // --- Possible tracking issue: spend continues, results silently drop to 0 ---
  if (trailingWithResults.length >= 3 && latest.results === 0) {
    const trailingAvgResults = trailingWithResults.reduce((s, d) => s + d.results, 0) / trailingWithResults.length;
    if (trailingAvgResults >= 1) {
      anomalies.push({
        type: "tracking_issue",
        severity: "high",
        headline: "Results dropped to zero despite continued spend",
        detail: `${fmtMoney(latest.spend)} spent on ${latest.date} with 0 results, vs an average of ${trailingAvgResults.toFixed(1)} results/day over the prior ${trailingWithResults.length} days — check the lead form/pixel is still working`,
      });
    }
  }

  return anomalies;
}
