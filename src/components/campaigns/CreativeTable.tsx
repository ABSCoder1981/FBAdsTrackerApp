// docs/CAMPAIGN_INTELLIGENCE_SPEC.md §6B — reduced form: ad name + performance
// only, no creative format/thumbnail/headline (needs extra Meta API calls not
// wired up). Tested live 2026-08-25: only 4/20 campaigns have >1 ad for this
// account, so most campaigns render a single informative row here, not a
// comparison — that's expected, not a bug.
import { MIN_SPEND_FOR_JUDGEMENT } from "@/lib/health";

export interface CreativeRow {
  adId: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
}

export function CreativeTable({ rows }: { rows: CreativeRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-foreground-muted">No synced ad-level data for this campaign yet.</p>;
  }

  const sorted = [...rows].sort((a, b) => b.spend - a.spend);
  const minSpendForAdJudgement = MIN_SPEND_FOR_JUDGEMENT * 0.1;
  const judgeable = sorted
    .filter((r) => r.spend >= minSpendForAdJudgement)
    .map((r) => ({ ...r, costPerResult: r.results > 0 ? r.spend / r.results : null }))
    .filter((r) => r.costPerResult !== null);
  const best = judgeable.length > 1 ? judgeable.reduce((a, b) => (a.costPerResult! < b.costPerResult! ? a : b)) : null;
  const worst = judgeable.length > 1 ? judgeable.reduce((a, b) => (a.costPerResult! > b.costPerResult! ? a : b)) : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-foreground-muted border-b border-border">
            <th className="py-2 pr-4 font-medium">Ad</th>
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
            return (
              <tr key={r.adId} className="border-b border-border last:border-0">
                <td className="py-2 pr-4 max-w-xs truncate">
                  {r.name}
                  {best && r.adId === best.adId && <span className="ml-2 text-xs text-success-fg">Best</span>}
                  {worst && r.adId === worst.adId && <span className="ml-2 text-xs text-danger-fg">Worst</span>}
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
