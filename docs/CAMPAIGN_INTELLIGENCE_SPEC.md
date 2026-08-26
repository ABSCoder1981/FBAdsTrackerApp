# Campaign Intelligence & Decision Dashboard — UX/Architecture Specification

**Status:** Target vision, added 2026-08-25. This is a north-star specification, not a description of the current build. See §0 for what exists today vs. what this document specifies, and `PRD.md` §13 for the phased path from one to the other. Written to be handed to a coding agent one phase at a time — do not attempt to build this document in one pass.

**Scope note (per 2026-08-25 decision):** Agent and Client are permanently out of scope for this architecture. Both `campaigns.agent_name` and the `clients` table were found to be contaminated data (see `PRD.md` §4.1, §12 Q7/Q9) — this spec is deliberately campaign-centric only. If a verified client/agent data source is found later, it re-enters as a filter dimension, not a redesign driver.

---

## 0. Reality check — what this spec assumes vs. what exists

Every module below is tagged with a status. Read this table before estimating any phase:

| Data this spec needs | Exists today? | Notes |
|---|---|---|
| Campaign metadata (name, objective, status, budget) | ✅ Yes | Live `campaigns` table |
| Daily spend, impressions, clicks, results, cost/result | ✅ Yes | `insight_snapshots`, synced from Meta Insights API (campaign level only) |
| CPL vs. target, basic health/decision label | ✅ Yes | Current 4-state health system (`src/lib/health.ts`) |
| Ad-level breakdown (Creative) | ✅ Shipped 2026-08-25, reduced form | `level=ad` sync + minimal `ads` table (name only, no creative format/thumbnail); thin data for this account (4/20 campaigns have >1 ad) but real, see §6B |
| Ad-set-level breakdown (Audience) | ⚠️ Tested, not useful | Every campaign has exactly 1 ad set — nothing to compare, see §6C |
| Placement breakdown | ✅ Shipped 2026-08-25 | Campaign-level `breakdowns=publisher_platform,platform_position` — no ad-set sync needed, see §6D |
| Geography breakdown | ⚠️ Tested, not useful | `breakdowns=country/region` works, but every campaign returns `IN`/`Maharashtra` — no differentiation to build a view around (§6E) |
| Landing page views, funnel stages beyond "results" | ❌ No | Meta only gives us `actions` (leads/clicks); no landing-page or CRM funnel data |
| Qualified Leads, Opportunities, Sales, Revenue | ❌ No | **No CRM or sales pipeline is connected.** This is the single biggest gap — most of §6F (Financials) and the funnel's bottom half depend on it |
| Meta-attributed vs. CRM-confirmed vs. Finance-confirmed revenue | ❌ No | Same — no revenue source exists at all yet (PRD §12 Q2: deferred) |
| Forecasting (spend/leads/ROAS/profit projections) | ❌ No | No model exists; would need enough historical daily data to fit *any* forecast, which doesn't exist yet (sync only started 2026-08-25) |
| Confidence scoring, Data Confidence Score | ❌ No | Same — needs a real statistical basis, not a placeholder number |
| Root-cause engine | ❌ No | Needs the funnel/creative/audience data above to have anything to reason over |
| Decision Center (approve/override/comment) + Decision History | ❌ No | No decision-persistence table exists; UI-only "Decision" label exists today, nothing is stored |
| Prediction Accuracy dashboard | ❌ No | Meaningless until forecasting exists and has run for multiple periods |

**Bottom line:** Level 1 (Executive Dashboard) and Level 2 (Campaign List) are buildable now, reshaped around the existing CPL/CPA data. Level 3 (Campaign Detail) is buildable in a reduced form (performance + trend, no funnel/creative/audience). Levels 4–6 are almost entirely blocked on data sources that don't exist. Build order follows this dependency chain, not the numbered levels.

---

## 1. Design Philosophy

**Summary → Evidence → Root Cause → Prediction → Decision.** Every screen sits at one depth level; going deeper is always a click, never scrolling further down an already-dense page.

**UX Principles (non-negotiable, from the source brief):**
1. The Executive Dashboard stays simple — scannable in 30–60 seconds.
2. Every summary metric supports drill-down; nothing is a dead end.
3. Never force a stakeholder to read every metric to know if action is needed.
4. Every screen answers a subset of: *What happened? Why? What's next? What should we do?*
5. Never show a CLOSE recommendation without evidence attached.
6. Never classify an immature campaign (insufficient data) aggressively — insufficient data always wins over a confident-looking bad score.
7. Separate business outcomes (revenue, profit) from marketing metrics (CTR, CPC) — don't let a good CTR imply a good outcome.
8. The system explains *calculated* evidence. It never invents a number it can't trace back to a query.
9. Every recommendation is transparent and auditable — a stakeholder can always see why.

