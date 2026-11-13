export function formatKes(value: number) {
  return `KES ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

export function formatQuantity(value: number) {
  return Number(value).toLocaleString("en-KE", { maximumFractionDigits: 3 });
}

export type StockState = "out" | "low" | "ok";

export function stockState(quantity: number, threshold: number): StockState {
  if (quantity <= 0) return "out";
  if (quantity <= threshold) return "low";
  return "ok";
}
