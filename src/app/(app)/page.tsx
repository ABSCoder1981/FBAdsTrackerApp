import Link from "next/link";
import { Suspense } from "react";
import { Wallet, Eye, MousePointerClick, Target, Megaphone, Percent, Coins } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeDecision, REASON_COPY, DEFAULT_TARGET_CPA, DEFAULT_TARGET_CPL } from "@/lib/health";
import type { Campaign, Decision, InsightSnapshot } from "@/lib/types";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DecisionBadge } from "@/components/DecisionBadge";
import { DecisionSummaryCard } from "@/components/DecisionSummaryCard";
import { StatusBadge } from "@/components/StatusBadge";
import { SpendChart } from "@/components/dashboard/SpendChart";
import { SyncButton } from "@/components/dashboard/SyncButton";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";

// force-dynamic disabled ALL caching, so every click re-ran the full set of
// Supabase queries below (each 400-900ms alone) from scratch. Data here only
// changes when a sync runs (nightly cron, or the manual Sync button) — a
// short cache window makes repeat navigation near-instant without showing
// stale data for more than a few seconds. triggerSync's revalidatePath("/")
// still forces an immediate refresh right after a manual sync.
export const revalidate = 30;

const DECISION_ORDER: Decision[] = ["scale", "continue", "optimize", "watch", "close"];

type SnapshotRow = Pick<
  InsightSnapshot,
  "campaign_id" | "date" | "spend" | "impressions" | "clicks" | "results"
>;

function aggregate(snapshots: SnapshotRow[] | null) {
  const totalsByCampaign = new Map<string, { spend: number; results: number; dates: Set<string> }>();
  const totalsByDate = new Map<string, { spend: number; impressions: number; clicks: number; results: number }>();
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalResults = 0;

  for (const s of snapshots ?? []) {
    const cur = totalsByCampaign.get(s.campaign_id) ?? { spend: 0, results: 0, dates: new Set<string>() };
    cur.spend += s.spend;
    cur.results += s.results;
    cur.dates.add(s.date);
    totalsByCampaign.set(s.campaign_id, cur);

    const day = totalsByDate.get(s.date) ?? { spend: 0, impressions: 0, clicks: 0, results: 0 };
    day.spend += s.spend;
    day.impressions += s.impressions;
    day.clicks += s.clicks;
    day.results += s.results;
    totalsByDate.set(s.date, day);

    totalSpend += s.spend;
    totalImpressions += s.impressions;
    totalClicks += s.clicks;
    totalResults += s.results;
  }

  return { totalsByCampaign, totalsByDate, totalSpend, totalImpressions, totalClicks, totalResults };
}

