"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface AgentRow {
  id: string;
  displayName: string;
  role: string;
  totalCampaigns: number;
  activeCampaigns: number;
}

const PAGE_SIZE = 25;

export function AgentsTable({ rows }: { rows: AgentRow[] }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginated = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border border-border rounded-[var(--radius-lg)] bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-foreground-muted border-b border-border">
              <th className="py-2.5 px-4 font-medium">Agent</th>
              <th className="py-2.5 px-4 font-medium">Role</th>
              <th className="py-2.5 px-4 font-medium">Campaigns</th>
              <th className="py-2.5 px-4 font-medium">Active</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                <td className="py-2.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-surface-muted flex items-center justify-center text-xs font-medium shrink-0">
                      {a.displayName[0]?.toUpperCase()}
                    </div>
                    <div className="font-medium">{a.displayName}</div>
                  </div>
                </td>
                <td className="py-2.5 px-4 text-foreground-muted capitalize">{a.role}</td>
                <td className="py-2.5 px-4">{a.totalCampaigns}</td>
                <td className="py-2.5 px-4">{a.activeCampaigns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground-muted">
          Page {currentPage} of {pageCount}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft size={14} />
            Prev
          </Button>
          <Button variant="secondary" size="sm" disabled={currentPage >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Next
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
