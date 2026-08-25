import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeHealthStatus, DEFAULT_TARGET_CPA, DEFAULT_TARGET_CPL } from "@/lib/health";
import type { Campaign, Client, InsightSnapshot } from "@/lib/types";
import { CampaignsExplorer, type CampaignRow } from "@/components/campaigns/CampaignsExplorer";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const supabase = createServerSupabaseClient();

  const [{ data: campaigns, error }, { data: clients }, { data: snapshots }] = await Promise.all([
    supabase
      .from("campaigns")
      .select(
        "id, name, client_id, objective, is_enabled, delivery_status, budget_type, budget_amount, budget_currency, agent_name, target_cpl, target_cpa",
      )
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .returns<Campaign[]>(),
    supabase.from("clients").select("id, name").returns<Pick<Client, "id" | "name">[]>(),
    supabase
      .from("insight_snapshots")
      .select("campaign_id, spend, results")
      .returns<Pick<InsightSnapshot, "campaign_id" | "spend" | "results">[]>(),
  ]);

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-semibold mb-4">Campaigns</h1>
        <p className="text-danger-fg">Failed to load campaigns: {error.message}</p>
      </main>
    );
  }

  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  const totalsByCampaign = new Map<string, { spend: number; results: number }>();
  for (const s of snapshots ?? []) {
    const cur = totalsByCampaign.get(s.campaign_id) ?? { spend: 0, results: 0 };
    cur.spend += s.spend;
    cur.results += s.results;
    totalsByCampaign.set(s.campaign_id, cur);
  }

  const rows: CampaignRow[] = (campaigns ?? []).map((c) => {
    const totals = totalsByCampaign.get(c.id);
    const costPerResult = totals && totals.results > 0 ? totals.spend / totals.results : null;
    const target = c.objective === "leads" ? c.target_cpl ?? DEFAULT_TARGET_CPL : c.target_cpa ?? DEFAULT_TARGET_CPA;
    const health = computeHealthStatus({ spend: totals?.spend ?? 0, costPerResult, target });

    return {
      id: c.id,
      name: c.name,
      clientName: (c.client_id && clientNameById.get(c.client_id)) || "—",
      agentName: c.agent_name,
      objective: c.objective,
      isEnabled: c.is_enabled,
      deliveryStatus: c.delivery_status,
      budgetAmount: c.budget_amount,
      budgetCurrency: c.budget_currency,
      budgetType: c.budget_type,
      spend: totals?.spend ?? 0,
      costPerResult,
      health,
    };
  });

  return (
    <main className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
        <p className="text-sm text-foreground-muted mt-1">{rows.length} campaigns across all clients</p>
      </div>
      <CampaignsExplorer rows={rows} />
    </main>
  );
}
