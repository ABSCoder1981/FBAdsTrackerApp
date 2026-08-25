# PRD: Facebook Ads Campaign Tracker Dashboard

## 1. Overview

**Problem:** The team currently reviews campaign performance manually inside Meta Ads Manager, with no centralized view of what's active, what's spending, and what's actually profitable. There's no automated way to flag underperforming campaigns before they burn budget.

**Solution:** An internal web dashboard that auto-syncs with the Facebook Marketing API and surfaces campaign counts, spend, performance, and profitability at a glance — with drill-down and alerting.

**Owner:** [fill in]
**Target users:** Internal marketing/growth team (multiple users, role-based access)
**Status:** Draft v1

---

## 2. Goals

| Goal | Success metric |
|---|---|
| Give a real-time read on account health | Dashboard load reflects data no more than 1–6 hrs stale |
| Answer "is this campaign making money?" without opening Ads Manager | ROAS + cost-per-result visible on every campaign row |
| Catch underperformers early | Auto-flag/alert within 24 hrs of a campaign crossing its threshold |
| Reduce time spent building manual reports | Exportable/scheduled reports replace manual spreadsheet pulls |

**Non-goals (v1):** Ad creation/editing (write-back to Facebook), budget auto-optimization/automated rules execution, multi-platform (Google/TikTok Ads) tracking — noted as future phase only.

---

## 3. Users & Roles

Internal team tool, multiple users, role-based access. **Note (per §4.1):** the live schema is agency-shaped — one `workspace` runs campaigns across many `client`s (observed: real-estate builders/properties) — so "internal team" means the agency's own team, and access scoping should be plannable per-client, not just per-ad-account.

