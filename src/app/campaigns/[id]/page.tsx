import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeDecision, REASON_COPY, DEFAULT_TARGET_CPA, DEFAULT_TARGET_CPL } from "@/lib/health";
import { DecisionBadge } from "@/components/DecisionBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { MiniFunnel } from "@/components/campaigns/MiniFunnel";
import { PlacementTable } from "@/components/campaigns/PlacementTable";
import type { Campaign, InsightSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle<Campaign>();

  if (!campaign) notFound();

  const [{ data: snapshots }, { data: placementSnapshots }] = await Promise.all([
    supabase
      .from("insight_snapshots")
      .select("date, spend, impressions, clicks, results, cost_per_result")
      .eq("campaign_id", id)
      .eq("level", "campaign")
      .order("date", { ascending: false })
      .returns<InsightSnapshot[]>(),
    supabase
      .from("insight_snapshots")
      .select("breakdown_dimension, spend, impressions, clicks, results")
      .eq("campaign_id", id)
      .eq("level", "placement")
      .returns<Pick<InsightSnapshot, "breakdown_dimension" | "spend" | "impressions" | "clicks" | "results">[]>(),
  ]);

  const rows = snapshots ?? [];

  const placementTotals = new Map<string, { spend: number; impressions: number; clicks: number; results: number }>();
  for (const p of placementSnapshots ?? []) {
    const dimension = p.breakdown_dimension ?? "unknown/unknown";
    const cur = placementTotals.get(dimension) ?? { spend: 0, impressions: 0, clicks: 0, results: 0 };
    cur.spend += p.spend;
    cur.impressions += p.impressions;
    cur.clicks += p.clicks;
    cur.results += p.results;
    placementTotals.set(dimension, cur);
  }
  const placementRows = [...placementTotals.entries()].map(([dimension, totals]) => ({
    dimension,
    ...totals,
  }));
  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalResults = rows.reduce((s, r) => s + r.results, 0);
  const costPerResult = totalResults > 0 ? totalSpend / totalResults : null;
  const target =
    campaign.objective === "leads" ? campaign.target_cpl ?? DEFAULT_TARGET_CPL : campaign.target_cpa ?? DEFAULT_TARGET_CPA;

  // Trend evidence: split synced days into two halves (rows are date-desc),
  // compare recent-half vs prior-half cost/result. Needs ≥4 days to be meaningful.
  let trend: { recentCostPerResult: number | null; priorCostPerResult: number | null } | undefined;
  if (rows.length >= 4) {
    const mid = Math.floor(rows.length / 2);
    const recent = rows.slice(0, mid);
    const prior = rows.slice(mid);
    const recentSpend = recent.reduce((s, r) => s + r.spend, 0);
    const recentResults = recent.reduce((s, r) => s + r.results, 0);
    const priorSpend = prior.reduce((s, r) => s + r.spend, 0);
    const priorResults = prior.reduce((s, r) => s + r.results, 0);
    trend = {
      recentCostPerResult: recentResults > 0 ? recentSpend / recentResults : null,
      priorCostPerResult: priorResults > 0 ? priorSpend / priorResults : null,
    };
  }

  const { decision, reasons } = computeDecision({
    spend: totalSpend,
    costPerResult,
    target,
    daysSynced: rows.length,
    trend,
  });

  return (
    <main className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft size={14} /> Back to campaigns
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="text-sm text-foreground-muted mt-1">{campaign.objective}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge isEnabled={campaign.is_enabled} deliveryStatus={campaign.delivery_status} />
          <DecisionBadge decision={decision} showAction />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Spend" value={`${campaign.budget_currency ?? ""} ${totalSpend.toFixed(2)}`} />
        <KpiCard label="Results" value={String(totalResults)} />
        <KpiCard label="Cost/result" value={costPerResult != null ? costPerResult.toFixed(2) : "—"} />
        <KpiCard
          label="Budget"
          value={campaign.budget_amount != null ? `${campaign.budget_currency ?? ""} ${campaign.budget_amount}` : "—"}
          note={campaign.budget_type ?? undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Decision evidence"
            description={`Target cost/result: ${target}`}
          />
          <CardBody>
            {reasons.length === 0 ? (
              <p className="text-sm text-foreground-muted">No evidence yet.</p>
            ) : (
              <ul className="space-y-2">
                {reasons.map((code) => (
                  <li key={code} className="text-sm flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground-muted mt-1.5 shrink-0" />
                    {REASON_COPY[code]}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Funnel" description="Impressions → Clicks → Leads (all-time synced)" />
          <CardBody>
            <MiniFunnel impressions={totalImpressions} clicks={totalClicks} results={totalResults} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Placement" description="Spend and results by Facebook/Instagram placement (all-time synced)" />
        <CardBody>
          <PlacementTable rows={placementRows} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Daily snapshots" description="From synced insight_snapshots rows" />
        <CardBody>
          {rows.length === 0 ? (
            <p className="text-sm text-foreground-muted">No synced data for this campaign yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-foreground-muted border-b border-border">
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Spend</th>
                    <th className="py-2 pr-4 font-medium">Impressions</th>
                    <th className="py-2 pr-4 font-medium">Clicks</th>
                    <th className="py-2 pr-4 font-medium">Results</th>
                    <th className="py-2 pr-4 font-medium">Cost/Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.date} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4">{s.date}</td>
                      <td className="py-2 pr-4">{s.spend.toFixed(2)}</td>
                      <td className="py-2 pr-4">{s.impressions}</td>
                      <td className="py-2 pr-4">{s.clicks}</td>
                      <td className="py-2 pr-4">{s.results}</td>
                      <td className="py-2 pr-4">{s.cost_per_result?.toFixed(2) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
