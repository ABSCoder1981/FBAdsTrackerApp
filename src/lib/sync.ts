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

export async function runSync(): Promise<{ fetched: number; upserted: number; skipped: number }> {
  const adAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID;
  const token = process.env.FACEBOOK_SYSTEM_USER_TOKEN;

  if (!adAccountId || !token) {
    throw new Error("Missing FACEBOOK_AD_ACCOUNT_ID or FACEBOOK_SYSTEM_USER_TOKEN");
  }

  const supabase = createServerSupabaseClient();

  const insightsUrl = new URL(
    `https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}/insights`,
  );
  insightsUrl.searchParams.set("level", "campaign");
  insightsUrl.searchParams.set("fields", "campaign_id,spend,impressions,clicks,actions");
  insightsUrl.searchParams.set("time_increment", "1");
  insightsUrl.searchParams.set("date_preset", "yesterday");
  insightsUrl.searchParams.set("access_token", token);

  const res = await fetch(insightsUrl);
  if (!res.ok) {
    throw new Error(`Meta API error ${res.status}: ${await res.text()}`);
  }
  const { data } = (await res.json()) as { data: FbInsightRow[] };

  if (!data || data.length === 0) {
    return { fetched: 0, upserted: 0, skipped: 0 };
  }

  const externalIds = [...new Set(data.map((r) => r.campaign_id))];
  const { data: campaigns, error: campaignsErr } = await supabase
    .from("campaigns")
    .select("id, external_id, objective")
    .in("external_id", externalIds);

  if (campaignsErr) throw campaignsErr;

  const byExternalId = new Map(campaigns?.map((c) => [c.external_id, c]));

  let upserted = 0;
  let skipped = 0;

  for (const row of data) {
    const campaign = byExternalId.get(row.campaign_id);
    if (!campaign) {
      skipped++;
      continue;
    }

    const spend = Number(row.spend || 0);
    const results = extractResults(campaign.objective, row.actions);
    const costPerResult = results > 0 ? spend / results : null;

    const { error: upsertErr } = await supabase.from("insight_snapshots").upsert(
      {
        campaign_id: campaign.id,
        date: row.date_start,
        level: "campaign",
        spend,
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        results,
        cost_per_result: costPerResult,
        // "" not null — Postgres treats NULL <> NULL, which broke the unique
        // constraint's ON CONFLICT matching (migration 0004).
        breakdown_dimension: "",
      },
      { onConflict: "campaign_id,date,level,breakdown_dimension" },
    );

    if (upsertErr) throw upsertErr;
    upserted++;
  }

  return { fetched: data.length, upserted, skipped };
}
