-- Ad-level metadata for Creative analysis (docs/CAMPAIGN_INTELLIGENCE_SPEC.md
-- §6B, reduced form — no creative format/thumbnail, which need extra Meta API
-- calls not wired up yet). Real synced Meta data, not fabricated like the
-- earlier agent_name/clients attempt.
--
-- insight_snapshots rows at level='ad' use breakdown_dimension = ads.external_id
-- (same "reuse the existing level/breakdown_dimension pattern" approach as
-- Placement, §6D) — no new columns on insight_snapshots needed.

create table if not exists ads (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  campaign_id uuid not null references campaigns(id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ads_campaign_id_idx on ads (campaign_id);
