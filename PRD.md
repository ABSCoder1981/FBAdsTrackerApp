# PRD: Facebook Ads Campaign Tracker Dashboard

## 1. Overview

**Problem:** The team currently reviews campaign performance manually inside Meta Ads Manager, with no centralized view of what's active, what's spending, and what's actually profitable. There's no automated way to flag underperforming campaigns before they burn budget.

**Solution:** An internal web dashboard that auto-syncs with the Facebook Marketing API and surfaces campaign counts, spend, performance, and profitability at a glance — with drill-down and alerting.

**Product direction (2026-08-25):** The target product is not a reporting dashboard but a **decision-support system** — a stakeholder should be able to look at a campaign and get a clear Scale / Continue / Optimize / Pause-Watch / Close recommendation with evidence, not just raw metrics. The full target architecture (Executive Dashboard → Campaign List → Campaign Detail → Analysis Modules → Deep Analysis → Decision Center) is specified in [`docs/CAMPAIGN_INTELLIGENCE_SPEC.md`](./docs/CAMPAIGN_INTELLIGENCE_SPEC.md). See §13 below for how that target maps onto what's actually buildable today. **Agent and Client are permanently out of scope** for this direction — both were found to be contaminated data (§4.1, §12 Q7/Q9) and are not part of the product going forward.

**Owner:** [fill in]
**Target users:** Internal marketing/growth team (multiple users, role-based access)
**Status:** Draft v2 — decision-support direction, phased against real data availability (§13)

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

Internal team tool, multiple users, role-based access. **Note (per §4.1):** the live schema is shaped like an agency running campaigns across many `client`s, and "internal team" means the agency's own team — but as of 2026-08-25, the actual `client_id`/`clients` data is unverified (mostly agent names and localities, not confirmed builders), so per-client access scoping is not yet buildable. Treat "agency/multi-client" as the schema's *shape*, not a confirmed fact about the data, until §12 Q9 resolves.

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

- **Multi-tenant by `workspace_id`, multi-client by `client_id`.** This is not a single internal team's dashboard over one Business Manager — it's an agency model: one `workspace` (agency) runs campaigns for many `client`s (e.g. real-estate builders/properties: "Lotus Yojangandha," "Kalpataru Sinhgad Road," "VTP Vibrance"). §3 Users & Roles and §8 Data Model need a `Client` entity between `Organization` and `Campaign` to match reality. **Update 2026-08-25 — this is now in doubt.** The `clients` table `client_id` joins against (pre-existing production table, created 2026-07-21, not something this project built) turns out to have the *same* contamination as `agent_name`: auditing all 86 rows, only a handful look like real builders (`Kolte Patil`, `Balaji Infinity`, `Ashiyana`, `Pride World City`) — the rest are salesperson names (`Rupali`, `Kajal`, `Hemant`, `Sachin Sir`), bare localities (`Baner`, `Warje`), or locality+agent combos (`Baner - Rupali`), including near-duplicate rows for typo/spacing variants (`Bavdhan - Rupali` vs `Bavdhan -Rupali`) and 5 separate rows all named `Acme Retail`. The `client_id` foreign key itself is real (not text-parsed), but what it resolves to is not reliably "the client" — it looks like whatever upstream process populated this table generated a row per distinct locality/agent phrase it saw, not per actual customer. **Client display was removed from the app entirely on 2026-08-25** (Campaigns list, Campaign Detail, and the standalone Clients page/nav item) pending a real answer — see §12 Q9 (new).
- **`platform` is already a column** (`facebook` today), and `objective` is already normalized to an internal enum (`leads`, `awareness`, `custom`, …) separate from Meta's raw value, which is preserved in `platform_metadata` (e.g. `{"raw_objective": "OUTCOME_LEADS"}`). Multi-platform (§2 non-goal for v1, §11 Phase 3) is therefore already accounted for at the schema level even though only Facebook is populated — no migration needed later.
- **Status is split across two fields**, not the single enum §6.2 assumed: `is_enabled` (boolean) and `delivery_status` (free-ish text — `active`/`paused` observed; Meta's fuller set — in review, disapproved, completed — should be expected but wasn't seen in this sample).
- **No ad-account identifier in this table.** There is no `fb_account_id`/`ad_account_id` column — account-level grouping (§6.1) must come from a separate table not covered by this export. **Open question added to §12.**
- **`external_id` is the Meta campaign ID**, `created_at`/`updated_at`/`deleted_at` give us sync bookkeeping and soft-delete for free — no separate `SyncRun`-style timestamp needed at the row level.
- **`agent_name` is a loose, sometimes-null tag** (e.g. "Kajal," "Danish," "Test Agent") — appears to identify a salesperson/media buyer associated with the campaign. It is *not* a reliable join key (no `agent_id`) and is frequently blank. **Update 2026-08-25:** broader sampling shows it's worse than "loose" — it frequently holds a property/project name instead of a person (`"SKYORA"`, `"VTP Earth One"`, `"Mantri Kishore Park"`, `"3BHK Prashant Sadan"`), with the real agent name (when present at all) elsewhere in the campaign `name` string with no fixed position. There's no reliable way to derive true agent identity from data collected today. See §12 Q7 (reopened).

