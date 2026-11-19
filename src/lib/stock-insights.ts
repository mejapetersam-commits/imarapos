export type StockInput = {
  id: string;
  name: string;
  sku: string;
  cost_price: number;
  selling_price: number;
  low_stock_threshold: number;
  quantity: number;
  units_30: number;
  units_90: number;
  age_days: number;
};

export type Velocity = "fast" | "normal" | "slow" | "dead" | "new";
export type Urgency = "out" | "low" | "soon";

export type StockInsight = StockInput & {
  velocity: Velocity;
  daily_rate: number;
  days_of_cover: number | null;
  stock_cost: number;
  stock_retail: number;
  reorder: { urgency: Urgency; suggested_qty: number } | null;
};

export const TARGET_COVER_DAYS = 30;
export const SOON_COVER_DAYS = 14;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Classifies every product by how it sells and recommends what to reorder.
 * - dead: stock on hand, nothing sold in 90 days, and not a new product
 * - slow: sold in the last 90 days but not in the last 30
 * - fast: in the top fifth of sellers by 30-day units (needs at least 5 selling products to be meaningful)
 * - new: no sales yet but listed for under 90 days
 */
export function analyseStock(products: StockInput[]): StockInsight[] {
  const sellers = products
    .filter((p) => p.units_30 > 0)
    .map((p) => p.units_30)
    .sort((a, b) => b - a);
  const fastCutoff =
    sellers.length >= 5
      ? (sellers[Math.max(0, Math.ceil(sellers.length * 0.2) - 1)] ?? Infinity)
      : Infinity;

  return products.map((p) => {
    const rate = p.units_30 / 30;
    let velocity: Velocity;
    if (p.units_30 > 0) velocity = p.units_30 >= fastCutoff ? "fast" : "normal";
    else if (p.units_90 > 0) velocity = "slow";
    else if (p.quantity > 0 && p.age_days >= 90) velocity = "dead";
    else if (p.age_days < 90) velocity = "new";
    else velocity = "slow";

    const cover = rate > 0 ? p.quantity / rate : null;
    let reorder: StockInsight["reorder"] = null;
    if (p.quantity <= 0 && (p.units_90 > 0 || p.low_stock_threshold > 0)) {
      reorder = {
        urgency: "out",
        suggested_qty: Math.max(1, Math.ceil(rate * TARGET_COVER_DAYS + p.low_stock_threshold)),
      };
    } else if (p.quantity > 0 && p.quantity <= p.low_stock_threshold) {
      reorder = {
        urgency: "low",
        suggested_qty: Math.max(
          1,
          Math.ceil(rate * TARGET_COVER_DAYS + p.low_stock_threshold - p.quantity),
        ),
      };
    } else if (cover !== null && cover < SOON_COVER_DAYS) {
      reorder = {
        urgency: "soon",
        suggested_qty: Math.max(1, Math.ceil(rate * TARGET_COVER_DAYS - p.quantity)),
      };
    }
    return {
      ...p,
      velocity,
      daily_rate: round2(rate),
      days_of_cover: cover === null ? null : Math.round(cover),
      stock_cost: round2(p.quantity * p.cost_price),
      stock_retail: round2(p.quantity * p.selling_price),
      reorder,
    };
  });
}

export function stockTotals(rows: StockInsight[]) {
  const sum = (list: StockInsight[], pick: (r: StockInsight) => number) =>
    round2(list.reduce((s, r) => s + pick(r), 0));
  const dead = rows.filter((r) => r.velocity === "dead");
  return {
    cost: sum(rows, (r) => r.stock_cost),
    retail: sum(rows, (r) => r.stock_retail),
    potentialProfit: round2(sum(rows, (r) => r.stock_retail) - sum(rows, (r) => r.stock_cost)),
    deadCount: dead.length,
    deadCost: sum(dead, (r) => r.stock_cost),
    reorderCount: rows.filter((r) => r.reorder).length,
  };
}
