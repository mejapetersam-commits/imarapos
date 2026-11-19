import { describe, expect, it } from "vitest";
import { analyseStock, stockTotals, type StockInput } from "@/lib/stock-insights";

const base = { sku: "S", cost_price: 50, selling_price: 80, low_stock_threshold: 5, age_days: 200 };
const item = (id: string, o: Partial<StockInput>): StockInput => ({
  id,
  name: id,
  quantity: 20,
  units_30: 0,
  units_90: 0,
  ...base,
  ...o,
});
const by = (rows: ReturnType<typeof analyseStock>, id: string) => rows.find((r) => r.id === id)!;

describe("analyseStock velocity", () => {
  it("flags dead stock only for old products with stock and no sales in 90 days", () => {
    const rows = analyseStock([
      item("dead", {}),
      item("empty", { quantity: 0 }),
      item("newbie", { age_days: 20 }),
    ]);
    expect(by(rows, "dead").velocity).toBe("dead");
    expect(by(rows, "empty").velocity).not.toBe("dead");
    expect(by(rows, "newbie").velocity).toBe("new");
  });
  it("calls an item slow when it sold in 90 days but not the last 30", () => {
    expect(by(analyseStock([item("a", { units_90: 4 })]), "a").velocity).toBe("slow");
  });
  it("marks the top fifth of sellers as fast once there are enough sellers", () => {
    const rows = analyseStock(
      [30, 10, 9, 8, 7, 6, 5, 4, 3, 2].map((u, i) =>
        item(`p${i}`, { units_30: u, units_90: u * 3 }),
      ),
    );
    expect(rows.filter((r) => r.velocity === "fast").map((r) => r.id)).toEqual(["p0", "p1"]);
  });
  it("does not label anything fast with too few sellers", () => {
    expect(
      analyseStock([item("a", { units_30: 50 }), item("b", { units_30: 1 })]).some(
        (r) => r.velocity === "fast",
      ),
    ).toBe(false);
  });
});

describe("analyseStock reorder", () => {
  it("recommends out-of-stock items that normally sell", () => {
    const r = by(analyseStock([item("a", { quantity: 0, units_30: 30, units_90: 80 })]), "a");
    expect(r.reorder?.urgency).toBe("out");
    expect(r.reorder?.suggested_qty).toBe(35);
  });
  it("recommends low stock up to 30 days of cover", () => {
    const r = by(analyseStock([item("a", { quantity: 3, units_30: 30 })]), "a");
    expect(r.reorder).toEqual({ urgency: "low", suggested_qty: 32 });
  });
  it("warns early when cover is under 14 days", () => {
    const r = by(analyseStock([item("a", { quantity: 10, units_30: 30 })]), "a");
    expect(r.days_of_cover).toBe(10);
    expect(r.reorder?.urgency).toBe("soon");
  });
  it("leaves healthy stock alone", () => {
    expect(by(analyseStock([item("a", { quantity: 100, units_30: 30 })]), "a").reorder).toBeNull();
  });
});

describe("stockTotals", () => {
  it("values stock at cost and retail and totals dead stock", () => {
    const totals = stockTotals(
      analyseStock([
        item("dead", { quantity: 10 }),
        item("live", { quantity: 5, units_30: 3, units_90: 9 }),
      ]),
    );
    expect(totals.cost).toBe(750);
    expect(totals.retail).toBe(1200);
    expect(totals.potentialProfit).toBe(450);
    expect(totals.deadCount).toBe(1);
    expect(totals.deadCost).toBe(500);
  });
});
