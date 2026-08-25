import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeHealthStatus, DEFAULT_TARGET_CPA, DEFAULT_TARGET_CPL } from "@/lib/health";
import type { Campaign, InsightSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const supabase = createServerSupabaseClient();

  const { count: activeCount } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("is_enabled", true);

  const { count: totalCount } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, objective, target_cpl, target_cpa")
    .is("deleted_at", null)
    .returns<Pick<Campaign, "id" | "objective" | "target_cpl" | "target_cpa">[]>();

  const { data: snapshots } = await supabase
    .from("insight_snapshots")
    .select("campaign_id, spend, results")
    .returns<Pick<InsightSnapshot, "campaign_id" | "spend" | "results">[]>();

  const totalsByCampaign = new Map<string, { spend: number; results: number }>();
  for (const s of snapshots ?? []) {
    const cur = totalsByCampaign.get(s.campaign_id) ?? { spend: 0, results: 0 };
    cur.spend += s.spend;
    cur.results += s.results;
    totalsByCampaign.set(s.campaign_id, cur);
  }

  let totalSpend = 0;
  let totalResults = 0;
  const healthCounts = { profitable: 0, watch: 0, underperforming: 0, insufficient_data: 0 };

  for (const c of campaigns ?? []) {
    const totals = totalsByCampaign.get(c.id);
    if (!totals) {
      healthCounts.insufficient_data++;
      continue;
    }
    totalSpend += totals.spend;
    totalResults += totals.results;
    const costPerResult = totals.results > 0 ? totals.spend / totals.results : null;
    const target =
      c.objective === "leads" ? c.target_cpl ?? DEFAULT_TARGET_CPL : c.target_cpa ?? DEFAULT_TARGET_CPA;
    const health = computeHealthStatus({ spend: totals.spend, costPerResult, target });
    healthCounts[health]++;
  }

  const avgCostPerResult = totalResults > 0 ? totalSpend / totalResults : null;

  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">FB Ads Tracker — Overview</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Active campaigns" value={activeCount ?? 0} />
        <StatCard label="Total campaigns" value={totalCount ?? 0} />
        <StatCard
          label="Spend (synced)"
          value={totalSpend > 0 ? totalSpend.toFixed(2) : "—"}
          note="sums all synced insight_snapshots"
        />
        <StatCard
          label="Avg. cost/result"
          value={avgCostPerResult != null ? avgCostPerResult.toFixed(2) : "—"}
        />
      </div>

      <div>
        <h2 className="text-sm font-medium text-gray-600 mb-2">Health summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="🟢 On-target" value={healthCounts.profitable} />
          <StatCard label="🟡 Watch" value={healthCounts.watch} />
          <StatCard label="🔴 Underperforming" value={healthCounts.underperforming} />
          <StatCard label="⚪ Insufficient data" value={healthCounts.insufficient_data} />
        </div>
      </div>

      <Link href="/campaigns" className="text-blue-600 underline">
        View campaign list →
      </Link>
    </main>
  );
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {note && <div className="text-xs text-gray-400 mt-1">{note}</div>}
    </div>
  );
}
