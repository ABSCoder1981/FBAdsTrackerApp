"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { LineChart } from "lucide-react";

interface Point {
  date: string;
  spend: number;
  results: number;
}

export function SpendChart({ data }: { data: Point[] }) {
  // ResponsiveContainer measures its parent on mount; during SSR/hydration
  // the parent can still be 0×0 (e.g. before web fonts load and reflow the
  // page), and Recharts doesn't re-measure without a resize event — so the
  // chart silently rendered blank until something (a manual browser refresh,
  // or the layout-shifting "Synced N/N" text after a sync) triggered one.
  // Mounting only after the browser has already committed a layout pass
  // avoids the bad first measurement entirely.
  const [mounted, setMounted] = useState(false);
  // Deliberate client-only-mount flag, not state synchronized from an
  // external system — the lint rule's general case doesn't apply here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (data.length === 0) {
    return (
      <EmptyState
        icon={LineChart}
        title="No synced data yet"
        description="Run a sync to populate spend and results trends."
      />
    );
  }

  if (!mounted) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-line)" stopOpacity={0.18} />
              <stop offset="95%" stopColor="var(--chart-line)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--chart-tick)" }}
            axisLine={{ stroke: "var(--chart-grid)" }}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 11, fill: "var(--chart-tick)" }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--chart-grid)",
              background: "var(--surface)",
              color: "var(--foreground)",
              fontSize: 12,
            }}
            formatter={(value) => Number(value).toFixed(2)}
          />
          <Area
            type="monotone"
            dataKey="spend"
            stroke="var(--chart-line)"
            strokeWidth={2}
            fill="url(#spendFill)"
            name="Spend"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
