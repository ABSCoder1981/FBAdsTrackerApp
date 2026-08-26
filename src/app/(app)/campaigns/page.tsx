import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeDecision, DEFAULT_TARGET_CPA, DEFAULT_TARGET_CPL } from "@/lib/health";
import type { Campaign, InsightSnapshot } from "@/lib/types";
import { CampaignsExplorer, type CampaignRow } from "@/components/campaigns/CampaignsExplorer";

// See src/app/(app)/page.tsx for why this changed from force-dynamic.
export const revalidate = 30;

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = createServerSupabaseClient();

  const [{ data: campaigns, error }, { data: snapshots }] = await Promise.all([
    supabase
      .from("campaigns")
      .select(
        "id, name, objective, is_enabled, delivery_status, budget_type, budget_amount, budget_currency, target_cpl, target_cpa",
      )
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .returns<Campaign[]>(),
    supabase
      .from("insight_snapshots")
      .select("campaign_id, date, spend, results")
      .eq("level", "campaign")
      .returns<Pick<InsightSnapshot, "campaign_id" | "date" | "spend" | "results">[]>(),
  ]);

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold mb-4">Campaigns</h1>
        <p className="text-danger-fg">Failed to load campaigns: {error.message}</p>
      </div>
    );
  }

  const totalsByCampaign = new Map<string, { spend: number; results: number; dates: Set<string> }>();
  for (const s of snapshots ?? []) {
    const cur = totalsByCampaign.get(s.campaign_id) ?? { spend: 0, results: 0, dates: new Set<string>() };
    cur.spend += s.spend;
    cur.results += s.results;
    cur.dates.add(s.date);
    totalsByCampaign.set(s.campaign_id, cur);
  }

  const rows: CampaignRow[] = (campaigns ?? []).map((c) => {
    const totals = totalsByCampaign.get(c.id);
    const costPerResult = totals && totals.results > 0 ? totals.spend / totals.results : null;
    const target = c.objective === "leads" ? c.target_cpl ?? DEFAULT_TARGET_CPL : c.target_cpa ?? DEFAULT_TARGET_CPA;
    const { decision, reasons } = computeDecision({
      spend: totals?.spend ?? 0,
      costPerResult,
      target,
      daysSynced: totals?.dates.size ?? 0,
    });

    return {
      id: c.id,
      name: c.name,
      objective: c.objective,
      isEnabled: c.is_enabled,
      deliveryStatus: c.delivery_status,
      budgetAmount: c.budget_amount,
      budgetCurrency: c.budget_currency,
      budgetType: c.budget_type,
      spend: totals?.spend ?? 0,
      costPerResult,
      decision,
      reasons,
    };
  });

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p className="text-sm text-foreground-muted mt-1">{rows.length} campaigns</p>
      </div>
      <CampaignsExplorer rows={rows} initialQuery={q ?? ""} />
    </div>
  );
}
