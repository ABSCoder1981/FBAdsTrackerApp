import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeHealthStatus, DEFAULT_TARGET_CPA, DEFAULT_TARGET_CPL } from "@/lib/health";
import { HealthBadge } from "@/components/HealthBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import type { Campaign, Client, InsightSnapshot } from "@/lib/types";

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

  const [{ data: client }, { data: snapshots }] = await Promise.all([
    campaign.client_id
      ? supabase.from("clients").select("id, name").eq("id", campaign.client_id).maybeSingle<Client>()
      : Promise.resolve({ data: null }),
    supabase
      .from("insight_snapshots")
      .select("date, spend, impressions, clicks, results, cost_per_result")
      .eq("campaign_id", id)
      .order("date", { ascending: false })
      .returns<InsightSnapshot[]>(),
  ]);

  const totalSpend = (snapshots ?? []).reduce((s, r) => s + r.spend, 0);
  const totalResults = (snapshots ?? []).reduce((s, r) => s + r.results, 0);
  const costPerResult = totalResults > 0 ? totalSpend / totalResults : null;
  const target =
    campaign.objective === "leads" ? campaign.target_cpl ?? DEFAULT_TARGET_CPL : campaign.target_cpa ?? DEFAULT_TARGET_CPA;
  const health = computeHealthStatus({ spend: totalSpend, costPerResult, target });

  return (
    <main className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground">
        <ArrowLeft size={14} /> Back to campaigns
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <p className="text-sm text-foreground-muted mt-1">{client?.name ?? "No client"} · {campaign.objective}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge isEnabled={campaign.is_enabled} deliveryStatus={campaign.delivery_status} />
          <HealthBadge status={health} />
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

      <Card>
        <CardHeader title="Daily snapshots" description="From synced insight_snapshots rows" />
        <CardBody>
          {!snapshots || snapshots.length === 0 ? (
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
                  {snapshots.map((s) => (
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
