export type Breakdown = {
  opening: number;
  cash_sales: number;
  credit_repayments: number;
  pay_ins: number;
  pay_outs: number;
  cash_refunds: number;
  expected: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Cash that should be in the drawer: float + cash sales + cash repayments + cash in - cash out - cash refunds. */
export const expectedCash = (b: Omit<Breakdown, "expected">) =>
  round2(b.opening + b.cash_sales + b.credit_repayments + b.pay_ins - b.pay_outs - b.cash_refunds);

/** Positive = more cash than expected (over), negative = short. */
export const cashVariance = (counted: number, expected: number) => round2(counted - expected);

export type VarianceTone = "ok" | "over" | "short";
export function varianceInfo(variance: number | null): { label: string; tone: VarianceTone } {
  if (variance === null) return { label: "Not counted", tone: "ok" };
  if (Math.abs(variance) < 0.005) return { label: "Balanced", tone: "ok" };
  const amount = Math.abs(variance).toLocaleString("en-KE", { maximumFractionDigits: 2 });
  return variance > 0
    ? { label: `Over by KES ${amount}`, tone: "over" }
    : { label: `Short by KES ${amount}`, tone: "short" };
}

/** "3h 12m", "45m" or "2d 4h" between two moments (closedAt defaults to now). */
export function shiftDuration(openedAt: string, closedAt: string | null, now = new Date()): string {
  const end = closedAt ? new Date(closedAt) : now;
  const minutes = Math.max(0, Math.floor((end.getTime() - new Date(openedAt).getTime()) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
