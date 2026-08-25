// docs/CAMPAIGN_INTELLIGENCE_SPEC.md §6A — the one funnel slice that's fully
// real today (Impressions -> Clicks -> Leads). The full 9-stage funnel needs
// landing-page and CRM data that doesn't exist yet.
export function MiniFunnel({
  impressions,
  clicks,
  results,
}: {
  impressions: number;
  clicks: number;
  results: number;
}) {
  const stages = [
    { label: "Impressions", value: impressions },
    { label: "Clicks", value: clicks },
    { label: "Leads", value: results },
  ];

  if (impressions === 0) {
    return <p className="text-sm text-foreground-muted">No synced data for this campaign yet.</p>;
  }

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const prev = i > 0 ? stages[i - 1].value : null;
        const conversionPct = prev && prev > 0 ? (stage.value / prev) * 100 : null;
        return (
          <div key={stage.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{stage.label}</span>
              <span className="text-foreground-muted">
                {stage.value.toLocaleString("en-IN")}
                {conversionPct != null && ` · ${conversionPct.toFixed(1)}% of ${stages[i - 1].label.toLowerCase()}`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-muted mt-1 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full"
                style={{ width: `${impressions > 0 ? (stage.value / impressions) * 100 : 0}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
