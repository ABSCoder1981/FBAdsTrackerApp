"use client";

import { useState, useTransition } from "react";
import { recordDecision, type DecisionRecord } from "@/lib/decisions";
import { DECISION_COPY, REASON_COPY, type ReasonCode } from "@/lib/health";
import { DecisionBadge } from "@/components/DecisionBadge";
import { Button } from "@/components/ui/Button";
import type { Decision } from "@/lib/types";

const DECISION_OPTIONS: Decision[] = ["scale", "continue", "optimize", "watch", "close"];

export function DecisionCenter({
  campaignId,
  systemRecommendation,
  systemReasonCodes,
  history,
}: {
  campaignId: string;
  systemRecommendation: Decision;
  systemReasonCodes: ReasonCode[];
  history: DecisionRecord[];
}) {
  const [override, setOverride] = useState<Decision>(systemRecommendation);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justRecorded, setJustRecorded] = useState<string | null>(null);

  function submit(stakeholderDecision: Decision) {
    setError(null);
    startTransition(async () => {
      try {
        await recordDecision({
          campaignId,
          systemRecommendation,
          systemReasonCodes,
          stakeholderDecision,
          comment,
        });
        setComment("");
        setJustRecorded(stakeholderDecision);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record decision");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground-muted">System recommendation</span>
        <DecisionBadge decision={systemRecommendation} showAction />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground-muted">Your decision</label>
        <select
          value={override}
          onChange={(e) => setOverride(e.target.value as Decision)}
          className="w-full h-9 px-3 rounded-[var(--radius-sm)] border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {DECISION_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {DECISION_COPY[d]}
              {d === systemRecommendation ? " (system recommendation)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground-muted">Reason / comment (optional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Why this decision, for the record..."
          className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {error && <p className="text-sm text-danger-fg">{error}</p>}
      {justRecorded && !isPending && (
        <p className="text-sm text-success-fg">Decision recorded: {DECISION_COPY[justRecorded as Decision]}</p>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" disabled={isPending} onClick={() => submit(override)}>
          {isPending ? "Recording…" : override === systemRecommendation ? "Approve" : "Record override"}
        </Button>
      </div>

      {history.length > 0 && (
        <div className="pt-4 border-t border-border space-y-3">
          <h4 className="text-xs font-medium text-foreground-muted">Decision history</h4>
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {history.map((h) => (
              <li key={h.id} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{DECISION_COPY[h.stakeholder_decision]}</span>
                  <span className="text-foreground-muted">{new Date(h.decided_at).toLocaleString()}</span>
                </div>
                <div className="text-foreground-muted">
                  {h.decided_by_email ?? "unknown"}
                  {h.system_recommendation !== h.stakeholder_decision &&
                    ` · overrode system rec. of ${DECISION_COPY[h.system_recommendation]}`}
                </div>
                {h.comment && <div className="mt-0.5">{h.comment}</div>}
                {h.system_reason_codes.length > 0 && (
                  <div className="text-foreground-muted mt-0.5">
                    Evidence at the time: {h.system_reason_codes.map((c) => REASON_COPY[c]).join("; ")}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
