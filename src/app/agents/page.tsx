import { Users } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
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

  return (
    <main className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-foreground-muted mt-1">{agents?.length ?? 0} agents, backfilled from campaign tags</p>
      </div>

      {!agents || agents.length === 0 ? (
        <EmptyState icon={Users} title="No agents yet" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground-muted border-b border-border">
                <th className="py-2.5 px-4 font-medium">Agent</th>
                <th className="py-2.5 px-4 font-medium">Role</th>
                <th className="py-2.5 px-4 font-medium">Campaigns</th>
                <th className="py-2.5 px-4 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const counts = campaignCounts.get(a.id);
                return (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-surface-muted flex items-center justify-center text-xs font-medium">
                          {(a.full_name ?? a.email)[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium">{a.full_name ?? a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-foreground-muted capitalize">{a.role}</td>
                    <td className="py-2.5 px-4">{counts?.total ?? 0}</td>
                    <td className="py-2.5 px-4">{counts?.active ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </main>
  );
}
