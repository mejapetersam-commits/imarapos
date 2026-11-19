import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { bucketLabel, type Granularity, type SeriesPoint } from "@/lib/report";
import { formatKes } from "@/lib/format";

type Props = {
  data: SeriesPoint[];
  granularity: Granularity;
  showProfit?: boolean;
  height?: number;
};

/** Revenue (and optionally profit) over time. Gaps in the period are shown as zero, not skipped. */
export function TrendChartImpl({ data, granularity, showProfit = true, height = 260 }: Props) {
  const rows = data.map((p) => ({ ...p, label: bucketLabel(p.bucket, granularity) }));
  const compact = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#047857" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#047857" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="prof" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} minTickGap={16} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={44}
            tickFormatter={compact}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatKes(value),
              name === "revenue" ? "Revenue" : "Gross profit",
            ]}
            labelClassName="font-medium"
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#047857"
            strokeWidth={2}
            fill="url(#rev)"
          />
          {showProfit && (
            <Area
              type="monotone"
              dataKey="profit"
              stroke="#0ea5e9"
              strokeWidth={2}
              fill="url(#prof)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