Principle 8 is a hard constraint on implementation: no screen in this spec may show a number that isn't computed from real synced data. Where a module depends on data that doesn't exist yet (§0), the correct behavior is an explicit "not available yet" state — never a fabricated placeholder that looks real.

---

## 2. Information Architecture (target nav)

```
Dashboard          Executive Overview                                    [Phase 1 — buildable now, reshaped]
Campaigns          All | Scale | Continue | Optimize | Watch | Close      [Phase 1 — buildable now, reshaped]
Analysis           Funnel · Creative · Audience · Placement · Geography · Financials
                                                                           [Phase 2/3 — blocked, see §0]
Intelligence       Prediction · Alerts · Anomalies · Benchmarks           [Phase 4 — blocked, see §0]
Optimization       Budget Optimizer                                      [Phase 4 — blocked]
Decisions          Decision Queue · Decision History                     [Phase 3 — needs decision table]
Reports            Executive Reports · Campaign Reports                  [Phase 2, mostly buildable]
Settings           Business Targets · KPI Thresholds · Scoring Rules · Users/Roles
                                                                           [Phase 2/3, partially buildable]
```

Current app nav (`src/components/shell/navItems.ts`) has: Dashboard, Campaigns, Analytics, Spend, Reports. This spec's nav supersedes it — see `PRD.md` §13.6 for the migration mapping (old nav item → new nav item → phase it changes).

---

## 3. Level 1 — Executive Dashboard

**Status: buildable now, in reduced form.** Revenue/Profit/ROAS/Sales KPI cards and the funnel/creative modules are not available (§0) — this level ships with Spend, CPL, Results, Active Campaigns, and Health/Decision distribution only, until revenue and ad-set data exist.

**Screen: `/` (Dashboard)**

| Field | Value |
|---|---|
| Purpose | Answer, in under a minute: how are campaigns doing overall, which are good/bad, what needs my decision right now |
| Primary user | Owner/stakeholder checking in, not analyzing |
| Top nav | Date range picker, account filter (single account today — becomes real once §12 Q6 ad-accounts exist), objective filter |
| Filters | Date range (7/14/30/custom), objective |

**KPI cards (Phase 1 — real data only):**

| Card | Source | Buildable now? |
|---|---|---|
| Total Spend | `sum(insight_snapshots.spend)` | ✅ |
| Avg. CPL | `spend / results` where objective=leads | ✅ |
| Results (leads) | `sum(insight_snapshots.results)` | ✅ |
| Active Campaigns | `count(campaigns) where is_enabled` | ✅ |
| Campaigns needing attention | `count where decision in (Optimize, Watch, Close)` | ✅ |
| ~~Total Revenue~~ | — | ❌ no revenue source (§0) — omit card entirely, don't show ₹0 |
| ~~Net Profit~~ | — | ❌ same |
| ~~ROAS~~ | — | ❌ same |
| ~~Conversions (sales)~~ | — | ❌ same, distinct from "Results/leads" which we do have |

