-- Decision Center / Decision History — docs/CAMPAIGN_INTELLIGENCE_SPEC.md §10.
-- Was blocked on real auth (no "who" to attach a decision to); unblocked
-- 2026-08-26 when Supabase Auth shipped. decided_by references Supabase's
-- built-in auth.users, not this project's own (now-empty) `users` table —
-- that table was for the reverted agent-formalization attempt, unrelated.

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  system_recommendation text not null,       -- scale/continue/optimize/watch/close at decision time
  system_reason_codes text[] not null default '{}',
  stakeholder_decision text not null,        -- approve/override_scale/override_continue/override_optimize/override_close
  comment text,
  decided_by uuid references auth.users(id),
  -- Denormalized at write time: auth.users isn't reachable from the public
  -- REST client, and with only a couple of admin accounts on this app,
  -- joining it properly isn't worth the complexity yet.
  decided_by_email text,
  decided_at timestamptz not null default now()
);

create index if not exists decisions_campaign_id_idx on decisions (campaign_id, decided_at desc);
create index if not exists decisions_decided_at_idx on decisions (decided_at desc);