**⚠️ Campaign `name` has no fixed format — do not parse it.** Names range from richly descriptive (`"3BHK Lotus Yojangandha - Kajal Leads Campaign May-26"`) to placeholder (`"Campaign 0"`, `"Campaign 4"`) to a raw Meta post caption (`"Post: \"Build Your Lakeside Dream Home and Own Your Own...\""`). Unit type (BHK), locality, agent, and month appear in inconsistent order, inconsistent presence, and free-text spelling. `name` is display-only. **Update 2026-08-25:** this section originally said to resolve identity through `client_id` "and a proper `agent_id` once one exists" instead of parsing `name` — that guidance is now half-wrong. `client_id` is *not* a safe substitute either (see the update above); both it and `agent_name` need a real fix, not just "use the foreign key instead of the text." This affects:
- §7.2 Campaign List filtering/grouping by client or property — **currently not offered**, Client display removed app-wide until §12 Q9 is resolved
- §7.6 tagging/labeling — tags should attach to a verified `Client`, not the current `clients` table
- Any future "auto-detect property from campaign name" idea — explicitly out of scope; not reliable with this data

---

## 5. Core Concept: "Is this campaign beneficial?"

**Superseded 2026-08-25** by the 5-state Decision taxonomy in [`docs/CAMPAIGN_INTELLIGENCE_SPEC.md`](./docs/CAMPAIGN_INTELLIGENCE_SPEC.md) §8 — kept here for history. The original 4-state Health Status (Profitable/Watch/Underperforming/Insufficient data, `src/lib/health.ts`) becomes the **Phase 1 rule-based implementation** of the new taxonomy (🟢 Scale, 🟢 Continue, 🟡 Optimize, 🟠 Watch, 🔴 Close) — same underlying CPL/CPA-vs-target logic, remapped into 5 labels with a sustained-trend requirement instead of a single-day miss. See spec §7–§8 for the exact rules and why the full multi-factor Health Score (Profitability/Lead Quality/ROAS/Creative weights) stays blocked until revenue and ad-set data exist.

Profitability is **configurable per campaign** (different campaign objectives need different rules), combining two rule types:

1. **ROAS-based** — `Revenue ÷ Spend`. Campaign flagged beneficial if ROAS ≥ target (e.g. 2.0x), unprofitable if below break-even ROAS. **Still deferred** — no revenue source exists (§12 Q2).
2. **Cost-per-result vs target** — for campaigns without clean revenue data (lead gen, awareness), compare actual CPL/CPA/CPC against a user-set target ceiling. **This is the only rule in production use today.**

Each campaign gets a **Decision** derived from whichever rule applies to it:
- 🟢 **Scale** — meaningfully beats target (not just meets it)
- 🟢 **Continue** — meets target
- 🟡 **Optimize** — within a configurable buffer of target (e.g. within 15%)
- 🟠 **Watch** — too little spend/days-synced to judge yet (configurable minimum threshold) — this state always wins over a confident-looking bad number (spec Principle 6)
- 🔴 **Close** — misses target beyond the buffer, sustained over the trend window (not a single bad day)

Status is computed on read (server-rendered per page load today; nightly precompute is a future optimization, not a correctness requirement) and shown as a badge everywhere the campaign appears.

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

Updated against the as-built `campaigns` table (§4.1) — the `Client` entity and `Campaign` fields below reflect the live schema, not a from-scratch assumption. `AdAccount` is kept provisionally: no ad-account identifier exists in the observed `campaigns` rows, so its shape here is a placeholder pending §12 Q6. **`Client` below is provisional too** — the table exists with this shape, but its row data is unverified as of 2026-08-25 (§4.1, §12 Q9); the app does not currently surface it.

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

