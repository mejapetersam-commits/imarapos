import { describe, expect, it } from "vitest";
import { toWhatsAppNumber, reminderMessage } from "@/lib/phone";
import { addToCart, canComplete, cashDue, changeDue } from "@/lib/cart";

describe("toWhatsAppNumber", () => {
  it("normalises common Kenyan formats", () => {
    expect(toWhatsAppNumber("0712 345 678")).toBe("254712345678");
    expect(toWhatsAppNumber("+254 712-345-678")).toBe("254712345678");
    expect(toWhatsAppNumber("712345678")).toBe("254712345678");
    expect(toWhatsAppNumber("0112345678")).toBe("254112345678");
  });
  it("rejects numbers it cannot trust", () => {
    expect(toWhatsAppNumber("")).toBeNull();
    expect(toWhatsAppNumber(null)).toBeNull();
    expect(toWhatsAppNumber("12345")).toBeNull();
    expect(toWhatsAppNumber("0212345678")).toBeNull();
  });
});

describe("reminderMessage", () => {
  it("mentions the overdue part only when there is one", () => {
    expect(
      reminderMessage({ customer: "Njeri", business: "FDK", owed: 500, overdue: 0 }),
    ).not.toContain("overdue");
    expect(
      reminderMessage({ customer: "Njeri", business: "FDK", owed: 500, overdue: 200 }),
    ).toContain("KES 200 is overdue");
  });
});

describe("credit at checkout", () => {
  const lines = addToCart(
    [],
    { productId: "p", name: "Sugar", sku: "S", unitPrice: 100, maxQuantity: 50 },
    3,
  );
  it("only needs cash for the part not on credit", () => {
    expect(cashDue(300, 200)).toBe(100);
    expect(cashDue(300, 999)).toBe(0);
    expect(changeDue(300, 150, 200)).toBe(50);
  });
  it("allows a full credit sale with no cash", () => {
    expect(canComplete(lines, 0, 0, 300)).toBe(true);
  });
  it("blocks credit above the total and short cash", () => {
    expect(canComplete(lines, 0, 0, 301)).toBe(false);
    expect(canComplete(lines, 0, 50, 200)).toBe(false);
    expect(canComplete(lines, 0, 100, 200)).toBe(true);
  });
});
