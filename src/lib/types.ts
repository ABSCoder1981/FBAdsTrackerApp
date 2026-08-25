export type HealthStatus = "profitable" | "watch" | "underperforming" | "insufficient_data";

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

export interface Client {
  id: string;
  workspace_id: string;
  name: string;
  locality: string | null;
  unit_types: string[] | null;
  builder_name: string | null;
}
