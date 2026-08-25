import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">FB Ads Tracker — Overview</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Active campaigns" value={activeCount ?? 0} />
        <StatCard label="Total campaigns" value={totalCount ?? 0} />
        <StatCard label="Spend (MTD)" value="—" note="pending sync worker" />
        <StatCard label="Avg. cost/result" value="—" note="pending sync worker" />
      </div>

      <p className="text-sm text-gray-500">
        Health status badges and spend metrics populate once the daily sync worker
        (netlify/functions/sync.ts) has written insight_snapshots rows.
      </p>

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
