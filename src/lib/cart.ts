export type CartLine = {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  maxQuantity: number;
};

/** Money maths in cents-safe form: round to 2 decimals after every multiplication. */
export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function addToCart(
  lines: CartLine[],
  product: Omit<CartLine, "quantity">,
  quantity = 1,
): CartLine[] {
  if (product.maxQuantity <= 0) return lines;
  const existing = lines.find((line) => line.productId === product.productId);
  if (!existing)
    return [...lines, { ...product, quantity: Math.min(quantity, product.maxQuantity) }];
  return lines.map((line) =>
    line.productId === product.productId
      ? { ...line, quantity: Math.min(line.quantity + quantity, line.maxQuantity) }
      : line,
  );
}

/** Sets a line's quantity, clamped to available stock; a quantity of zero or less removes the line. */
export function setQuantity(lines: CartLine[], productId: string, quantity: number): CartLine[] {
  if (!Number.isFinite(quantity) || quantity <= 0)
    return lines.filter((line) => line.productId !== productId);
  return lines.map((line) =>
    line.productId === productId
      ? { ...line, quantity: Math.min(quantity, line.maxQuantity) }
      : line,
  );
}

export const lineTotal = (line: CartLine) => round2(line.unitPrice * line.quantity);
export const cartSubtotal = (lines: CartLine[]) =>
  round2(lines.reduce((sum, line) => sum + lineTotal(line), 0));

/** The discount can never push the total below zero. */
export const cartTotal = (lines: CartLine[], discount: number) =>
  round2(Math.max(0, cartSubtotal(lines) - Math.max(0, discount || 0)));
export const changeDue = (total: number, tendered: number) =>
  round2(Math.max(0, (tendered || 0) - total));
export const canComplete = (lines: CartLine[], discount: number, tendered: number) =>
  lines.length > 0 &&
  Math.max(0, discount || 0) <= cartSubtotal(lines) &&
  (tendered || 0) >= cartTotal(lines, discount);

/** Cash buttons: the exact total plus the next few common notes above it. */
export function quickCashOptions(total: number): number[] {
  const notes = [50, 100, 200, 500, 1000, 2000, 5000];
  const above = notes.filter((note) => note > total).slice(0, 3);
  return [...new Set([round2(total), ...above])].filter((amount) => amount > 0);
}
