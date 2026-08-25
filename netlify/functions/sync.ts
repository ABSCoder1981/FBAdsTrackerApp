import type { Config } from "@netlify/functions";
import { createServerSupabaseClient } from "../../src/lib/supabase/server";

// Netlify Scheduled Function: pulls campaign insights from the Meta Marketing API
// and writes daily rows into insight_snapshots. Runs on the schedule below;
// CRON_SECRET guards the equivalent manual-trigger HTTP path once one exists.

const FB_API_VERSION = "v21.0";

export default async () => {
  const adAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID;
  const token = process.env.FACEBOOK_SYSTEM_USER_TOKEN;

  if (!adAccountId || !token) {
    console.error("Missing FACEBOOK_AD_ACCOUNT_ID or FACEBOOK_SYSTEM_USER_TOKEN");
    return new Response("Missing FB credentials", { status: 500 });
  }

  const supabase = createServerSupabaseClient();

  const insightsUrl = new URL(
    `https://graph.facebook.com/${FB_API_VERSION}/${adAccountId}/insights`,
  );
  insightsUrl.searchParams.set("level", "campaign");
  insightsUrl.searchParams.set(
    "fields",
    "campaign_id,spend,impressions,clicks,actions,cost_per_action_type",
  );
  insightsUrl.searchParams.set("date_preset", "yesterday");
  insightsUrl.searchParams.set("access_token", token);

  const res = await fetch(insightsUrl);
  if (!res.ok) {
    console.error("Meta API error", res.status, await res.text());
    return new Response("Meta API error", { status: 502 });
  }

  const { data } = (await res.json()) as { data: Array<Record<string, unknown>> };

  // TODO: map external_id -> internal campaign id, compute results/cost_per_result
  // from `actions`/`cost_per_action_type` per objective, then upsert into
  // insight_snapshots. Left unimplemented pending confirmed FB Business Manager
  // access (PRD §12 Q1) and objective-to-action-type mapping.
  console.log(`Fetched ${data?.length ?? 0} insight rows`);

  return new Response("ok");
};

export const config: Config = {
  schedule: "0 2 * * *", // daily at 02:00 UTC
};
