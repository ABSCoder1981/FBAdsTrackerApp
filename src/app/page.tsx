import Link from "next/link";
import { Wallet, Eye, MousePointerClick, Target, Megaphone } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeDecision, REASON_COPY, DEFAULT_TARGET_CPA, DEFAULT_TARGET_CPL } from "@/lib/health";
import type { Campaign, Decision, InsightSnapshot } from "@/lib/types";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DecisionBadge } from "@/components/DecisionBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { SpendChart } from "@/components/dashboard/SpendChart";
import { SyncButton } from "@/components/dashboard/SyncButton";

export const dynamic = "force-dynamic";

const DECISION_ORDER: Decision[] = ["scale", "continue", "optimize", "watch", "close"];
const DECISION_LABELS: Record<Decision, string> = {
  scale: "Scale",
  continue: "Continue",
  optimize: "Optimize",
  watch: "Watch",
  close: "Close",
};
const DECISION_TONES: Record<Decision, "success" | "warning" | "danger" | "neutral"> = {
  scale: "success",
  continue: "success",
  optimize: "warning",
  watch: "neutral",
  close: "danger",
};

export default async function OverviewPage() {
  const supabase = createServerSupabaseClient();

  const [{ count: activeCount }, { count: totalCount }, { data: campaigns }, { data: snapshots }] =
    await Promise.all([
      supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("is_enabled", true),
      supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
      supabase
        .from("campaigns")
        .select(
          "id, name, objective, is_enabled, delivery_status, target_cpl, target_cpa, updated_at",
        )
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(500)
        .returns<Campaign[]>(),
      supabase
        .from("insight_snapshots")
        .select("campaign_id, date, spend, impressions, clicks, results")
        .returns<Pick<InsightSnapshot, "campaign_id" | "date" | "spend" | "impressions" | "clicks" | "results">[]>(),
    ]);

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

  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : null;
  const avgCostPerResult = totalResults > 0 ? totalSpend / totalResults : null;

  const chartData = [...totalsByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Hero */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Good day, Abbas</h1>
          <p className="text-sm text-foreground-muted mt-1">
            Track campaign performance, spend and lead generation across all connected ad accounts.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/campaigns">
            <Button variant="secondary" size="sm">
              Export
            </Button>
          </Link>
          <SyncButton />
        </div>
      </div>

      {/* KPI grid — Revenue/Profit/ROAS/Sales omitted, no revenue source exists (PRD §12 Q10) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total spend (synced)" value={formatCurrency(totalSpend)} icon={Wallet} emphasis note="all-time synced" />
        <KpiCard label="Impressions" value={formatCompact(totalImpressions)} icon={Eye} note="all-time synced" />
        <KpiCard label="Clicks" value={formatCompact(totalClicks)} icon={MousePointerClick} note="all-time synced" />
        <KpiCard label="Results (leads)" value={formatCompact(totalResults)} icon={Target} note="all-time synced" />
        <KpiCard label="CTR" value={ctr != null ? `${ctr.toFixed(2)}%` : "—"} />
        <KpiCard label="Avg. cost / result" value={avgCostPerResult != null ? formatCurrency(avgCostPerResult) : "—"} />
        <KpiCard label="Active campaigns" value={String(activeCount ?? 0)} icon={Megaphone} note={`of ${totalCount ?? 0} total`} />
        <KpiCard label="Avg. CPC" value={cpc != null ? formatCurrency(cpc) : "—"} />
      </div>

      {/* Decision summary strip — docs/CAMPAIGN_INTELLIGENCE_SPEC.md §3 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {DECISION_ORDER.map((d) => (
          <DecisionSummaryCard
            key={d}
            label={DECISION_LABELS[d]}
            tone={DECISION_TONES[d]}
            count={decisionCounts[d]}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Campaign performance"
            description="Spend vs results, synced days only"
          />
          <CardBody>
            <SpendChart data={chartData} />
          </CardBody>
          <CardFooter>
            {chartData.length > 0
              ? `${chartData.length} synced day${chartData.length === 1 ? "" : "s"}`
              : "No synced data yet — run a sync to populate this chart"}
          </CardFooter>
        </Card>

        {/* Decision summary (list form) */}
        <Card>
          <CardHeader title="Decision summary" description="CPL/CPA vs target, all campaigns" />
          <CardBody className="space-y-3">
            {DECISION_ORDER.map((d) => (
              <DecisionRow key={d} label={DECISION_LABELS[d]} tone={DECISION_TONES[d]} count={decisionCounts[d]} />
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Needs attention */}
      <Card>
        <CardHeader
          title="Needs a decision"
          description="Optimize or Close campaigns, worst cost overrun first"
          action={
            <Link href="/campaigns" className="text-xs font-medium text-foreground hover:underline">
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

function DecisionSummaryCard({
  label,
  tone,
  count,
}: {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
  count: number;
}) {
  const dotClass = {
    success: "bg-success-fg",
    warning: "bg-warning-fg",
    danger: "bg-danger-fg",
    neutral: "bg-foreground-muted",
  }[tone];
  return (
    <div className="border border-border rounded-[var(--radius-lg)] bg-surface p-4">
      <span className={`h-2 w-2 rounded-full inline-block ${dotClass}`} />
      <div className="text-2xl font-semibold tracking-tight mt-1.5">{count}</div>
      <div className="text-xs text-foreground-muted">{label}</div>
    </div>
  );
}

function DecisionRow({
  label,
  tone,
  count,
}: {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
  count: number;
}) {
  const dotClass = {
    success: "bg-success-fg",
    warning: "bg-warning-fg",
    danger: "bg-danger-fg",
    neutral: "bg-foreground-muted",
  }[tone];
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-foreground">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        {label}
      </span>
      <span className="text-sm font-semibold">{count}</span>
    </div>
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
