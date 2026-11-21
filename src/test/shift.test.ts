import { describe, expect, it } from "vitest";
import { cashVariance, expectedCash, shiftDuration, varianceInfo } from "@/lib/shift";

describe("expectedCash", () => {
  it("adds money in and subtracts money out", () => {
    expect(
      expectedCash({
        opening: 500,
        cash_sales: 400,
        credit_repayments: 150,
        pay_ins: 100,
        pay_outs: 80,
        cash_refunds: 100,
      }),
    ).toBe(970);
  });
  it("avoids floating point drift", () => {
    expect(
      expectedCash({
        opening: 0.1,
        cash_sales: 0.2,
        credit_repayments: 0,
        pay_ins: 0,
        pay_outs: 0,
        cash_refunds: 0,
      }),
    ).toBe(0.3);
  });
});

describe("variance", () => {
  it("is counted minus expected", () => {
    expect(cashVariance(1065, 1070)).toBe(-5);
    expect(cashVariance(1075.5, 1070)).toBe(5.5);
  });
  it("labels balanced, over and short", () => {
    expect(varianceInfo(0)).toEqual({ label: "Balanced", tone: "ok" });
    expect(varianceInfo(0.001).tone).toBe("ok");
    expect(varianceInfo(-5)).toEqual({ label: "Short by KES 5", tone: "short" });
    expect(varianceInfo(1250.5)).toEqual({ label: "Over by KES 1,250.5", tone: "over" });
    expect(varianceInfo(null).label).toBe("Not counted");
  });
});

describe("shiftDuration", () => {
  const open = "2026-11-18T06:00:00Z";
  it("formats minutes, hours and days", () => {
    expect(shiftDuration(open, "2026-11-18T06:45:00Z")).toBe("45m");
    expect(shiftDuration(open, "2026-11-18T09:12:00Z")).toBe("3h 12m");
    expect(shiftDuration(open, "2026-11-20T10:00:00Z")).toBe("2d 4h");
  });
  it("uses the given time for open shifts and never goes negative", () => {
    expect(shiftDuration(open, null, new Date("2026-11-18T07:30:00Z"))).toBe("1h 30m");
    expect(shiftDuration(open, null, new Date("2026-11-18T05:00:00Z"))).toBe("0m");
  });
});
