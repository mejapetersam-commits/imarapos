import type { StockInsight } from "./stock-insights";

export type PoLine = { productId: string; quantity: number; unitCost: number };
export type PoStatus = "draft" | "ordered" | "received" | "cancelled";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const poTotal = (lines: PoLine[]) =>
  round2(lines.reduce((sum, l) => sum + round2(l.quantity * l.unitCost), 0));

/** An order can only be saved with at least one line, positive quantities and no repeated product. */
export function validatePoLines(lines: PoLine[]): string | null {
  if (lines.length === 0) return "Add at least one product to the order.";
  if (new Set(lines.map((l) => l.productId)).size !== lines.length)
    return "Each product can only appear once.";
  if (lines.some((l) => !(l.quantity > 0))) return "Quantities must be greater than zero.";
  if (lines.some((l) => !(l.unitCost >= 0))) return "Unit costs cannot be negative.";
  return null;
}

/** Restock suggestions for one supplier, as ready-to-edit order lines (cost = the product's current cost). */
export function suggestedLines(
  supplierId: string,
  insights: (StockInsight & { supplier_id: string | null })[],
): PoLine[] {
  return insights
    .filter((r) => r.reorder && r.supplier_id === supplierId)
    .sort(
      (a, b) =>
        "out low soon".indexOf(a.reorder!.urgency) - "out low soon".indexOf(b.reorder!.urgency),
    )
    .map((r) => ({ productId: r.id, quantity: r.reorder!.suggested_qty, unitCost: r.cost_price }));
}

/** How much of each line is still to come, used to pre-fill the receive form. */
export const outstanding = (item: { quantity: number; received_quantity: number }) =>
  Math.max(0, round2(item.quantity - item.received_quantity));

export const poProgress = (ordered: number, received: number) =>
  ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0;

export function poMessage(o: {
  business: string;
  poNumber: string;
  supplier: string;
  expected: string | null;
  notes: string | null;
  items: { name: string; quantity: number; unit_cost: number }[];
  total: number;
}): string {
  const kes = (n: number) => `KES ${n.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
  const lines = o.items.map(
    (i) =>
      `- ${i.quantity} x ${i.name} @ ${kes(i.unit_cost)} = ${kes(round2(i.quantity * i.unit_cost))}`,
  );
  return [
    `Purchase order ${o.poNumber} from ${o.business}`,
    `To: ${o.supplier}`,
    o.expected ? `Needed by: ${o.expected}` : "",
    "",
    ...lines,
    "",
    `Total: ${kes(o.total)}`,
    o.notes ? `Note: ${o.notes}` : "",
    "",
    "Please confirm availability and delivery. Thank you.",
  ]
    .filter((line, i, all) => line !== "" || (all[i - 1] !== "" && i !== 0))
    .join("\n");
}
