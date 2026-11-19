import { describe, expect, it } from "vitest";
import { bucketStart, daysRange, fillSeries, marginPct, presetRange } from "@/lib/report";

describe("presetRange", () => {
  it("builds the common ranges from a given day", () => {
    expect(presetRange("today", "2026-11-18")).toEqual({ from: "2026-11-18", to: "2026-11-18" });
    expect(presetRange("7d", "2026-11-18")).toEqual({ from: "2026-11-12", to: "2026-11-18" });
    expect(presetRange("30d", "2026-11-18")).toEqual({ from: "2026-10-20", to: "2026-11-18" });
    expect(presetRange("month", "2026-11-18")).toEqual({ from: "2026-11-01", to: "2026-11-18" });
    expect(presetRange("last_month", "2026-11-18")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(presetRange("last_month", "2026-03-05")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });
});

describe("daysRange", () => {
  it("covers exactly n days ending today", () => {
    expect(daysRange(14, "2026-11-18")).toEqual({ from: "2026-11-05", to: "2026-11-18" });
    expect(daysRange(1, "2026-11-18")).toEqual({ from: "2026-11-18", to: "2026-11-18" });
  });
});

describe("bucketStart", () => {
  it("matches Postgres date_trunc (weeks start on Monday)", () => {
    expect(bucketStart("2026-11-18", "week")).toBe("2026-11-16"); // Wednesday -> Monday
    expect(bucketStart("2026-11-16", "week")).toBe("2026-11-16");
    expect(bucketStart("2026-11-22", "week")).toBe("2026-11-16"); // Sunday
    expect(bucketStart("2026-11-18", "month")).toBe("2026-11-01");
    expect(bucketStart("2026-11-18", "day")).toBe("2026-11-18");
  });
});

describe("fillSeries", () => {
  const point = (bucket: string, revenue: number) => ({
    bucket,
    sales: 1,
    revenue,
    profit: revenue / 2,
  });
  it("fills missing days with zeros and keeps real values", () => {
    const out = fillSeries([point("2026-11-02", 100)], "2026-11-01", "2026-11-04", "day");
    expect(out.map((p) => p.bucket)).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
    ]);
    expect(out.map((p) => p.revenue)).toEqual([0, 100, 0, 0]);
  });
  it("walks weeks and months", () => {
    expect(fillSeries([], "2026-11-03", "2026-11-25", "week").map((p) => p.bucket)).toEqual([
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
    ]);
    expect(fillSeries([], "2026-10-15", "2026-12-02", "month").map((p) => p.bucket)).toEqual([
      "2026-10-01",
      "2026-11-01",
      "2026-12-01",
    ]);
  });
});

describe("marginPct", () => {
  it("handles zero revenue", () => {
    expect(marginPct(25, 100)).toBe(25);
    expect(marginPct(10, 0)).toBe(0);
  });
});
