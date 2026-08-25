import { Users } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { AgentsTable, type AgentRow } from "@/components/agents/AgentsTable";
import type { Campaign } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Agent {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

export default async function AgentsPage() {
  const supabase = createServerSupabaseClient();

  const [{ data: agents }, { data: campaigns }] = await Promise.all([
    supabase.from("users").select("id, full_name, email, role").returns<Agent[]>(),
    supabase
      .from("campaigns")
      .select("agent_id, is_enabled")
      .is("deleted_at", null)
      .returns<Pick<Campaign, "agent_id" | "is_enabled">[]>(),
  ]);

  const campaignCounts = new Map<string, { total: number; active: number }>();
  for (const c of campaigns ?? []) {
    if (!c.agent_id) continue;
    const cur = campaignCounts.get(c.agent_id) ?? { total: 0, active: 0 };
    cur.total++;
    if (c.is_enabled) cur.active++;
    campaignCounts.set(c.agent_id, cur);
  }

  const rows: AgentRow[] = (agents ?? []).map((a) => {
    const counts = campaignCounts.get(a.id);
    return {
      id: a.id,
      displayName: a.full_name ?? a.email,
      role: a.role,
      totalCampaigns: counts?.total ?? 0,
      activeCampaigns: counts?.active ?? 0,
    };
  });

  return (
    <main className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-foreground-muted mt-1">{rows.length} agents, backfilled from campaign tags</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title="No agents yet" />
      ) : (
        <AgentsTable rows={rows} />
      )}
    </main>
  );
}
