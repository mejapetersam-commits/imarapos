import { lazy, Suspense } from "react";
import type { Granularity, SeriesPoint } from "@/lib/report";

// The chart library is large, so it is only downloaded when a chart is actually shown.
const Chart = lazy(() => import("./TrendChartImpl").then((m) => ({ default: m.TrendChartImpl })));

type Props = {
  data: SeriesPoint[];
  granularity: Granularity;
  showProfit?: boolean;
  height?: number;
};

export function TrendChart(props: Props) {
  return (
    <Suspense
      fallback={
        <div
          style={{ height: props.height ?? 260 }}
          className="animate-pulse rounded-xl bg-muted/40"
        />
      }
    >
      <Chart {...props} />
    </Suspense>
  );
}
