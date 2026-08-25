-- Reverts the agent_id/users backfill from 0001.
--
-- Reason: campaigns.agent_name turned out to be unreliable free text — spot
-- checking real rows shows it often holds a property/project name (e.g.
-- "SKYORA", "VTP Earth One", "Mantri Kishore Park"), not a salesperson, with
-- no fixed position in the source data to extract the real agent from. PRD
-- §4.1 already warned campaign `name` can't be parsed for this; agent_name
-- itself turns out to have the same problem. Formalizing it into a `users`
-- directory presented fabricated identities as real agents, which is worse
-- than not having the feature. See PRD §12 Q7 (reopened).
--
-- This only touches rows this project created (all users.created_at is
-- 2026-08-25, from migration 0001's backfill) — no original production data
-- is affected. The agent_id/agent_name columns are left in place, unused,
-- pending a real agent-identity source.

update campaigns set agent_id = null where agent_id is not null;

delete from users where email like '%@placeholder.local';
