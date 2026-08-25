"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { triggerSync } from "@/app/actions";

export function SyncButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-xs text-foreground-muted hidden sm:inline">{result}</span>}
      <Button
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            try {
              const r = await triggerSync();
              setResult(`Synced ${r.upserted}/${r.fetched}`);
            } catch {
              setResult("Sync failed");
            }
          })
        }
      >
        <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
        {isPending ? "Syncing…" : "Sync now"}
      </Button>
    </div>
  );
}
