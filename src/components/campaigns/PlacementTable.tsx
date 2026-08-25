// docs/CAMPAIGN_INTELLIGENCE_SPEC.md §6D — campaign-level placement
// breakdown (Meta doesn't require ad-set/ad-level sync for this one).
// "Do not determine success using CPL alone" (spec §6D) — best/worst is
// picked among placements with enough spend to judge, same gate as the
// campaign-level Decision (MIN_SPEND_FOR_JUDGEMENT).
import { MIN_SPEND_FOR_JUDGEMENT } from "@/lib/health";

export interface PlacementRow {
  dimension: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
}

export function PlacementTable({ rows }: { rows: PlacementRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-foreground-muted">No synced placement data for this campaign yet.</p>;
  }

  const sorted = [...rows].sort((a, b) => b.spend - a.spend);

  // Scaled down from the campaign-level minimum — a single placement rarely
  // accumulates full campaign-level spend on its own.
  const minSpendForPlacementJudgement = MIN_SPEND_FOR_JUDGEMENT * 0.1;
  const judgeable = sorted.filter((r) => r.spend >= minSpendForPlacementJudgement);
  const withCostPerResult = judgeable
    .map((r) => ({ ...r, costPerResult: r.results > 0 ? r.spend / r.results : null }))
    .filter((r) => r.costPerResult !== null);
  const best = withCostPerResult.length > 0
    ? withCostPerResult.reduce((a, b) => (a.costPerResult! < b.costPerResult! ? a : b))
    : null;
  const worst = withCostPerResult.length > 1
    ? withCostPerResult.reduce((a, b) => (a.costPerResult! > b.costPerResult! ? a : b))
    : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-foreground-muted border-b border-border">
            <th className="py-2 pr-4 font-medium">Placement</th>
            <th className="py-2 pr-4 font-medium">Spend</th>
            <th className="py-2 pr-4 font-medium">Impressions</th>
            <th className="py-2 pr-4 font-medium">Clicks</th>
            <th className="py-2 pr-4 font-medium">CTR</th>
            <th className="py-2 pr-4 font-medium">Results</th>
            <th className="py-2 pr-4 font-medium">Cost/Result</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : null;
            const costPerResult = r.results > 0 ? r.spend / r.results : null;
            const isBest = best && r.dimension === best.dimension;
            const isWorst = worst && r.dimension === worst.dimension;
            return (
              <tr key={r.dimension} className="border-b border-border last:border-0">
                <td className="py-2 pr-4">
                  {formatDimension(r.dimension)}
                  {isBest && <span className="ml-2 text-xs text-success-fg">Best</span>}
                  {isWorst && <span className="ml-2 text-xs text-danger-fg">Worst</span>}
                </td>
                <td className="py-2 pr-4">{r.spend.toFixed(2)}</td>
                <td className="py-2 pr-4">{r.impressions.toLocaleString("en-IN")}</td>
                <td className="py-2 pr-4">{r.clicks}</td>
                <td className="py-2 pr-4">{ctr != null ? `${ctr.toFixed(2)}%` : "—"}</td>
                <td className="py-2 pr-4">{r.results}</td>
                <td className="py-2 pr-4">{costPerResult != null ? costPerResult.toFixed(2) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatDimension(dimension: string) {
  const [platform, position] = dimension.split("/");
  return `${platform} · ${position.replace(/_/g, " ")}`;
}
