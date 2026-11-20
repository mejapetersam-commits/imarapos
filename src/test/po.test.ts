import { describe, expect, it } from "vitest";
import {
  outstanding,
  poMessage,
  poProgress,
  poTotal,
  suggestedLines,
  validatePoLines,
} from "@/lib/po";
import { analyseStock, type StockInput } from "@/lib/stock-insights";

const line = (productId: string, quantity: number, unitCost: number) => ({
  productId,
  quantity,
  unitCost,
});

describe("poTotal / validatePoLines", () => {
  it("totals without floating point drift", () => {
    expect(poTotal([line("a", 3, 0.1), line("b", 2, 0.2)])).toBe(0.7);
    expect(poTotal([line("a", 20, 130), line("b", 10, 210)])).toBe(4700);
  });
  it("rejects empty, duplicate, zero and negative lines", () => {
    expect(validatePoLines([])).toMatch(/at least one/);
    expect(validatePoLines([line("a", 1, 1), line("a", 2, 1)])).toMatch(/only appear once/);
    expect(validatePoLines([line("a", 0, 1)])).toMatch(/greater than zero/);
    expect(validatePoLines([line("a", 1, -1)])).toMatch(/negative/);
    expect(validatePoLines([line("a", 1, 0)])).toBeNull();
  });
});

describe("suggestedLines", () => {
  const stock = (id: string, supplier_id: string | null, o: Partial<StockInput>) => ({
    ...({
      id,
      name: id,
      sku: id,
      cost_price: 50,
      selling_price: 80,
      low_stock_threshold: 5,
      quantity: 20,
      units_30: 0,
      units_90: 0,
      age_days: 200,
      ...o,
    } as StockInput),
    supplier_id,
  });
  it("returns this supplier's restock items, most urgent first, at current cost", () => {
    const insights = analyseStock(
      [
        stock("low", "s1", { quantity: 3, units_30: 30 }),
        stock("out", "s1", { quantity: 0, units_30: 30, units_90: 80 }),
        stock("other", "s2", { quantity: 0, units_90: 10 }),
        stock("fine", "s1", { quantity: 100, units_30: 3 }),
        stock("nosup", null, { quantity: 0, units_90: 5 }),
      ].map((s) => s as never),
    ) as ReturnType<typeof analyseStock>;
    const withSupplier = insights.map((r, i) => ({
      ...r,
      supplier_id: ["s1", "s1", "s2", "s1", null][i] ?? null,
    }));
    const lines = suggestedLines("s1", withSupplier);
    expect(lines.map((l) => l.productId)).toEqual(["out", "low"]);
    expect(lines[0]).toMatchObject({ unitCost: 50 });
  });
});

describe("receiving helpers", () => {
  it("calculates what is still outstanding and progress", () => {
    expect(outstanding({ quantity: 20, received_quantity: 5 })).toBe(15);
    expect(outstanding({ quantity: 20, received_quantity: 25 })).toBe(0);
    expect(poProgress(20, 5)).toBe(25);
    expect(poProgress(0, 0)).toBe(0);
    expect(poProgress(10, 99)).toBe(100);
  });
});

describe("poMessage", () => {
  it("builds a readable supplier message", () => {
    const text = poMessage({
      business: "FDK",
      poNumber: "PO-0007",
      supplier: "Acme",
      expected: "2026-11-30",
      notes: "Deliver to shop",
      items: [{ name: "Sugar", quantity: 10, unit_cost: 120 }],
      total: 1200,
    });
    expect(text).toContain("Purchase order PO-0007 from FDK");
    expect(text).toContain("- 10 x Sugar @ KES 120 = KES 1,200");
    expect(text).toContain("Total: KES 1,200");
    expect(text).toContain("Needed by: 2026-11-30");
    expect(text).toContain("Note: Deliver to shop");
    expect(text).not.toMatch(/\n\n\n/);
  });
});