Each buildable card shows: current value, % change vs. previous period of equal length, up/down arrow. No card shows a comparison against a period with less synced data than itself (e.g. don't compare 30 days against a period where only 3 days were synced — show "insufficient history" instead).

**Decision summary strip** (5 cards: 🟢 Scale, 🟢 Continue, 🟡 Optimize, 🟠 Watch, 🔴 Close):
- Count of campaigns in each state — ✅ buildable, this is a relabeling of the existing 4-state health system into 5 states (see `PRD.md` §13.4 for the exact mapping).
- "Total spend associated", "Total revenue", "Total profit/loss" sub-lines from the original brief — spend ✅, revenue/profit ❌ (omit those two lines until revenue exists).

**Campaign Performance Overview table** — same table as Level 2, truncated to top ~8 rows sorted by urgency (Close first, then Watch, then Optimize), with a "View all campaigns →" link. Columns available today: Campaign, Status, Spend, Results, CPL, Health/Decision. Columns not available: Qualified Leads, Sales, Revenue, ROAS, Profit, Score (the 0-100 score needs the full weighted model, §7 — a placeholder score would violate Principle 8).

**Not built:** Prediction Summary donut (no forecast model — would be fabricating a confidence number), Top Performing Campaign card (depends on ROAS/profit ranking, no revenue), Alerts panel (needs the anomaly detection engine, §9).

**Spend vs Budget — shipped 2026-08-26** (was originally listed here as not built, then a user report caught that it was a real gap, not a deliberate decision — the data to build it honestly already existed). Rolls up each campaign's allocated budget (daily: `budget_amount × days synced`; lifetime: `budget_amount` as a cap) against actual spend, restricted to campaigns with a budget set and ≥1 synced day. Explicitly *not* the same thing as the reference mockup's account-level "Spend vs Budget" bar — there's no account-level budget cap in this schema (§12 Q6), so the card's copy says so rather than implying a number that doesn't exist.

**Empty state:** No campaigns synced yet → "Run a sync to populate this dashboard" + Sync Now button (already built).
**Loading state:** Skeleton KPI cards + skeleton table rows (already built via `Skeleton` component).
**Error state:** Supabase query failure → inline error banner, not a blank page.
**Responsive:** KPI cards go 2-column on mobile (already built), table becomes stacked cards on mobile (already built pattern from Campaigns list).

---

## 4. Level 2 — Campaign Listing

**Status: buildable now**, this is close to the existing `/campaigns` page — extend, don't rebuild.

**Screen: `/campaigns`**

Purpose: "Show me all campaigns and help me identify where to investigate."

| Column | Buildable now? |
|---|---|
| Campaign name, Objective, Status | ✅ |
| Start date, Days running | ✅ (`start_date` exists on campaigns, not currently displayed) |
| Budget, Spend | ✅ |
| Results (leads) | ✅ |
| CPL | ✅ |
| Health Score (0-100) | ⚠️ Phase 1 simplified version only — see §7. Full weighted model needs Creative/Audience data that doesn't exist |
| Trend (7-day direction) | ✅ once ≥7 days of `insight_snapshots` exist per campaign — show "insufficient history" until then |
| Decision (Scale/Continue/Optimize/Watch/Close) | ✅ simplified rule-based version, see §8 |
| Qualified Leads, Sales, Revenue, ROAS, CPA, Profit | ❌ all blocked on CRM/revenue (§0) |
| Prediction, Confidence | ❌ blocked on forecasting model (§0) |

Quick filter tabs: `All | Scale | Continue | Optimize | Watch | Close` — ✅ buildable, filters the existing table by the Phase 1 decision label.

Status color convention (applies everywhere in this spec):
- 🟢 Strong / Scale / Continue
- 🟡 Watch / Optimize
- 🟠 Risk / borderline Close
- 🔴 Critical / Close
- ⚪ Insufficient data (always overrides the above — Principle 6)

Row click → Campaign Detail (§5). Already built (`/campaigns/[id]`).

**Search/sort/filter:** already built (name search, status filter, health filter, pagination). Extend with: date range, objective filter (objective values already exist in data).

---

## 5. Level 3 — Campaign Detail Overview

**Status: buildable in reduced form.** The example header from the brief:

```
Mumbai Residential Leads
Status: CONTINUE          Health Score: 84/100   ← Phase 2+ (full model)
Prediction: 4.9x ROAS     Confidence: 88%         ← blocked, no revenue/forecast
Recommendation: Continue + Optimize
```

Phase 1 reduced header (what ships now):

```
Mumbai Residential Leads
Status: active            Decision: CONTINUE      ← rule-based, §8
Spend: ₹95,000            CPL: ₹76 (target ₹70)
```

**Performance Summary (Phase 1):** Spend, CPL, Results — ✅. Revenue, Profit, ROAS, CPA, Sales, Qualified Leads, Conversion Rate — ❌, omit.

**Trend Summary (Phase 1):** Spend trend, CPL trend — ✅ once enough daily history exists (already have the `insight_snapshots` table and a per-campaign daily table in the current build). CTR trend — ✅ (clicks/impressions both synced). Conversion trend, Revenue trend, ROAS trend, Profit trend — ❌.

Current/previous period, 7/14/30-day windows — ✅ buildable, just needs date-range math added to the existing per-campaign snapshot query.

**Decision Summary block** — ✅ simplified: shows the rule-based Decision (§8) with the specific reasons that produced it (e.g. "CPL is 8.6% above target for 5 of the last 7 synced days"). This is honest evidence from real thresholds, not a fabricated confidence score.

---

## 6. Level 4 — Analysis Modules

All six modules below are **blocked** on data sources that don't exist (§0). Documenting the target shape so the Phase 2/3 sync work has a concrete spec to build against — do not scaffold empty UI for these yet (Principle 8: an empty "Creative Analysis" tab with no data is worse than not having the tab).

### 6A. Funnel Analysis — blocked
Target: Impressions → Reach → Clicks → Landing Page Views → Leads → Qualified Leads → Opportunities → Sales → Revenue, each stage with volume/conversion %/drop-off %/cost/previous-period comparison, plus automatic bottleneck detection ("Major bottleneck: Lead → Qualified Lead, current 11%, target 25%, gap -14pp").
**Blocked by:** Landing Page Views isn't in Meta Insights at campaign level without pixel/CAPI setup (not configured). Qualified Lead/Opportunity/Sale don't exist without a CRM. **What's real today:** Impressions → Clicks → Leads is fully available now as a 3-stage mini-funnel — worth building as a standalone chart on Campaign Detail before the full 9-stage version, once Phase 2 prioritizes it.

### 6B. Creative Analysis — shipped 2026-08-25, reduced form
Shipped: `level=ad` Meta Insights sync + a minimal `ads` table (external_id, campaign_id, name — real synced Meta data, not fabricated). Campaign Detail gets a Creative table: spend/impressions/clicks/CTR/results/cost-per-result per ad, Best/Worst tags gated the same way as Placement (§6D). **Tested live before building:** only 4 of 20 campaigns in this account have more than one ad (max 2) — most campaigns render a single informative row, not a comparison. Real but thin value; worth having since it costs nothing for the 80% with one ad and helps the 20% with more.

**Not shipped, still blocked:** creative format/thumbnail/headline (needs `/act_.../ads` or `/adcreatives` calls, not wired up), and the Winner/Potential Winner/Stable/Fatigued/Poor Performer classification from the original brief — that needs creative *age* and *frequency* trends over time, which this account doesn't have enough history for yet regardless of the API work.

### 6C. Audience Analysis — tested 2026-08-25, not worth building
Tested `level=adset` live before writing any schema: **every single campaign in this account has exactly 1 ad set** (0 of 20 have more). Audience analysis is fundamentally a comparison *across* ad sets/targeting within a campaign — with always exactly one, there's nothing to compare, same failure mode as Geography (§6E). **Decision: not building this**, not a data-access blocker. Revisit only if the agency starts running multiple ad sets per campaign (e.g. to A/B test audiences) — the sync-side change would be a straightforward extension of the Creative/Placement pattern already in `src/lib/sync.ts` if that changes.

### 6D. Placement Analysis — shipped 2026-08-25, reduced form
Unlike 6B/6C, this needed no ad-set/ad-level sync — `breakdowns=publisher_platform,platform_position` works at campaign level, tested live against the real account and confirmed to have real differentiation (7 distinct placements per campaign: Facebook Feed/Reels/Stories/Marketplace/Search/Notifications, Instagram Feed — meaningfully different spend and CTR). Shipped on Campaign Detail as a Placement table: spend, impressions, clicks, CTR, results, cost/result per placement, sorted by spend, with Best/Worst tags gated by a scaled-down spend threshold (10% of `MIN_SPEND_FOR_JUDGEMENT`) so a placement with negligible spend and a lucky-looking CPL doesn't get flagged Best (same insufficient-data protection as the campaign-level Decision, spec Principle 6).

**Still reduced from the full spec:** no per-ad creative attribution within a placement (needs 6B's ad-level sync), no historical/previous-period comparison yet (only all-time-synced totals). Note for implementers: `insight_snapshots.level` now has three values in production (`campaign`, `placement`, and previously-tested-then-reverted `geo`) — any new query against this table must filter by `level` or it will double-count across breakdown types. This bit the initial Campaign Detail page (fixed same day, before shipping placement data) — see git history around 2026-08-25 if debugging a spend/results figure that looks doubled.

### 6E. Geography Analysis — tested 2026-08-25, not worth building
Not blocked by data access — `breakdowns=country` and `breakdowns=region` both work today, no new tables needed (reuses `insight_snapshots.level`/`breakdown_dimension`). Tested live against the real ad account: **every campaign returns `country=IN`, `region=Maharashtra`** — Meta's finest available geography breakdown for this market is state-level, and there's only one state. A "best/worst geography" view has nothing to differentiate on some real accounts. **Decision: not building this** — not a data-access blocker like the other 6B–6D modules, a data-shape one. Revisit only if the agency ever runs campaigns spanning multiple states; the sync-side implementation (tested, then reverted) is straightforward to re-add if that changes.

### 6F. Financial Analysis — blocked, hardest module
Needs a revenue source, full stop. The brief's three-way reconciliation (Meta-attributed vs. CRM-confirmed vs. Finance-confirmed) needs two systems that don't exist yet: a CRM/sales pipeline and a finance/accounting feed. This is not a Phase 2 task — it's a business decision (does the agency want to connect a CRM at all?) before it's an engineering task. Flagged as a standing open question — see `PRD.md` §12 Q10.

### 6G. Prediction — blocked
See §0. Needs weeks of consistent daily sync history before any forecast is statistically meaningful. Revisit once ≥30 days of continuous `insight_snapshots` exist per campaign, and only with a named forecasting approach (e.g. simple linear trend extrapolation to start — not a black-box model) so principle 8 holds.

---

## 7. Health Score (0–100)

**Status: Phase 1 ships a simplified 2-factor version; the full 8-factor model is blocked.**

Target model (from the brief, weights configurable):

| Factor | Weight | Buildable now? |
|---|---|---|
| Profitability | 30% | ❌ needs revenue |
| Conversion Efficiency | 20% | ⚠️ partial — click→lead rate is real, lead→sale isn't |
| Lead Quality | 15% | ❌ needs qualified-lead data |
| ROAS | 10% | ❌ needs revenue |
| Trend | 10% | ✅ CPL trend direction is real |
| Budget Efficiency | 5% | ✅ spend vs. budget pacing is real |
| Creative Efficiency | 5% | ❌ needs ad-level data |
| Forecast Confidence | 5% | ❌ needs forecasting |

**65% of the weighted model needs data that doesn't exist.** Shipping a "Health Score: 58/100" today would mean 65% of that number is either missing (silently reweighted, misleading) or fabricated (violates Principle 8). Recommendation: don't ship a numeric 0–100 score in Phase 1. Ship the existing 4-state health label (already built) relabeled as part of the Decision taxonomy (§8) instead, and introduce the numeric score only once ≥5 of the 8 factors are real.

**Data Confidence Score** (separate, from the brief) — ✅ **this one is buildable now** and should ship in Phase 1: it's a function of days-synced and total spend, not of the metrics being judged. A campaign with `spend < MIN_SPEND_FOR_JUDGEMENT` or `days_synced < 7` gets low confidence and forces `insufficient_data`/`WATCH`, regardless of how good its raw CPL looks — this already exists conceptually in `computeHealthStatus` and just needs the days-synced dimension added.

---

## 8. Decision Engine (Phase 1 rule-based version)

**Status: buildable now**, as an honest, transparent, threshold-based system — explicitly *not* the multi-factor engine from the brief (blocked on §0/§7). This section defines the actual Phase 1 rules.

Five states, replacing the current 4-state `HealthStatus`:

| State | Phase 1 rule (CPL/CPA-only) |
|---|---|
| 🟢 **Scale** | `cost_per_result ≤ target × 0.8` sustained over the trend window (meaningfully beating target, not just meeting it) |
| 🟢 **Continue** | `cost_per_result ≤ target` |
| 🟡 **Optimize** | `target < cost_per_result ≤ target × 1.15` (today's "watch" band) |
| 🟠 **Watch** | `spend < MIN_SPEND_FOR_JUDGEMENT` or `days_synced < 7` — insufficient data to judge (Principle 6: this always wins over a confident-looking bad number) |
| 🔴 **Close** | `cost_per_result > target × 1.15` sustained over the trend window |

This is a mechanical remap of the existing `computeHealthStatus` (`profitable`→Scale/Continue split by margin, `watch`→Optimize, `underperforming`→Close, `insufficient_data`→Watch) plus a sustained-trend requirement so a single bad day doesn't flip a campaign to Close. Implementation-ready — see `PRD.md` §13.4 for the exact function signature change.

**Reason codes shown per decision** (subset of the brief's list that's real today):
- `high_cpl` — cost per result above target
- `strong_cpl` — cost per result meaningfully below target
- `insufficient_data` — below minimum spend or days-synced threshold
- `declining_trend` / `improving_trend` — CPL direction over the last 7 synced days
- `budget_underspend` / `budget_overspend` — actual spend vs. daily/lifetime budget pacing

Not available yet: `poor_landing_page_conversion`, `poor_lead_quality`, `creative_fatigue`, `audience_saturation`, `tracking_anomaly` — all need data from blocked modules (§6).

---

## 9. Anomaly Detection — blocked

CPL spike / CTR collapse / spend spike detection is statistically real to build (z-score or rolling-average deviation over `insight_snapshots`) once there's enough daily history to establish a baseline — realistically 14+ consecutive synced days per campaign. Not buildable today (sync started 2026-08-25). Revisit as an early Phase 2/3 task since, unlike Financials, it needs no new data source — just more time.

---

## 10. Decision Center & Decision History — blocked

Needs a new `decisions` table (not yet designed) to persist: campaign_id, system_recommendation, stakeholder_decision, reason, comment, decision_maker, decided_at, system_score_at_decision. This is a real, scoped Phase 3 task once the Phase 1 rule-based Decision engine (§8) exists to recommend against. Schema sketch:

```sql
create table decisions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  system_recommendation text not null,      -- Scale/Continue/Optimize/Watch/Close
  system_reason_codes text[] not null,
  stakeholder_decision text not null,       -- Approve/Override/Pause/Close/etc.
  comment text,
  decided_by uuid references users(id),     -- NB: users table currently empty (agent formalization reverted) — needs real auth first
  decided_at timestamptz not null default now()
);
```

Blocked on: a real `users`/auth system (the current `users` table was purged along with the agent formalization revert — see `PRD.md` §12 Q7). Decision History as an audit trail needs to know *who* decided, which needs real login, which doesn't exist yet.

---

## 11. Prediction Accuracy Dashboard — blocked

Meaningless without forecasting (§6G) having run for at least one full comparison period. Not a Phase 2 or 3 concern — revisit only after §6G ships and has accumulated history.

---

## 12. Example data (illustrative only — not real synced numbers)

The brief asks for 3 example campaigns with recommendations. Shown here **strictly as a UI-shape reference for engineers building Level 1/2/3** — these numbers are not from the real database and must never be committed to seed data or shown in a demo as if real (Principle 8).

| Campaign | Spend | Results | CPL | Target CPL | Decision | Reason |
|---|---|---|---|---|---|---|
| Baner 2BHK Leads | ₹95,000 | 1,250 | ₹76 | ₹70 | 🟡 Optimize | CPL 8.6% above target, stable trend |
| Kharadi Leads | ₹42,000 | 600 | ₹70 | ₹70 | 🟢 Continue | CPL at target, improving 7-day trend |
| Warje Leads | ₹8,200 | 12 | ₹683 | ₹100 | 🟠 Watch | Below minimum spend threshold — insufficient data, not a real Close signal despite the raw CPL looking bad |

The third row is deliberately included to demonstrate Principle 6: a naive system would flag Warje as critically bad (CPL 6.8x target); the correct behavior is "insufficient data," because ₹8,200 total spend is nowhere near enough to judge.

---

## 13. Screen inventory summary

| Screen | Phase | Status |
|---|---|---|
| Executive Dashboard (`/`) | 1 | Exists, needs reshaping per §3 |
| Campaign List (`/campaigns`) | 1 | Exists, needs extension per §4 |
| Campaign Detail (`/campaigns/[id]`) | 1 | Exists, needs extension per §5 |
| Placement (Campaign Detail card) | 2 | Shipped 2026-08-25, reduced form (§6D) |
| Creative (Campaign Detail card) | 2 | Shipped 2026-08-25, reduced form (§6B) |
| Funnel (mini) | 1 | Shipped (§6A) |
| Audience tab | — | Not building — tested, every campaign has exactly 1 ad set (§6C) |
| Geography tab | — | Not building — tested, no differentiation in the real data (§6E) |
| Financials tab | 3+ | Not built — blocked on CRM/revenue, business decision needed first |
| Prediction tab | 4 | Not built — blocked on history + forecast model choice |
| Decision Center / Decision History | 3 | Not built — blocked on `decisions` table + real auth |
| Prediction Accuracy | 5 | Not built — blocked on §6G existing first |
| Alerts / Anomalies | 2/3 | Not built — blocked on baseline history (time, not new data) |
| Budget Optimizer | 5 | Not built — blocked on everything above |
