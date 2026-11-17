import { describe, expect, it } from "vitest";
import {
  addToCart,
  canComplete,
  cartSubtotal,
  cartTotal,
  changeDue,
  quickCashOptions,
  round2,
  setQuantity,
  type CartLine,
} from "@/lib/cart";

const sugar = { productId: "p1", name: "Sugar", sku: "S1", unitPrice: 130, maxQuantity: 3 };
const rice = { productId: "p2", name: "Rice", sku: "R1", unitPrice: 260.5, maxQuantity: 10 };

describe("cart", () => {
  it("merges repeated scans and stops at available stock", () => {
    let lines: CartLine[] = [];
    for (let i = 0; i < 5; i++) lines = addToCart(lines, sugar);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(3);
  });
  it("does not add out-of-stock products", () => {
    expect(addToCart([], { ...sugar, maxQuantity: 0 })).toEqual([]);
  });
  it("clamps quantities and removes a line at zero", () => {
    const lines = addToCart([], sugar);
    expect(setQuantity(lines, "p1", 99)[0]?.quantity).toBe(3);
    expect(setQuantity(lines, "p1", 0)).toEqual([]);
    expect(setQuantity(lines, "p1", Number.NaN)).toEqual([]);
  });
  it("totals without floating point drift", () => {
    const lines = addToCart(addToCart([], rice, 3), sugar, 1);
    expect(cartSubtotal(lines)).toBe(round2(260.5 * 3 + 130));
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
  it("never lets a discount push the total below zero", () => {
    const lines = addToCart([], sugar, 1);
    expect(cartTotal(lines, 50)).toBe(80);
    expect(cartTotal(lines, 9999)).toBe(0);
    expect(cartTotal(lines, -20)).toBe(130);
  });
  it("only completes with items, a valid discount and enough cash", () => {
    const lines = addToCart([], sugar, 2);
    expect(canComplete([], 0, 1000)).toBe(false);
    expect(canComplete(lines, 0, 259)).toBe(false);
    expect(canComplete(lines, 0, 260)).toBe(true);
    expect(canComplete(lines, 300, 0)).toBe(false);
  });
  it("calculates change and quick cash buttons", () => {
    expect(changeDue(260, 500)).toBe(240);
    expect(changeDue(260, 100)).toBe(0);
    expect(quickCashOptions(260)).toEqual([260, 500, 1000, 2000]);
    expect(quickCashOptions(0)).toEqual([50, 100, 200]);
  });
});
