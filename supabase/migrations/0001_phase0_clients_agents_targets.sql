-- Phase 0: formalize Client and Agent relations, add CPL/CPA target config.
-- Revenue/ROAS fields intentionally omitted for v1 (see PRD §5, §10, §12 Q2).

-- 1. Client table (structured, replaces bare client_id -> name lookups)
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name text not null,
  locality text,
  unit_types text[],
  builder_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_workspace_id_idx on clients (workspace_id);

-- Backfill from distinct client_id/name pairs already present in campaigns.
insert into clients (id, workspace_id, name)
select distinct on (c.client_id)
  c.client_id,
  c.workspace_id,
  c.name
from campaigns c
where c.client_id is not null
on conflict (id) do nothing;

-- 2. Users + agent_id relation (formalizes agent_name)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  email text not null unique,
  full_name text,
  role text not null default 'marketer' check (role in ('admin', 'marketer', 'viewer')),
  created_at timestamptz not null default now()
);

alter table campaigns
  add column if not exists agent_id uuid references users(id);

-- Best-effort backfill: match distinct agent_name values to a placeholder user row
-- (email is a synthetic slug; real invites/auth are set up separately).
insert into users (workspace_id, email, full_name, role)
select distinct
  c.workspace_id,
  lower(replace(c.agent_name, ' ', '.')) || '@placeholder.local',
  c.agent_name,
  'marketer'
from campaigns c
where c.agent_name is not null and trim(c.agent_name) <> ''
on conflict (email) do nothing;

update campaigns c
set agent_id = u.id
from users u
where c.agent_name is not null
  and trim(c.agent_name) <> ''
  and lower(replace(c.agent_name, ' ', '.')) || '@placeholder.local' = u.email
  and c.agent_id is null;

-- 3. CPL/CPA targets (per-campaign config the app owns, not synced from Meta)
alter table campaigns
  add column if not exists target_cpl numeric,
  add column if not exists target_cpa numeric;

-- 4. InsightSnapshot: daily time-series powering trend charts and health status
create table if not exists insight_snapshots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  date date not null,
  level text not null default 'campaign',
  spend numeric not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  results numeric not null default 0,
  cost_per_result numeric,
  breakdown_dimension text,
  created_at timestamptz not null default now(),
  unique (campaign_id, date, level, breakdown_dimension)
);

create index if not exists insight_snapshots_campaign_date_idx
  on insight_snapshots (campaign_id, date desc);
