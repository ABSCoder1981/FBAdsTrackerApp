import { createServerSupabaseClient } from "./supabase/server";

const FB_API_VERSION = "v21.0";

// Meta action_type values that count as a "result" for lead-gen campaigns.
const LEAD_ACTION_TYPES = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
]);

interface FbAction {
  action_type: string;
  value: string;
}

interface FbInsightRow {
  campaign_id: string; // Meta campaign id == campaigns.external_id
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: FbAction[];
  date_start: string;
  publisher_platform?: string;
  platform_position?: string;
  ad_id?: string;
  ad_name?: string;
}

interface InsightSnapshotRow {
  campaign_id: string;
  date: string;
  level: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  cost_per_result: number | null;
  breakdown_dimension: string;
}

function extractResults(objective: string | null, actions: FbAction[] | undefined): number {
  if (!actions) return 0;
  if (objective === "leads") {
    return actions
      .filter((a) => LEAD_ACTION_TYPES.has(a.action_type))
      .reduce((sum, a) => sum + Number(a.value || 0), 0);
  }
  // No clean "result" concept for awareness/custom objectives yet (PRD §6.5) —
  // fall back to link clicks so cost_per_result is at least directionally useful.
  const linkClicks = actions.find((a) => a.action_type === "link_click");
  return linkClicks ? Number(linkClicks.value) : 0;
}

async function fetchInsights(
  adAccountId: string,
  token: string,
  options: { level?: string; extraFields?: string; breakdowns?: string } = {},
): Promise<FbInsightRow[]> {
  const url = new URL(`https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}/insights`);
  url.searchParams.set("level", options.level ?? "campaign");
  url.searchParams.set(
    "fields",
    `campaign_id,spend,impressions,clicks,actions${options.extraFields ? `,${options.extraFields}` : ""}`,
  );
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("date_preset", "yesterday");
  url.searchParams.set("access_token", token);
  if (options.breakdowns) url.searchParams.set("breakdowns", options.breakdowns);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Meta API error ${res.status}: ${await res.text()}`);
  }
  const { data } = (await res.json()) as { data: FbInsightRow[] };
  return data ?? [];
}

export async function runSync(): Promise<{ fetched: number; upserted: number; skipped: number }> {
  const adAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID;
  const token = process.env.FACEBOOK_SYSTEM_USER_TOKEN;

  if (!adAccountId || !token) {
    throw new Error("Missing FACEBOOK_AD_ACCOUNT_ID or FACEBOOK_SYSTEM_USER_TOKEN");
  }

  const supabase = createServerSupabaseClient();

  // Three pulls:
  // - campaign-level (level='campaign', no breakdown)
  // - placement breakdown (level='placement', breakdown_dimension=
  //   "publisher_platform/platform_position") — spec §6D, confirmed real
  //   differentiation (unlike Geography §6E — tested and reverted, spec §0)
  // - ad-level (level='ad', breakdown_dimension=ad's Meta id) — spec §6B,
  //   reduced form (no creative format/thumbnail). Tested live 2026-08-25:
  //   only 4/20 campaigns have >1 ad, thin but real value for those; harmless
  //   single-row table for the rest. Audience (§6C) was tested too and
  //   dropped — every campaign has exactly 1 ad set, nothing to compare.
  const [campaignRows, placementRows, adRows] = await Promise.all([
    fetchInsights(adAccountId, token),
    fetchInsights(adAccountId, token, { breakdowns: "publisher_platform,platform_position" }),
    fetchInsights(adAccountId, token, { level: "ad", extraFields: "ad_id,ad_name" }),
  ]);

  if (campaignRows.length === 0) {
    return { fetched: 0, upserted: 0, skipped: 0 };
  }

  const externalIds = [
    ...new Set([...campaignRows, ...placementRows, ...adRows].map((r) => r.campaign_id)),
  ];
  const { data: campaigns, error: campaignsErr } = await supabase
    .from("campaigns")
    .select("id, external_id, objective")
    .in("external_id", externalIds);

  if (campaignsErr) throw campaignsErr;

  const byExternalId = new Map(campaigns?.map((c) => [c.external_id, c]));

  // Batch ad metadata into one upsert (was one round-trip per ad — with 24+
  // ads plus 100+ insight_snapshots rows, the old sequential-loop version
  // took 14s+ locally and was timing out on Netlify's serverless function
  // execution limit in production).
  const adMetadataRows = adRows
    .map((row) => {
      const campaign = byExternalId.get(row.campaign_id);
      if (!campaign || !row.ad_id) return null;
      return { external_id: row.ad_id, campaign_id: campaign.id, name: row.ad_name ?? row.ad_id };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (adMetadataRows.length > 0) {
    const { error: adUpsertErr } = await supabase
      .from("ads")
      .upsert(adMetadataRows, { onConflict: "external_id" });
    if (adUpsertErr) throw adUpsertErr;
  }

  let skipped = 0;

  function buildRow(row: FbInsightRow, level: string, breakdownDimension: string): InsightSnapshotRow | null {
    const campaign = byExternalId.get(row.campaign_id);
    if (!campaign) {
      skipped++;
      return null;
    }

    const spend = Number(row.spend || 0);
    const results = extractResults(campaign.objective, row.actions);
    const costPerResult = results > 0 ? spend / results : null;

    return {
      campaign_id: campaign.id,
      date: row.date_start,
      level,
      spend,
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      results,
      cost_per_result: costPerResult,
      // "" not null — Postgres treats NULL <> NULL, which broke the unique
      // constraint's ON CONFLICT matching (migration 0004).
      breakdown_dimension: breakdownDimension,
    };
  }

  const snapshotRows: InsightSnapshotRow[] = [
    ...campaignRows.map((row) => buildRow(row, "campaign", "")),
    ...placementRows.map((row) =>
      buildRow(row, "placement", `${row.publisher_platform ?? "unknown"}/${row.platform_position ?? "unknown"}`),
    ),
    ...adRows.filter((row) => row.ad_id).map((row) => buildRow(row, "ad", row.ad_id!)),
  ].filter((r): r is InsightSnapshotRow => r !== null);

  let upserted = 0;
  if (snapshotRows.length > 0) {
    const { error: upsertErr } = await supabase
      .from("insight_snapshots")
      .upsert(snapshotRows, { onConflict: "campaign_id,date,level,breakdown_dimension" });
    if (upsertErr) throw upsertErr;
    upserted = snapshotRows.length;
  }

  return {
    fetched: campaignRows.length + placementRows.length + adRows.length,
    upserted,
    skipped,
  };
}
