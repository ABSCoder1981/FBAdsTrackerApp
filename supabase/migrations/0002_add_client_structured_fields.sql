-- Fix-up for 0001: `clients` already existed in production (created 2026-07-21,
-- before this project's migrations) with only id/workspace_id/name/timestamps.
-- 0001's `create table if not exists` therefore no-opped and never added the
-- structured fields PRD §12 Q8 called for. This adds them without touching
-- existing rows.

alter table clients
  add column if not exists locality text,
  add column if not exists unit_types text[],
  add column if not exists builder_name text;