- **Admin** — connects/manages ad accounts, manages users, sets org-wide thresholds, full access.
- **Marketer/Media Buyer** — views all campaigns, sets campaign-level profitability targets, manages alerts, exports reports. **Not** reliably identifiable from the `agent_name` tag on a campaign today — see §4.1 and §12 Q7 (reopened 2026-08-25).
- **Viewer/Stakeholder (e.g. management)** — read-only access to dashboards and reports, no config access. For an agency, this role also plausibly extends to the *client themselves* (e.g. the builder wanting to see their own campaign's performance) — confirm scope in §12 Q5.

---

## 4. Data Source & Integration

- **Source:** Facebook Marketing API (Graph API — Ads Insights endpoint) via a Facebook App with `ads_read` (and `ads_management` if any future write actions are needed) permissions.
- **Auth:** System User access token (long-lived) or per-user OAuth login with Business Manager account selection.
- **Sync model:** Scheduled pull (e.g. every 1–6 hours) of campaign, ad set, ad, and insights data; incremental sync using `time_range` + `updated_time` where possible; full backfill on first connect (default: last 90 days, configurable).
- **Multi-account support:** One connection can cover multiple ad accounts under the same Business Manager; each account tagged and filterable in the dashboard.
- **Rate limits:** Respect Meta's API rate limits (Business Use Case throttling) — batch requests, exponential backoff, sync queue rather than real-time-per-click calls.
- **Revenue data:** ROAS requires purchase/revenue values. Two options to support: (a) Meta Pixel/Conversions API purchase events already reported in Insights (`action_values`), or (b) manual/CSV revenue entry per campaign for teams not using Pixel. PRD assumes (a) as primary, (b) as fallback input.

### 4.1 Existing `campaigns` table (as-built — supersedes assumptions above)

A `campaigns` table already exists and is populated from a live sync (sample export: `campaigns_rows.csv`, 100+ rows). This is not a greenfield build — the data model below is real, in production, and the PRD must be read against it rather than against a from-scratch Meta integration.

**Observed columns:** `id, workspace_id, client_id, name, platform, objective, is_enabled, delivery_status, budget_type, budget_amount, budget_currency, start_date, end_date, bid_strategy, platform_metadata, created_at, updated_at, deleted_at, agent_name, external_id`

Key findings that change the PRD:

- **Multi-tenant by `workspace_id`, multi-client by `client_id`.** This is not a single internal team's dashboard over one Business Manager — it's an agency model: one `workspace` (agency) runs campaigns for many `client`s (e.g. real-estate builders/properties: "Lotus Yojangandha," "Kalpataru Sinhgad Road," "VTP Vibrance"). §3 Users & Roles and §8 Data Model need a `Client` entity between `Organization` and `Campaign` to match reality.
- **`platform` is already a column** (`facebook` today), and `objective` is already normalized to an internal enum (`leads`, `awareness`, `custom`, …) separate from Meta's raw value, which is preserved in `platform_metadata` (e.g. `{"raw_objective": "OUTCOME_LEADS"}`). Multi-platform (§2 non-goal for v1, §11 Phase 3) is therefore already accounted for at the schema level even though only Facebook is populated — no migration needed later.
- **Status is split across two fields**, not the single enum §6.2 assumed: `is_enabled` (boolean) and `delivery_status` (free-ish text — `active`/`paused` observed; Meta's fuller set — in review, disapproved, completed — should be expected but wasn't seen in this sample).
- **No ad-account identifier in this table.** There is no `fb_account_id`/`ad_account_id` column — account-level grouping (§6.1) must come from a separate table not covered by this export. **Open question added to §12.**
- **`external_id` is the Meta campaign ID**, `created_at`/`updated_at`/`deleted_at` give us sync bookkeeping and soft-delete for free — no separate `SyncRun`-style timestamp needed at the row level.
- **`agent_name` is a loose, sometimes-null tag** (e.g. "Kajal," "Danish," "Test Agent") — appears to identify a salesperson/media buyer associated with the campaign. It is *not* a reliable join key (no `agent_id`) and is frequently blank. **Update 2026-08-25:** broader sampling shows it's worse than "loose" — it frequently holds a property/project name instead of a person (`"SKYORA"`, `"VTP Earth One"`, `"Mantri Kishore Park"`, `"3BHK Prashant Sadan"`), with the real agent name (when present at all) elsewhere in the campaign `name` string with no fixed position. There's no reliable way to derive true agent identity from data collected today. See §12 Q7 (reopened).

**⚠️ Campaign `name` has no fixed format — do not parse it.** Names range from richly descriptive (`"3BHK Lotus Yojangandha - Kajal Leads Campaign May-26"`) to placeholder (`"Campaign 0"`, `"Campaign 4"`) to a raw Meta post caption (`"Post: \"Build Your Lakeside Dream Home and Own Your Own...\""`). Unit type (BHK), locality, agent, and month appear in inconsistent order, inconsistent presence, and free-text spelling. **Any feature that needs property/client/agent identity must resolve it through `client_id` (and a proper `agent_id` once one exists) — never by regex/NLP against `name`.** `name` is display-only. This affects:
- §7.2 Campaign List filtering/grouping by client or property — must filter on `client_id`, with `name` shown as-is
- §7.6 tagging/labeling — tags should attach to `Client`, not be inferred from `name` text
- Any future "auto-detect property from campaign name" idea — explicitly out of scope; not reliable with this data

---

## 5. Core Concept: "Is this campaign beneficial?"

Profitability is **configurable per campaign** (different campaign objectives need different rules), combining two rule types:

1. **ROAS-based** — `Revenue ÷ Spend`. Campaign flagged beneficial if ROAS ≥ target (e.g. 2.0x), unprofitable if below break-even ROAS.
2. **Cost-per-result vs target** — for campaigns without clean revenue data (lead gen, awareness), compare actual CPL/CPA/CPC against a user-set target ceiling.

Each campaign gets a **Health Status** derived from whichever rule applies to it:
- 🟢 **Profitable/On-target** — meets or beats target
- 🟡 **Watch** — within a configurable buffer (e.g. within 10–15% of target)
- 🔴 **Underperforming** — misses target for N consecutive days (configurable, default 3)
- ⚪ **Insufficient data** — too little spend/results to judge yet (configurable minimum spend threshold, e.g. don't judge under $50 spent)

Status is computed nightly and shown as a badge everywhere the campaign appears.

---

## 6. Parameters to Track

### 6.1 Account level
- Account ID, Account name, Currency, Timezone
- Account status (active/disabled/restricted)
- Total account spend (today / MTD / custom range)
- Account-level daily/lifetime budget cap (if set)
- Number of active / paused / archived campaigns

### 6.2 Campaign level
- Campaign ID (`external_id` = Meta campaign ID; internal `id` is the row's own UUID), Name (free text, display-only — see §4.1)
- `workspace_id` (agency/org) and `client_id` (property/builder/client) — the actual attribution keys, not `name`
- Objective — internal normalized enum (`leads` / `awareness` / `custom` / …), with Meta's raw objective preserved in `platform_metadata` (e.g. `raw_objective: "OUTCOME_LEADS"`)
- Platform (`facebook` today; column already supports future platforms per §11 Phase 3)
- Status — `is_enabled` (boolean) + `delivery_status` (active / paused / in review / disapproved / completed); both needed, they can disagree (e.g. enabled but delivery paused by Meta)
- Start date, End date (if scheduled)
- Budget type: Daily vs Lifetime; Budget amount; Budget currency (per-campaign, not assumed from account — observed data is multi-currency capable, INR seen throughout)
- Bid strategy (lowest cost, cost cap, bid cap, ROAS goal) — sparsely populated in practice, treat as optional
- `agent_name` — loose, often-null text tag for the associated salesperson/media buyer; not a join key until a proper `Agent`/`User` relation exists (§12)
- `platform_metadata` (jsonb) — catch-all for platform-specific raw fields not modeled explicitly; extend here before adding new columns
- `created_at` / `updated_at` / `deleted_at` — sync bookkeeping and soft-delete, already present
- Buying type (auction vs reach & frequency) — not yet observed in the live schema, add if needed
- Special ad category (if applicable — housing/credit/employment/political have restricted data) — relevant here since the observed clients are real-estate (housing category restrictions likely apply)

### 6.3 Ad Set level
- Ad Set ID, Name, Status
- Targeting summary: age range, gender, locations, interests/behaviors, custom audiences, lookalike audiences, exclusions
- Placements: Facebook Feed, Instagram Feed, Stories, Reels, Audience Network, Messenger, Marketplace (auto vs manual placement)
- Optimization goal (link clicks, conversions, landing page views, reach, impressions, etc.)
- Attribution setting (e.g. 7-day click / 1-day view)
- Budget & schedule (including day-parting if used)

### 6.4 Ad (creative) level
- Ad ID, Name, Status
- Creative type: single image, video, carousel, collection
- Ad copy / headline / CTA button
- Creative preview link/thumbnail
- Landing page URL

### 6.5 Performance metrics (all levels — account/campaign/ad set/ad)
**Reach & delivery**
- Impressions, Reach, Frequency

**Cost & spend**
- Amount spent, Budget utilization % (spend vs allocated budget), Estimated daily spend pace, Days remaining vs budget remaining (for lifetime budgets)

**Clicks & traffic**
- Clicks (all), Link clicks, CTR (all), CTR (link), Unique clicks, Unique CTR, CPC (all), CPC (link), CPM, Landing page views, Cost per landing page view

**Conversions & results**
- Results (per campaign objective), Cost per result
- Leads, Cost per lead
- Purchases, Purchase value, Cost per purchase, ROAS
- Add to cart, Initiate checkout, Cost per add-to-cart
- App installs, Cost per install
- Conversion rate (click-to-conversion)

**Engagement**
- Post engagement, Reactions, Comments, Shares, Saves, Page likes, Post engagement rate
- Video metrics: ThruPlays, 25%/50%/75%/95%/100% watch, Average watch time, Cost per ThruPlay

**Quality diagnostics**
- Quality ranking, Engagement rate ranking, Conversion rate ranking (relative to competing ads)
- Negative feedback rate (hides, reports)

### 6.6 Business/financial metrics (computed, not from Meta directly)
- Revenue (from Pixel/CAPI or manual entry)
- Gross profit, Net profit, Profit margin %
- ROAS (actual vs target), Break-even ROAS
- Customer Acquisition Cost (CAC)
- Customer Lifetime Value (LTV) — manual input or integration
- LTV : CAC ratio
- Blended vs paid-only ROAS (if tracking multiple channels later)

### 6.7 Time & trend dimensions
- Day-by-day performance trend (spend, results, ROAS over time)
- Day-of-week performance
- Hour-of-day performance (for day-parting decisions)
- Period-over-period comparison (this week vs last week, MoM)

### 6.8 Breakdown dimensions (for drill-down/filter)
- Placement (Feed/Stories/Reels/Audience Network/Messenger)
- Platform (Facebook/Instagram/Messenger/Audience Network)
- Device type (mobile/desktop) & platform (iOS/Android)
- Age & gender
- Region/country/DMA
- Delivery status reason (if underspending — e.g. "learning limited," "audience too narrow")

---

## 7. Dashboard Features

### 7.1 Overview / Home
- **Active campaigns counter** (with breakdown: active / paused / in review / ended)
- **Total spend** (today, this week, this month, custom range) with trend sparkline
- **Overall account ROAS** and blended cost-per-result
- **Health summary strip**: count of 🟢 Profitable / 🟡 Watch / 🔴 Underperforming / ⚪ Insufficient data
- **Top 5 performers** and **Bottom 5 performers** (by ROAS or by chosen KPI)
- **Implemented 2026-08-25 as "Needs a decision"**: a table of Watch/Underperforming campaigns sorted by worst cost-per-result overrun vs target, each row showing an explicit **Decision** ("Continue" / "Monitor closely" / "Pause & review" / "Needs more data") derived from health status — this is the direct answer to the core ask in §5, surfaced on the dashboard rather than left implicit in a status color
- **Budget pacing warnings** (campaigns projected to overspend or underspend lifetime budget)
- **Recent alerts feed**

### 7.2 Campaign List (table)
- Sortable/filterable table: Name, Status, Objective, Spend, Results, Cost/Result, ROAS, Health badge, Trend arrow (7-day)
- Filters: account, status, objective, date range, health status, campaign tag/label
- Bulk actions: export selected, tag/group campaigns (e.g. by client or product line)
- Saved views (e.g. "This week's active campaigns")

### 7.3 Campaign Detail (drill-down)
- Full metric breakdown (all params in §6.5–6.8) over selectable date range
- Chart: spend vs results vs ROAS over time
- Ad set and ad-level breakdown table nested underneath
- Placement/demographic/device breakdown charts
- Editable target thresholds (ROAS target, CPA/CPL ceiling) for this campaign
- Notes/comments field for team annotations

### 7.4 Alerts & Notifications
- Configurable rules: "Alert if ROAS < X for N consecutive days," "Alert if CPA > $Y," "Alert if daily spend spikes >Z% vs 7-day average," "Alert if budget will exhaust before end date," "Alert if campaign paused unexpectedly," "Alert if ad disapproved."
- Delivery channels: in-app notification center, email digest (daily/instant), optional Slack webhook.

### 7.5 Reporting
- Scheduled report emails (weekly/monthly PDF or CSV summary)
- On-demand export (CSV/XLSX) of any filtered table view
- Shareable read-only report link for stakeholders (Viewer role)

### 7.6 Settings / Admin
- Connected ad account management (add/remove/re-auth)
- User management & role assignment
- Global default thresholds (org-wide fallback if a campaign has no custom target)
- Sync schedule/frequency control
- Currency/timezone display preferences

---

## 8. Data Model (high-level entities)

Updated against the as-built `campaigns` table (§4.1) — the `Client` entity and `Campaign` fields below reflect the live schema, not a from-scratch assumption. `AdAccount` is kept provisionally: no ad-account identifier exists in the observed `campaigns` rows, so its shape here is a placeholder pending §12 Q6.

```
Workspace (was "Organization" — id, name, default_thresholds jsonb)
 └─ User (role: admin/marketer/viewer)
 └─ Client (id, workspace_id, name, property/locality metadata)
     └─ [AdAccount?] (fb_account_id, currency, timezone) — unconfirmed, see §12 Q6
     └─ Campaign (id, external_id [fb_campaign_id], workspace_id, client_id,
                   name [free text, display-only], platform, objective [normalized],
                   is_enabled, delivery_status, budget_type, budget_amount, budget_currency,
                   bid_strategy, agent_name, platform_metadata jsonb,
                   target_roas, target_cpa, created_at, updated_at, deleted_at)
         └─ AdSet (fb_adset_id, targeting_json, placements, optimization_goal)
             └─ Ad (fb_ad_id, creative_type, creative_preview_url)
         └─ InsightSnapshot (date, level, spend, impressions, clicks, results,
                              revenue, roas, cpa, breakdown_dimension, ...)
Alert (rule_type, threshold, campaign_id, status, triggered_at)
Report (type, recipients, schedule, last_sent_at)
```

`InsightSnapshot` is time-series, one row per day per entity per breakdown — this is what powers all trend charts and health calculations.

`target_roas` and `target_cpa` are not present in the observed `campaigns.csv` columns — they need to be added (or kept in a separate `CampaignTarget` table) since they're config the app itself owns, not data synced from Meta.

---

## 9. Non-Functional Requirements

- **Data freshness:** synced at least every 6 hours; manual "refresh now" available.
- **Performance:** dashboard overview loads in <2s for up to ~500 active campaigns.
- **Access control:** role-based, per-account access scoping (a Marketer can be restricted to specific ad accounts if needed).
- **Auditability:** log threshold changes and who made them.
- **Data retention:** keep daily granularity for 24 months minimum for YoY comparisons.
- **Reliability:** sync failures must alert Admin, not fail silently.

---

## 10. Tech Stack (confirmed 2026-08-25)

- **Frontend:** Next.js (App Router, TypeScript) + Recharts
- **Backend:** Next.js API routes for request/response logic
- **Database:** Supabase (Postgres) — project already provisioned, `campaigns` table already live
- **Hosting/Deploy:** **Netlify** (not Vercel) — repo `ABSCoder1981/FBAdsTrackerApp`, site `FBadstracker` under the `shaikhabbasanwar` Netlify team
- **Sync worker:** Netlify Scheduled Function (`netlify/functions/sync.ts`) calling the Meta Marketing API, authenticated via `CRON_SECRET`, with retry/backoff — replaces the Vercel Cron assumption in earlier drafts
- **Auth:** Supabase Auth with role-based middleware (admin/marketer/viewer)

**v1 scope decisions (resolved 2026-08-25, see §12):**
- Revenue/ROAS is **out of scope for v1** — health status uses CPL/CPA vs target only (§5, §6.6 revenue fields deferred)
- No `ad_accounts` table in Phase 1 — account-level grouping (§6.1) deferred
- `Client` table **is** built in Phase 0, ahead of Phase 1 features. `agent_id → users` was also built in Phase 0 but **reverted 2026-08-25** (migration 0003) once `agent_name` turned out to be unreliable enough that formalizing it fabricated agent identities — see §12 Q7 (reopened)
- Viewer role is internal-agency only for v1 — no client-facing portal

---

## 11. Phased Roadmap

**Phase 1 (MVP)**
- FB API connection (single Business Manager, multiple ad accounts)
- Campaign list + overview dashboard
- Core metrics (§6.2, 6.5 core subset, 6.6 ROAS/CPA)
- Health status badges (ROAS + CPA rules)
- Basic CSV export

**Phase 2**
- Ad set / ad-level drill-down + breakdowns (placement, demo, device)
- Alerting engine + email notifications
- Scheduled reports
- Role-based access, multi-user

**Phase 3**
- Slack notifications
- Budget pacing predictions
- LTV/CAC integration with external revenue source (CRM/Shopify/etc.)
- Multi-platform expansion (Google Ads, TikTok Ads) for blended view

---

## 12. Open Questions

1. Which Business Manager / ad account(s) connect first — confirm access is available? *(still open — using the existing `FACEBOOK_SYSTEM_USER_TOKEN`/`FACEBOOK_AD_ACCOUNT_ID` in `.env.local` as the first connection)*
2. ~~Where does revenue data come from for ROAS?~~ **Resolved 2026-08-25:** out of scope for v1. CPL/CPA vs target is the sole health rule; revenue/ROAS deferred to a later phase pending a CRM/sale-conversion data source.
3. ~~What are the default ROAS/CPA targets?~~ **Resolved 2026-08-25:** seed with reasonable placeholder defaults org-wide at launch (tunable per-`Client` once real data establishes typical CPL by locality/unit type); not blocking Phase 0/1 start.
4. Any compliance/data-residency requirement for storing ad account data? *(none specified — assuming none for v1)*
5. ~~Who are the initial Viewer-role stakeholders?~~ **Resolved 2026-08-25:** Viewer role is internal-agency only for v1; no client-facing portal.
6. ~~Where does account-level data live?~~ **Resolved 2026-08-25:** deferred — no `ad_accounts` table in Phase 1; revisit if/when account-level grouping becomes a real need.
7. **Reopened 2026-08-25.** Should `agent_name` be formalized into `agent_id → User`? Initially resolved "yes" and built in Phase 0, then reverted the same day: real data shows `agent_name` frequently holds a property/project name, not a salesperson (see §4.1 update) — formalizing it built a directory of fake agents. No reliable source for agent identity exists in the data collected today. Answering this needs either (a) a real intake process that captures agent assignment structurally going forward, or (b) accepting agent-level reporting is out of scope until one exists. The app currently shows no agent/salesperson attribution anywhere.
8. ~~Is there a canonical `Client`/property table?~~ **Resolved 2026-08-25:** building one in Phase 0 (`id, workspace_id, name, locality, unit_types[], builder_name`), backfilled from distinct `client_id`/name pairs in the existing `campaigns` table.
