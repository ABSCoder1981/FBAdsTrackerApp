import Link from "next/link";
import { History } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DecisionBadge } from "@/components/DecisionBadge";
import { REASON_COPY } from "@/lib/health";
import type { DecisionRecord } from "@/lib/decisions";
import type { Campaign } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const supabase = createServerSupabaseClient();

  const { data: decisions, error } = await supabase
    .from("decisions")
    .select("*")
    .order("decided_at", { ascending: false })
    .limit(200)
    .returns<DecisionRecord[]>();

  if (error) {
    return (
      <main className="p-4 md:p-6 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight mb-4">Decisions</h1>
        <p className="text-sm text-danger-fg">
          The decisions table isn&apos;t set up yet ({error.message}). Run migration
          0006_add_decisions_table.sql.
        </p>
      </main>
    );
  }

  const campaignIds = [...new Set((decisions ?? []).map((d) => d.campaign_id))];
  const { data: campaigns } = campaignIds.length
    ? await supabase.from("campaigns").select("id, name").in("id", campaignIds).returns<Pick<Campaign, "id" | "name">[]>()
    : { data: [] as Pick<Campaign, "id" | "name">[] };
  const campaignNameById = new Map((campaigns ?? []).map((c) => [c.id, c.name]));

  return (
    <main className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Decisions</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Audit trail — every decision recorded on a campaign, most recent first
        </p>
      </div>

      {!decisions || decisions.length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title="No decisions recorded yet"
            description="Approve or override a campaign's recommendation from its detail page — it shows up here."
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground-muted border-b border-border">
                <th className="py-2.5 px-4 font-medium">Date</th>
                <th className="py-2.5 px-4 font-medium">Campaign</th>
                <th className="py-2.5 px-4 font-medium">System rec.</th>
                <th className="py-2.5 px-4 font-medium">Decision</th>
                <th className="py-2.5 px-4 font-medium">Reason</th>
                <th className="py-2.5 px-4 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                  <td className="py-2.5 px-4 text-foreground-muted whitespace-nowrap">
                    {new Date(d.decided_at).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4">
                    <Link href={`/campaigns/${d.campaign_id}`} className="hover:underline max-w-xs truncate block">
                      {campaignNameById.get(d.campaign_id) ?? d.campaign_id}
                    </Link>
                  </td>
                  <td className="py-2.5 px-4">
                    <DecisionBadge decision={d.system_recommendation} />
                  </td>
                  <td className="py-2.5 px-4">
                    <DecisionBadge decision={d.stakeholder_decision} />
                  </td>
                  <td className="py-2.5 px-4 text-xs text-foreground-muted max-w-xs">
                    {d.comment || d.system_reason_codes.map((c) => REASON_COPY[c]).join("; ")}
                  </td>
                  <td className="py-2.5 px-4 text-foreground-muted">{d.decided_by_email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </main>
  );
}
