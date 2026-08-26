// 5-state Decision taxonomy — PRD §13.4 / docs/CAMPAIGN_INTELLIGENCE_SPEC.md §8.
// Replaces the old 4-state HealthStatus (profitable/watch/underperforming/insufficient_data).
export type Decision = "scale" | "continue" | "optimize" | "watch" | "close";

export interface Campaign {
  id: string;
  workspace_id: string;
  client_id: string | null;
  name: string;
  platform: string;
  objective: string;
  is_enabled: boolean;
  delivery_status: string | null;
  budget_type: string | null;
  budget_amount: number | null;
  budget_currency: string | null;
  agent_id: string | null;
  agent_name: string | null;
  target_cpl: number | null;
  target_cpa: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Ad {
  id: string;
  external_id: string;
  campaign_id: string;
  name: string;
}

export interface InsightSnapshot {
  id: string;
  campaign_id: string;
  date: string;
  level: string;
  spend: number;
  impressions: number;
  clicks: number;
  results: number;
  cost_per_result: number | null;
  breakdown_dimension: string | null;
  created_at: string;
}