**Superseded 2026-08-25 — see §13 for the current phased plan**, kept here for history. §13's phasing is driven by data-source dependency (spec §0) rather than feature groupings, since most of the original Phase 2/3 items turned out to need a data source that doesn't exist yet (CRM/revenue) rather than just more engineering time.

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
3. ~~What are the default ROAS/CPA targets?~~ **Resolved 2026-08-25, amended 2026-08-25:** seed with reasonable placeholder defaults org-wide at launch; not blocking Phase 0/1 start. (Originally said "tunable per-Client" — moot now that Client is permanently out of scope, Q9.)
4. Any compliance/data-residency requirement for storing ad account data? *(none specified — assuming none for v1)*
5. ~~Who are the initial Viewer-role stakeholders?~~ **Resolved 2026-08-25:** Viewer role is internal-agency only for v1; no client-facing portal.
6. ~~Where does account-level data live?~~ **Resolved 2026-08-25:** deferred — no `ad_accounts` table in Phase 1; revisit if/when account-level grouping becomes a real need.
7. **Closed 2026-08-25 (permanent, not just reopened).** Should `agent_name` be formalized into `agent_id → User`? Initially resolved "yes" and built in Phase 0, reverted the same day once real data showed `agent_name` frequently holds a property/project name, not a salesperson. **Decision: agent identity is permanently out of scope for this product's direction** (per the 2026-08-25 Campaign Intelligence pivot, `docs/CAMPAIGN_INTELLIGENCE_SPEC.md`) — not "revisit later," just not part of the design. No further agent-identity work should be proposed unless the user explicitly reopens it.
8. **Closed 2026-08-25 (permanent).** ~~Is there a canonical Client/property table?~~ The `clients` table's 86 rows turned out to be mostly agent names/localities, not builders. **Decision: Client is permanently out of scope**, same as Q7 — not a data-quality problem to eventually fix, a scope decision. `docs/CAMPAIGN_INTELLIGENCE_SPEC.md` is explicitly campaign-centric only.
9. **Closed 2026-08-25 (permanent), superseded by Q7/Q8's closure.** Client display was removed from Campaigns list, Campaign Detail, and nav on 2026-08-25 and stays removed as a design decision, not a temporary gap.
10. **New 2026-08-25.** Financial Analysis (`docs/CAMPAIGN_INTELLIGENCE_SPEC.md` §6F) needs a revenue source, and none exists. This is a **business decision**, not an engineering one: does the agency want to connect a CRM or sales-tracking system at all? Until answered, Revenue/Profit/ROAS/CAC/Sales stay out of every screen (Dashboard, Campaign List, Campaign Detail) rather than showing zeros or placeholders.

---

## 13. Campaign Intelligence Architecture (target direction, 2026-08-25)

**This is the current product direction**, replacing the original "reporting dashboard" framing (§1, §5, §11 above are kept for history and marked superseded where applicable). Full UX/screen spec: [`docs/CAMPAIGN_INTELLIGENCE_SPEC.md`](./docs/CAMPAIGN_INTELLIGENCE_SPEC.md). This section is the PRD-level summary — data availability, phasing, and the concrete Phase 1 changes.

### 13.1 What changed

The target system is a **decision-support tool**: every campaign resolves to one of five decisions (Scale / Continue / Optimize / Watch / Close) with visible evidence, reached by progressive drill-down (Summary → Evidence → Root Cause → Prediction → Decision) rather than a flat metrics table. Agent and Client are permanently excluded (§12 Q7–Q9) — this is campaign-centric by design, not by current limitation.

### 13.2 Data availability matrix

The single most important constraint on this direction: most of the target spec depends on data sources that don't exist yet. Full matrix in spec §0; summary:

| Have today | Don't have (blocks most of the spec) |
|---|---|
| Campaign metadata, daily spend/impressions/clicks/results (campaign-level only) | Ad set/ad-level data (Creative, Audience, Placement breakdowns) |
| CPL vs. target, 4-state health (→ becomes 5-state Decision, §13.4) | Geography breakdown |
| — | **Revenue, Profit, ROAS, CAC, Sales, Qualified Leads — no CRM connected (§12 Q10)** |
| — | Forecasting/prediction (no model, insufficient history) |
| — | Decision persistence/audit trail (no `decisions` table, no real auth) |

