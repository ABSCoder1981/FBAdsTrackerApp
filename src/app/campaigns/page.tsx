import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeHealthStatus, DEFAULT_TARGET_CPA, DEFAULT_TARGET_CPL } from "@/lib/health";
import { HealthBadge } from "@/components/HealthBadge";
import type { Campaign, InsightSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const supabase = createServerSupabaseClient();

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select(
      "id, name, client_id, objective, is_enabled, delivery_status, budget_type, budget_amount, budget_currency, agent_name, target_cpl, target_cpa",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .returns<Campaign[]>();

  // Not filtered by campaign id list: with hundreds of campaigns, .in() would
  // build a query string past Supabase's URL length limit and fail silently.
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

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-semibold mb-4">Campaigns</h1>
        <p className="text-red-600">Failed to load campaigns: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold mb-4">Campaigns</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-gray-300">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Objective</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Budget</th>
              <th className="py-2 pr-4">Agent</th>
              <th className="py-2 pr-4">Spend</th>
              <th className="py-2 pr-4">Cost/Result</th>
              <th className="py-2 pr-4">Health</th>
            </tr>
          </thead>
          <tbody>
            {campaigns?.map((c) => {
              const totals = totalsByCampaign.get(c.id);
              const costPerResult =
                totals && totals.results > 0 ? totals.spend / totals.results : null;
              const target =
                c.objective === "leads"
                  ? c.target_cpl ?? DEFAULT_TARGET_CPL
                  : c.target_cpa ?? DEFAULT_TARGET_CPA;
              const health = computeHealthStatus({
                spend: totals?.spend ?? 0,
                costPerResult,
                target,
              });

              return (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{c.name}</td>
                  <td className="py-2 pr-4">{c.objective}</td>
                  <td className="py-2 pr-4">
                    {c.is_enabled ? "Enabled" : "Disabled"} / {c.delivery_status ?? "—"}
                  </td>
                  <td className="py-2 pr-4">
                    {c.budget_amount != null
                      ? `${c.budget_currency ?? ""} ${c.budget_amount} (${c.budget_type})`
                      : "—"}
                  </td>
                  <td className="py-2 pr-4">{c.agent_name ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {totals ? `${c.budget_currency ?? ""} ${totals.spend.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    {costPerResult != null ? costPerResult.toFixed(2) : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    <HealthBadge status={health} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {campaigns?.length === 0 && (
          <p className="text-gray-500 mt-4">No campaigns found.</p>
        )}
      </div>
    </main>
  );
}
