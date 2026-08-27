"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { TileTone } from "./KpiCard";

// Reads the same tile tokens the icon tile itself uses, so a sparkline
// re-themes along with everything else instead of freezing to the default
// theme's hues.
const SPARKLINE_STROKE: Record<TileTone, string> = {
  blue: "var(--tile-blue-fg)",
  green: "var(--tile-green-fg)",
  purple: "var(--tile-purple-fg)",
  orange: "var(--tile-orange-fg)",
  gray: "var(--tile-gray-fg)",
  red: "var(--tile-red-fg)",
};

export function Sparkline({ data, tone }: { data: number[]; tone: TileTone }) {
  return (
    <div className="h-8 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.map((v) => ({ v }))}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={SPARKLINE_STROKE[tone]}
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
