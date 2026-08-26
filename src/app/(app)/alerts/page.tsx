import Link from "next/link";
import { BellRing, TriangleAlert } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAll";
import { detectAnomalies, type Anomaly, type DailyPoint } from "@/lib/anomalies";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Campaign, InsightSnapshot } from "@/lib/types";

// See src/app/(app)/page.tsx for why this changed from force-dynamic. Longer
// window here — this page pages through every insight_snapshots row and
// recomputes anomaly detection for every campaign on each request, the
// heaviest page in the app.
export const revalidate = 120;

export default async function AlertsPage() {
  const supabase = createServerSupabaseClient();

  type SnapshotRow = Pick<InsightSnapshot, "campaign_id" | "date" | "spend" | "impressions" | "clicks" | "results">;

  const [{ data: campaigns }, snapshots] = await Promise.all([
    // Only currently-enabled campaigns — an alert should mean "something
    // needs your attention right now," not "this campaign ended weeks ago."
    supabase
      .from("campaigns")
      .select("id, name")
      .is("deleted_at", null)
      .eq("is_enabled", true)
      .returns<Pick<Campaign, "id" | "name">[]>(),
    fetchAllRows<SnapshotRow>((from, to) =>
      supabase
        .from("insight_snapshots")
        .select("campaign_id, date, spend, impressions, clicks, results")
        .eq("level", "campaign")
        .order("date", { ascending: true })
        .range(from, to)
        .returns<SnapshotRow[]>(),
    ),
  ]);

  const nameById = new Map((campaigns ?? []).map((c) => [c.id, c.name]));

  // Overall most recent synced date across everything — used below to skip
  // campaigns whose last data point is stale (they stopped running weeks
  // ago; that's not "something needs attention right now").
  const mostRecentDate = snapshots.reduce((max, s) => (s.date > max ? s.date : max), "");
  const recencyFloor = new Date(mostRecentDate);
  recencyFloor.setDate(recencyFloor.getDate() - 2);
  const recencyFloorStr = recencyFloor.toISOString().slice(0, 10);

  const byCampaign = new Map<string, DailyPoint[]>();
  for (const s of snapshots) {
    if (!nameById.has(s.campaign_id)) continue; // only currently-enabled campaigns
    const cur = byCampaign.get(s.campaign_id) ?? [];
    cur.push({ date: s.date, spend: s.spend, impressions: s.impressions, clicks: s.clicks, results: s.results });
    byCampaign.set(s.campaign_id, cur);
  }

  const flagged: { campaignId: string; campaignName: string; anomaly: Anomaly }[] = [];
  let evaluatedCount = 0;
  for (const [campaignId, points] of byCampaign) {
    if (points.length < 6) continue; // detectAnomalies' own floor, checked here too so evaluatedCount is meaningful
    const latestDate = points[points.length - 1].date;
    if (latestDate < recencyFloorStr) continue; // campaign's data has gone stale — nothing "current" to flag
    evaluatedCount++;
    const anomalies = detectAnomalies(points);
    for (const anomaly of anomalies) {
      flagged.push({ campaignId, campaignName: nameById.get(campaignId) ?? campaignId, anomaly });
    }
  }

  flagged.sort((a, b) => (a.anomaly.severity === b.anomaly.severity ? 0 : a.anomaly.severity === "high" ? -1 : 1));

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Today&apos;s numbers vs each campaign&apos;s own trailing 7-day average — {evaluatedCount} campaigns had
          enough history to evaluate
        </p>
      </div>

      {flagged.length === 0 ? (
        <Card>
          <EmptyState
            icon={BellRing}
            title="Nothing flagged"
            description={
              evaluatedCount === 0
                ? "No campaign has enough synced history yet (needs ≥6 days) to establish a trailing average."
                : "No campaign's latest synced day deviates meaningfully from its own recent trend."
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {flagged.map(({ campaignId, campaignName, anomaly }, i) => (
            <Card key={`${campaignId}-${anomaly.type}-${i}`}>
              <div className="p-4 flex items-start gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    anomaly.severity === "high" ? "bg-tile-red-bg text-tile-red-fg" : "bg-tile-orange-bg text-tile-orange-fg"
                  }`}
                >
                  <TriangleAlert size={17} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/campaigns/${campaignId}`} className="font-medium text-sm hover:underline truncate">
                      {campaignName}
                    </Link>
                    <Badge tone={anomaly.severity === "high" ? "danger" : "warning"}>{anomaly.severity}</Badge>
                  </div>
                  <p className="text-sm mt-0.5">{anomaly.headline}</p>
                  <p className="text-xs text-foreground-muted mt-0.5">{anomaly.detail}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