Consequence: Levels 1–3 of the spec (Executive Dashboard, Campaign List, Campaign Detail) ship in **reduced form** — real CPL/spend/results data, decision labels, no revenue/profit/ROAS anywhere. Levels 4–6 (Analysis Modules, Deep Analysis, Decision Center) are documented but not built.

### 13.3 Revised phased roadmap

Supersedes §11. Phases are ordered by data dependency, not feature area:

**Phase 1 (current — in progress)**
- Reshape Dashboard/Campaign List/Campaign Detail per spec §3–§5 (CPL/CPA-only, no revenue cards)
- Remap the 4-state health system to the 5-state Decision taxonomy (§13.4)
- Data Confidence gating (days-synced + min-spend) — real today, ship it
- Mini funnel (Impressions → Clicks → Leads) on Campaign Detail — the one funnel slice that's fully real today

**Phase 2 (needs: more sync history + new Meta API calls, no new external systems)**
- Ad set/ad-level Meta Insights sync → unblocks Creative, Audience, Placement, Geography modules (spec §6B–6E)
- Anomaly detection, once ≥14 consecutive synced days exist per campaign (spec §9)
- Alerting engine + scheduled reports (from original §11 Phase 2, unaffected by this pivot)

**Phase 3 (needs: new external systems + real auth)**
- CRM/revenue integration — **business decision required first** (§12 Q10), not just engineering
- Real authentication/`users` (current `users` table is empty since the agent-formalization revert) → unblocks Decision Center + Decision History (spec §10)
- Full Financial Analysis module (spec §6F), Health Score's profitability/ROAS/lead-quality factors (spec §7)

**Phase 4 (needs: Phase 3 data + enough history to model against)**
- Forecasting/Prediction module (spec §6G, §11)
- Full multi-factor Health Score (spec §7)
- Root-cause engine (spec §8's `poor_landing_page_conversion`/`creative_fatigue`/etc. reason codes)
- Budget Optimizer

**Phase 5**
- Prediction Accuracy dashboard (spec §11) — only meaningful once Phase 4 forecasts have run for ≥1 full comparison period

### 13.4 Decision taxonomy — Phase 1 implementation

Replaces `HealthStatus` (`profitable`/`watch`/`underperforming`/`insufficient_data` in `src/lib/health.ts`) with a 5-state `Decision` type. Mapping:

| Old `HealthStatus` | New `Decision` | Rule change |
|---|---|---|
| `profitable` | `scale` if `cost_per_result ≤ target × 0.8`, else `continue` | Split one state into two by margin |
| `watch` | `optimize` | Rename only |
| `underperforming` | `close` | Rename, **add** sustained-trend requirement (miss target over the trend window, not a single day) |
| `insufficient_data` | `watch` | Rename only — note the label collision with old `watch`; this is intentional per spec §8's table, source of confusion to flag in code review |

Implementation note for whoever picks this up: `computeHealthStatus` in `src/lib/health.ts` and `DECISION_COPY` need to change together; every call site (`src/app/page.tsx`, `src/components/campaigns/CampaignsExplorer.tsx`, `src/app/campaigns/[id]/page.tsx`, `src/components/HealthBadge.tsx`) currently imports the 4-state type and will need updating. Not done as part of this PRD update — this is a scoped follow-up task, not a docs-only change.

### 13.5 Navigation migration

Current nav (`src/components/shell/navItems.ts`): Dashboard, Campaigns, Analytics, Spend, Reports.
Target nav (spec §2): Dashboard, Campaigns (with Scale/Continue/Optimize/Watch/Close quick filters), Analysis, Intelligence, Optimization, Decisions, Reports, Settings.

| Current item | Target item | Phase it becomes real |
|---|---|---|
| Dashboard | Dashboard (Executive Overview) | 1 (reshaped) |
| Campaigns | Campaigns (+ decision quick filters) | 1 (extended) |
| Analytics | Analysis (Funnel/Creative/Audience/Placement/Geography) | 2 |
| Spend | folds into Analysis → Financials, or stays standalone until Financials exists | 3 for Financials; Spend as-is can stay a Phase 1 placeholder |
| Reports | Reports (Executive/Campaign) | 1–2, mostly buildable now |
| — | Intelligence (Prediction/Alerts/Anomalies/Benchmarks) | 2 (Alerts/Anomalies) / 4 (Prediction) |
| — | Decisions (Queue/History) | 3 |
| — | Optimization (Budget Optimizer) | 4/5 |

Do not add nav items for Phase 2+ sections until they have real content — an empty "Analysis" tab is worse than not having the tab (spec Principle 8).
