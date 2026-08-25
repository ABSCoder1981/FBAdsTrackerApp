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
  breakdowns?: string,
): Promise<FbInsightRow[]> {
  const url = new URL(`https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}/insights`);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("fields", "campaign_id,spend,impressions,clicks,actions");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("date_preset", "yesterday");
  url.searchParams.set("access_token", token);
  if (breakdowns) url.searchParams.set("breakdowns", breakdowns);

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

  // Two pulls: aggregate campaign-level (level='campaign', no breakdown) and
  // placement breakdown (level='placement', breakdown_dimension=
  // "publisher_platform/platform_position") — docs/CAMPAIGN_INTELLIGENCE_SPEC.md
  // §6D, confirmed to have real differentiation for this account (unlike
  // Geography, §6E — tested and reverted, see spec §0).
  const [campaignRows, placementRows] = await Promise.all([
    fetchInsights(adAccountId, token),
    fetchInsights(adAccountId, token, "publisher_platform,platform_position"),
  ]);

  if (campaignRows.length === 0) {
    return { fetched: 0, upserted: 0, skipped: 0 };
  }

  const externalIds = [...new Set([...campaignRows, ...placementRows].map((r) => r.campaign_id))];
  const { data: campaigns, error: campaignsErr } = await supabase
    .from("campaigns")
    .select("id, external_id, objective")
    .in("external_id", externalIds);

  if (campaignsErr) throw campaignsErr;

  const byExternalId = new Map(campaigns?.map((c) => [c.external_id, c]));

  let upserted = 0;
  let skipped = 0;

  async function upsertRow(row: FbInsightRow, level: string, breakdownDimension: string) {
    const campaign = byExternalId.get(row.campaign_id);
    if (!campaign) {
      skipped++;
      return;
    }

    const spend = Number(row.spend || 0);
    const results = extractResults(campaign.objective, row.actions);
    const costPerResult = results > 0 ? spend / results : null;

    const { error: upsertErr } = await supabase.from("insight_snapshots").upsert(
      {
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
      },
      { onConflict: "campaign_id,date,level,breakdown_dimension" },
    );

    if (upsertErr) throw upsertErr;
    upserted++;
  }

  for (const row of campaignRows) {
    await upsertRow(row, "campaign", "");
  }
  for (const row of placementRows) {
    const dimension = `${row.publisher_platform ?? "unknown"}/${row.platform_position ?? "unknown"}`;
    await upsertRow(row, "placement", dimension);
  }

  return { fetched: campaignRows.length + placementRows.length, upserted, skipped };
}
