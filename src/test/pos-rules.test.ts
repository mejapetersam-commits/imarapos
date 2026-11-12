import { describe, expect, it } from "vitest";
import { isValidNewProduct, isValidStockAdjustment } from "@/lib/pos-rules";

const base = {
  name: "Sugar 1kg",
  sku: "SKU-1",
  cost_price: 100,
  selling_price: 130,
  low_stock_threshold: 5,
  initial_stock: 20,
};

describe("isValidNewProduct", () => {
  it("accepts a complete product", () => expect(isValidNewProduct(base)).toBe(true));
  it("rejects blank name or SKU", () => {
    expect(isValidNewProduct({ ...base, name: "  " })).toBe(false);
    expect(isValidNewProduct({ ...base, sku: "" })).toBe(false);
  });
  it("rejects negative or non-finite numbers", () => {
    expect(isValidNewProduct({ ...base, cost_price: -1 })).toBe(false);
    expect(isValidNewProduct({ ...base, initial_stock: Number.NaN })).toBe(false);
  });
});

describe("isValidStockAdjustment", () => {
  it("allows adds and removals within stock", () => {
    expect(isValidStockAdjustment(10, 5)).toBe(true);
    expect(isValidStockAdjustment(10, -10)).toBe(true);
  });
  it("blocks zero and below-zero results", () => {
    expect(isValidStockAdjustment(10, 0)).toBe(false);
    expect(isValidStockAdjustment(10, -11)).toBe(false);
  });
});
