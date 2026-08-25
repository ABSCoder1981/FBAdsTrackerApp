-- Bug: insight_snapshots' unique constraint (campaign_id, date, level,
-- breakdown_dimension) never dedupes, because breakdown_dimension is NULL on
-- every row and Postgres treats NULL <> NULL for uniqueness purposes. Every
-- sync run has been inserting fresh duplicate rows instead of upserting,
-- silently doubling spend/impressions/clicks/results on repeat syncs.
--
-- Fix: make breakdown_dimension NOT NULL with a '' sentinel instead of NULL,
-- so the existing unique constraint actually matches on conflict. Dedupe
-- existing duplicate rows first, keeping the most recently synced one.

delete from insight_snapshots a
using insight_snapshots b
where a.campaign_id = b.campaign_id
  and a.date = b.date
  and a.level = b.level
  and (a.breakdown_dimension is not distinct from b.breakdown_dimension)
  and a.created_at < b.created_at;

update insight_snapshots
set breakdown_dimension = ''
where breakdown_dimension is null;

alter table insight_snapshots
  alter column breakdown_dimension set default '',
  alter column breakdown_dimension set not null;
