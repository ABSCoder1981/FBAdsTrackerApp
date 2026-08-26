"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

const DATE_RANGES = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
  { value: "all", label: "All" },
];

const OBJECTIVES = ["leads", "traffic", "engagement", "awareness", "custom", "sales"];

export function DashboardFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const days = searchParams.get("days") ?? "30";
  const objective = searchParams.get("objective") ?? "";

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="inline-flex items-center rounded-[var(--radius-sm)] border border-border bg-surface p-0.5">
        {DATE_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setParam("days", r.value)}
            className={`h-8 px-3 rounded-[calc(var(--radius-sm)-2px)] text-sm font-medium transition-colors ${
              days === r.value
                ? "bg-primary text-primary-foreground"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <select
        value={objective}
        onChange={(e) => setParam("objective", e.target.value)}
        className="h-9 px-3 rounded-[var(--radius-sm)] border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        aria-label="Objective"
      >
        <option value="">All objectives</option>
        {OBJECTIVES.map((o) => (
          <option key={o} value={o}>
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </option>
        ))}
      </select>

      {/* Only one ad account is connected today (PRD §12 Q6 — account-level
          grouping deferred) — a real label, not a dropdown pretending there's
          a choice to make. */}
      <span className="h-9 px-3 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface-muted text-sm text-foreground-muted">
        <Building2 size={14} />1 account
      </span>
    </div>
  );
}
