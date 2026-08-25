"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Download, X, ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DecisionBadge } from "@/components/DecisionBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { REASON_COPY, type ReasonCode } from "@/lib/health";
import type { Decision } from "@/lib/types";

export interface CampaignRow {
  id: string;
  name: string;
  objective: string;
  isEnabled: boolean;
  deliveryStatus: string | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  budgetType: string | null;
  spend: number;
  costPerResult: number | null;
  decision: Decision;
  reasons: ReasonCode[];
}

const DECISION_FILTERS: Decision[] = ["scale", "continue", "optimize", "watch", "close"];
const PAGE_SIZE = 25;

export function CampaignsExplorer({ rows }: { rows: CampaignRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<Decision | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        if (!r.name.toLowerCase().includes(q)) return false;
      }
      if (statusFilter) {
        const status = (r.deliveryStatus ?? (r.isEnabled ? "active" : "paused")).toLowerCase();
        if (status !== statusFilter) return false;
      }
      if (decisionFilter && r.decision !== decisionFilter) return false;
      return true;
    });
  }, [rows, query, statusFilter, decisionFilter]);

  // Reset to page 1 whenever the filters change, without an effect (React's
  // "adjust state during render" pattern for derived-from-props resets).
  const filterKey = `${query}|${statusFilter}|${decisionFilter}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    if (page !== 1) setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasActiveFilters = Boolean(statusFilter || decisionFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns…"
            className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-sm)] border border-border bg-surface text-sm placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <FilterButton
            label="Status"
            value={statusFilter}
            options={["active", "paused", "in review", "disapproved"]}
            onChange={setStatusFilter}
          />
          <FilterButton
            label="Decision"
            value={decisionFilter}
            options={DECISION_FILTERS}
            onChange={(v) => setDecisionFilter(v as Decision | null)}
          />
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="sm:ml-auto"
          onClick={() => exportCsv(filtered)}
        >
          <Download size={14} />
          Export
        </Button>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {statusFilter && (
            <Chip label={`Status: ${statusFilter}`} onRemove={() => setStatusFilter(null)} />
          )}
          {decisionFilter && (
            <Chip label={`Decision: ${decisionFilter}`} onRemove={() => setDecisionFilter(null)} />
          )}
          <button
            onClick={() => {
              setStatusFilter(null);
              setDecisionFilter(null);
            }}
            className="text-xs text-foreground-muted hover:text-foreground underline"
          >
            Clear all
          </button>
        </div>
      )}

      <p className="text-xs text-foreground-muted">
        {filtered.length} of {rows.length} campaigns
      </p>

      {filtered.length === 0 ? (
        <EmptyState icon={Megaphone} title="No campaigns match" description="Try adjusting your search or filters." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto border border-border rounded-[var(--radius-lg)] bg-surface">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-xs text-foreground-muted border-b border-border">
                  <th className="py-2.5 px-4 font-medium">Campaign</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Budget</th>
                  <th className="py-2.5 px-4 font-medium">Spend</th>
                  <th className="py-2.5 px-4 font-medium">Cost/Result</th>
                  <th className="py-2.5 px-4 font-medium">Decision</th>
                  <th className="py-2.5 px-4 font-medium">Why</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                    <td className="py-2.5 px-4 max-w-xs">
                      <Link href={`/campaigns/${r.id}`} className="font-medium truncate hover:underline block">
                        {r.name}
                      </Link>
                      <div className="text-xs text-foreground-muted">{r.objective}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge isEnabled={r.isEnabled} deliveryStatus={r.deliveryStatus} />
                    </td>
                    <td className="py-2.5 px-4 text-foreground-muted">
                      {r.budgetAmount != null ? `${r.budgetCurrency ?? ""} ${r.budgetAmount} (${r.budgetType})` : "—"}
                    </td>
                    <td className="py-2.5 px-4">
                      {r.spend > 0 ? `${r.budgetCurrency ?? ""} ${r.spend.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2.5 px-4">{r.costPerResult != null ? r.costPerResult.toFixed(2) : "—"}</td>
                    <td className="py-2.5 px-4">
                      <DecisionBadge decision={r.decision} />
                    </td>
                    <td className="py-2.5 px-4 text-xs text-foreground-muted">
                      {r.reasons.map((code) => REASON_COPY[code]).join("; ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {paginated.map((r) => (
              <div key={r.id} className="border border-border rounded-[var(--radius-lg)] bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/campaigns/${r.id}`} className="font-medium text-sm hover:underline">
                    {r.name}
                  </Link>
                  <DecisionBadge decision={r.decision} />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge isEnabled={r.isEnabled} deliveryStatus={r.deliveryStatus} />
                  <span className="text-xs text-foreground-muted">{r.objective}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div>
                    <div className="text-foreground-muted">Spend</div>
                    <div className="font-medium">{r.spend > 0 ? `${r.budgetCurrency ?? ""} ${r.spend.toFixed(2)}` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-foreground-muted">Cost/Result</div>
                    <div className="font-medium">{r.costPerResult != null ? r.costPerResult.toFixed(2) : "—"}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border text-xs text-foreground-muted">
                  {r.reasons.map((code) => REASON_COPY[code]).join("; ")}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-foreground-muted">
              Page {currentPage} of {pageCount}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={14} />
                Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterButton({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="h-9 px-3 rounded-[var(--radius-sm)] border border-border bg-surface text-sm text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o.charAt(0).toUpperCase() + o.slice(1).replace("_", " ")}
        </option>
      ))}
    </select>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-surface-muted px-2.5 py-1 text-xs text-foreground">
      {label}
      <button onClick={onRemove} aria-label={`Remove ${label} filter`}>
        <X size={12} />
      </button>
    </span>
  );
}

function exportCsv(rows: CampaignRow[]) {
  const header = ["Campaign", "Status", "Objective", "Spend", "Cost/Result", "Decision", "Reasons"];
  const lines = rows.map((r) =>
    [
      r.name,
      r.deliveryStatus ?? (r.isEnabled ? "active" : "paused"),
      r.objective,
      r.spend.toFixed(2),
      r.costPerResult?.toFixed(2) ?? "",
      r.decision,
      r.reasons.map((code) => REASON_COPY[code]).join("; "),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
