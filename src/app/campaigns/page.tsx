import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Campaign } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const supabase = createServerSupabaseClient();

  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select(
      "id, name, client_id, objective, is_enabled, delivery_status, budget_type, budget_amount, budget_currency, agent_name",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .returns<Campaign[]>();

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
            </tr>
          </thead>
          <tbody>
            {campaigns?.map((c) => (
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
              </tr>
            ))}
          </tbody>
        </table>
        {campaigns?.length === 0 && (
          <p className="text-gray-500 mt-4">No campaigns found.</p>
        )}
      </div>
    </main>
  );
}
