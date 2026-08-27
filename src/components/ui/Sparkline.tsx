"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { TileTone } from "./KpiCard";

const SPARKLINE_STROKE: Record<TileTone, string> = {
  blue: "#2563eb",
  green: "#16a34a",
  purple: "#7c3aed",
  orange: "#ea580c",
  gray: "#6b7280",
  red: "#dc2626",
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