function pctChange(current: number, previous: number): number | undefined {
  if (previous === 0) return undefined;
  return ((current - previous) / previous) * 100;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; objective?: string }>;
}) {
  const { days: daysParam, objective } = await searchParams;
  const days = daysParam ?? "30";

  const supabase = createServerSupabaseClient();

  let campaignsQuery = supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  let activeQuery = supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("is_enabled", true);
  let allCampaignsQuery = supabase
    .from("campaigns")
    .select(
      "id, name, objective, is_enabled, delivery_status, target_cpl, target_cpa, updated_at, budget_type, budget_amount, budget_currency",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);

  if (objective) {
    campaignsQuery = campaignsQuery.eq("objective", objective);
    activeQuery = activeQuery.eq("objective", objective);
    allCampaignsQuery = allCampaignsQuery.eq("objective", objective);
  }

  const snapshotsSelect = "campaign_id, date, spend, impressions, clicks, results";
  let snapshotsQuery = supabase.from("insight_snapshots").select(snapshotsSelect).eq("level", "campaign");

  // Previous-period comparison needs a second, equal-length window
  // immediately before the current one — only meaningful when a concrete
  // range is selected (there's no "previous" for "all time").
  let previousSnapshotsPromise: PromiseLike<{ data: SnapshotRow[] | null }> = Promise.resolve({ data: null });

  if (days !== "all") {
    const n = Number(days);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - n);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    snapshotsQuery = snapshotsQuery.gte("date", cutoffStr);

    // objective lives on campaigns, not insight_snapshots — filtering the
    // previous-period comparison by it would need a join, so skip the
    // comparison entirely when an objective filter is active rather than
    // silently ignoring the filter and showing a misleading number.
    if (!objective) {
      const prevCutoff = new Date();
      prevCutoff.setDate(prevCutoff.getDate() - n * 2);
      const prevCutoffStr = prevCutoff.toISOString().slice(0, 10);

      previousSnapshotsPromise = supabase
        .from("insight_snapshots")
        .select(snapshotsSelect)
        .eq("level", "campaign")
        .gte("date", prevCutoffStr)
        .lt("date", cutoffStr)
        .returns<SnapshotRow[]>();
    }
  }

  const [
    { count: activeCount },
    { count: totalCount },
    { data: campaigns },
    { data: snapshots },
    { data: previousSnapshots },
    { data: lastSync },
  ] = await Promise.all([
    activeQuery,
    campaignsQuery,
    allCampaignsQuery.returns<Campaign[]>(),
    snapshotsQuery.returns<SnapshotRow[]>(),
    previousSnapshotsPromise,
    supabase.from("insight_snapshots").select("created_at").order("created_at", { ascending: false }).limit(1),
  ]);

  const { totalsByCampaign, totalsByDate, totalSpend, totalImpressions, totalClicks, totalResults } =
    aggregate(snapshots);
  const prev = aggregate(previousSnapshots);

  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : null;
  const avgCostPerResult = totalResults > 0 ? totalSpend / totalResults : null;
  const prevCtr = prev.totalImpressions > 0 ? (prev.totalClicks / prev.totalImpressions) * 100 : null;
  const prevCpc = prev.totalClicks > 0 ? prev.totalSpend / prev.totalClicks : null;
  const prevAvgCostPerResult = prev.totalResults > 0 ? prev.totalSpend / prev.totalResults : null;

  const hasComparison = days !== "all" && !objective && (previousSnapshots?.length ?? 0) > 0;

  const decisionCounts: Record<Decision, number> = { scale: 0, continue: 0, optimize: 0, watch: 0, close: 0 };
  const evaluated: {
    campaign: Campaign;
    decision: Decision;
    reasons: ReturnType<typeof computeDecision>["reasons"];
    costPerResult: number | null;
    target: number;
    spend: number;
  }[] = [];

  for (const c of campaigns ?? []) {
    const totals = totalsByCampaign.get(c.id);
    const costPerResult = totals && totals.results > 0 ? totals.spend / totals.results : null;
    const target =
      c.objective === "leads" ? c.target_cpl ?? DEFAULT_TARGET_CPL : c.target_cpa ?? DEFAULT_TARGET_CPA;
    const { decision, reasons } = computeDecision({
      spend: totals?.spend ?? 0,
      costPerResult,
      target,
      daysSynced: totals?.dates.size ?? 0,
    });
    decisionCounts[decision]++;
    evaluated.push({ campaign: c, decision, reasons, costPerResult, target, spend: totals?.spend ?? 0 });
  }

  // Spend vs Budget: sums each campaign's *allocated* budget against its
  // actual spend over the same synced window. "Allocated" for a daily
  // budget is budget_amount × days synced (there's no account-level budget
  // cap to compare against, unlike the reference mockup — PRD §12 Q6); for
  // a lifetime budget it's just budget_amount. Only counts campaigns that
  // have a budget set and at least one synced day, so this stays traceable
  // to real numbers rather than a guess (spec Principle 8).
  let budgetAllocated = 0;
  let budgetSpend = 0;
  let budgetCampaignCount = 0;
  for (const c of campaigns ?? []) {
    if (c.budget_amount == null) continue;
    const totals = totalsByCampaign.get(c.id);
    const daysSynced = totals?.dates.size ?? 0;
    if (daysSynced === 0) continue;
    const allocated = c.budget_type === "daily" ? c.budget_amount * daysSynced : c.budget_amount;
    budgetAllocated += allocated;
    budgetSpend += totals!.spend;
    budgetCampaignCount++;
  }
  const budgetPct = budgetAllocated > 0 ? Math.min(100, (budgetSpend / budgetAllocated) * 100) : null;

  // Owner's core question: which campaigns need a decision right now? Worst
  // cost-per-result overrun first, so the most urgent calls surface at the top.
  const needsAttention = evaluated
    .filter((e) => e.decision === "close" || e.decision === "optimize")
    .sort((a, b) => {
      const overrunA = a.costPerResult != null ? a.costPerResult / a.target : 0;
      const overrunB = b.costPerResult != null ? b.costPerResult / b.target : 0;
      return overrunB - overrunA;
    })
    .slice(0, 8);

  const rangeNote = days === "all" ? "all-time synced" : `last ${days} days, synced`;

  const chartData = [...totalsByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const spendSparkline = chartData.map((d) => d.spend);
  const resultsSparkline = chartData.map((d) => d.results);
  const impressionsSparkline = chartData.map((d) => d.impressions);
  const clicksSparkline = chartData.map((d) => d.clicks);

  const lastSyncedAt = lastSync?.[0]?.created_at ? new Date(lastSync[0].created_at) : null;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}, Abbas 👋</h1>
          <p className="text-sm text-foreground-muted mt-1">
            Here&apos;s what&apos;s happening with your ad campaigns.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <Link href="/campaigns">
              <Button variant="secondary" size="sm">
                Export
              </Button>
            </Link>
            <SyncButton />
          </div>
          {lastSyncedAt && <RelativeSyncTime label={relativeSyncLabel(lastSyncedAt, now)} />}
        </div>
      </div>

      <Suspense fallback={<div className="h-9" />}>
        <DashboardFilters />
      </Suspense>

      {/* KPI grid — Revenue/Profit/ROAS/Sales omitted, no revenue source exists (PRD §12 Q10) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total spend"
          value={formatCurrency(totalSpend)}
          icon={Wallet}
          tone="blue"
          emphasis
          note={hasComparison ? undefined : rangeNote}
          changePct={hasComparison ? pctChange(totalSpend, prev.totalSpend) : undefined}
          sparkline={spendSparkline}
        />
        <KpiCard
          label="Impressions"
          value={formatCompact(totalImpressions)}
          icon={Eye}
          tone="purple"
          note={hasComparison ? undefined : rangeNote}
          changePct={hasComparison ? pctChange(totalImpressions, prev.totalImpressions) : undefined}
          sparkline={impressionsSparkline}
        />
        <KpiCard
          label="Clicks"
          value={formatCompact(totalClicks)}
          icon={MousePointerClick}
          tone="orange"
          note={hasComparison ? undefined : rangeNote}
          changePct={hasComparison ? pctChange(totalClicks, prev.totalClicks) : undefined}
          sparkline={clicksSparkline}
        />
        <KpiCard
          label="Results (leads)"
          value={formatCompact(totalResults)}
          icon={Target}
          tone="green"
          note={hasComparison ? undefined : rangeNote}
          changePct={hasComparison ? pctChange(totalResults, prev.totalResults) : undefined}
          sparkline={resultsSparkline}
        />
        <KpiCard
          label="CTR"
          value={ctr != null ? `${ctr.toFixed(2)}%` : "—"}
          icon={Percent}
          tone="blue"
          changePct={hasComparison && ctr != null && prevCtr != null ? pctChange(ctr, prevCtr) : undefined}
        />
        <KpiCard
          label="Avg. cost / result"
          value={avgCostPerResult != null ? formatCurrency(avgCostPerResult) : "—"}
          icon={Coins}
          tone="purple"
          changePct={
            hasComparison && avgCostPerResult != null && prevAvgCostPerResult != null
              ? pctChange(avgCostPerResult, prevAvgCostPerResult)
              : undefined
          }
        />
        <KpiCard
          label="Active campaigns"
          value={String(activeCount ?? 0)}
          icon={Megaphone}
          tone="orange"
          note={`of ${totalCount ?? 0} total`}
        />
        <KpiCard
          label="Avg. CPC"
          value={cpc != null ? formatCurrency(cpc) : "—"}
          icon={Wallet}
          tone="green"
          changePct={hasComparison && cpc != null && prevCpc != null ? pctChange(cpc, prevCpc) : undefined}
        />
      </div>

      {/* Decision summary strip — docs/CAMPAIGN_INTELLIGENCE_SPEC.md §3 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {DECISION_ORDER.map((d) => (
          <DecisionSummaryCard key={d} decision={d} count={decisionCounts[d]} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader title="Campaign performance" description="Spend vs results, synced days only" />
          <CardBody>
            <SpendChart data={chartData} />
          </CardBody>
          <CardFooter>
            {chartData.length > 0
              ? `${chartData.length} synced day${chartData.length === 1 ? "" : "s"}`
              : "No synced data yet — run a sync to populate this chart"}
          </CardFooter>
        </Card>

        <div className="space-y-4">
          {/* Spend vs Budget */}
          <Card>
            <CardHeader title="Spend vs budget" description={`${budgetCampaignCount} campaigns with a budget set`} />
            <CardBody>
              {budgetPct == null ? (
                <p className="text-sm text-foreground-muted">No budgeted, synced campaigns yet.</p>
              ) : (
                <>
                  <div className="flex items-baseline justify-between text-sm mb-2">
                    <span className="font-semibold">{formatCurrency(budgetSpend)}</span>
                    <span className="text-foreground-muted">of {formatCurrency(budgetAllocated)} allocated</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${budgetPct >= 100 ? "bg-danger-fg" : budgetPct >= 85 ? "bg-warning-fg" : "bg-success-fg"}`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-foreground-muted mt-2">
                    Daily-budget campaigns: budget × days synced. Lifetime-budget campaigns: budget cap. No
                    account-level budget exists to compare against (PRD §12 Q6).
                  </p>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Needs attention */}
      <Card>
        <CardHeader
          title="Campaigns needing attention"
          description="Optimize or Close campaigns, worst cost overrun first"
          action={
            <Link href="/campaigns" className="text-xs font-medium text-primary hover:underline">
              View all campaigns →
            </Link>
          }
        />
        {needsAttention.length === 0 ? (
          <CardBody>
            <p className="text-sm text-foreground-muted">
              Nothing needs attention right now — no campaign is in Optimize or Close.
            </p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-foreground-muted border-t border-b border-border">
                  <th className="py-2 px-5 font-medium">Campaign</th>
                  <th className="py-2 px-5 font-medium">Status</th>
                  <th className="py-2 px-5 font-medium">Cost/Result vs target</th>
                  <th className="py-2 px-5 font-medium">Decision</th>
                  <th className="py-2 px-5 font-medium">Why</th>
                </tr>
              </thead>
              <tbody>
                {needsAttention.map(({ campaign: c, decision, reasons, costPerResult, target }) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                    <td className="py-2.5 px-5">
                      <Link href={`/campaigns/${c.id}`} className="font-medium truncate max-w-xs hover:underline block">
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-2.5 px-5">
                      <StatusBadge isEnabled={c.is_enabled} deliveryStatus={c.delivery_status} />
                    </td>
                    <td className="py-2.5 px-5 text-foreground-muted">
                      {costPerResult != null ? `${costPerResult.toFixed(2)} / ${target}` : "—"}
                    </td>
                    <td className="py-2.5 px-5">
                      <DecisionBadge decision={decision} />
                    </td>
                    <td className="py-2.5 px-5 text-xs text-foreground-muted">
                      {reasons.map((code) => REASON_COPY[code]).join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function relativeSyncLabel(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60000));
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} hr ago`;
}

function RelativeSyncTime({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-success-fg" />
      Synced {label}
    </span>
  );
}

function formatCurrency(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
