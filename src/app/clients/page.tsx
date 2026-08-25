import { Building2 } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Campaign, Client } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = createServerSupabaseClient();

  const [{ data: clients }, { data: campaigns }] = await Promise.all([
    supabase.from("clients").select("id, name, locality, builder_name").returns<Client[]>(),
    supabase
      .from("campaigns")
      .select("client_id, is_enabled")
      .is("deleted_at", null)
      .returns<Pick<Campaign, "client_id" | "is_enabled">[]>(),
  ]);

  const campaignCounts = new Map<string, { total: number; active: number }>();
  for (const c of campaigns ?? []) {
    if (!c.client_id) continue;
    const cur = campaignCounts.get(c.client_id) ?? { total: 0, active: 0 };
    cur.total++;
    if (c.is_enabled) cur.active++;
    campaignCounts.set(c.client_id, cur);
  }

  return (
    <main className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="text-sm text-foreground-muted mt-1">{clients?.length ?? 0} clients</p>
      </div>

      {!clients || clients.length === 0 ? (
        <EmptyState icon={Building2} title="No clients yet" description="Clients are backfilled from campaign data." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-foreground-muted border-b border-border">
                <th className="py-2.5 px-4 font-medium">Client</th>
                <th className="py-2.5 px-4 font-medium">Locality</th>
                <th className="py-2.5 px-4 font-medium">Builder</th>
                <th className="py-2.5 px-4 font-medium">Campaigns</th>
                <th className="py-2.5 px-4 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const counts = campaignCounts.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                    <td className="py-2.5 px-4 font-medium">{c.name}</td>
                    <td className="py-2.5 px-4 text-foreground-muted">{c.locality ?? "—"}</td>
                    <td className="py-2.5 px-4 text-foreground-muted">{c.builder_name ?? "—"}</td>
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
