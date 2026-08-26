"use server";

import { revalidatePath } from "next/cache";
import { createServerAuthClient } from "./supabase/serverAuth";
import { createServerSupabaseClient } from "./supabase/server";
import type { Decision } from "./types";
import type { ReasonCode } from "./health";

export interface DecisionRecord {
  id: string;
  campaign_id: string;
  system_recommendation: Decision;
  system_reason_codes: ReasonCode[];
  stakeholder_decision: Decision;
  comment: string | null;
  decided_by: string | null;
  decided_by_email: string | null;
  decided_at: string;
}

export async function recordDecision(params: {
  campaignId: string;
  systemRecommendation: Decision;
  systemReasonCodes: ReasonCode[];
  stakeholderDecision: Decision;
  comment: string;
}) {
  const authClient = await createServerAuthClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    throw new Error("Must be signed in to record a decision");
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("decisions").insert({
    campaign_id: params.campaignId,
    system_recommendation: params.systemRecommendation,
    system_reason_codes: params.systemReasonCodes,
    stakeholder_decision: params.stakeholderDecision,
    comment: params.comment || null,
    decided_by: user.id,
    decided_by_email: user.email,
  });

  if (error) throw error;

  revalidatePath(`/campaigns/${params.campaignId}`);
  revalidatePath("/decisions");
}
