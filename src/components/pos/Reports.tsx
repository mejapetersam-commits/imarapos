import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, PackageSearch } from "lucide-react";
import type { ReportData, StockRow } from "@/api/functions";
import { Input } from "@/components/ui/input";
import { formatKes, formatQuantity } from "@/lib/format";
import {
  fillSeries,
  marginPct,
  presetRange,
  todayInNairobi,
  type Granularity,
  type Preset,
} from "@/lib/report";
import { analyseStock, stockTotals, type Velocity } from "@/lib/stock-insights";
import { TrendChart } from "./TrendChart";

type Props = {
  report: ReportData | null;
  stock: StockRow[] | null;
  loading: boolean;
  onLoadReport: (from: string, to: string, granularity: Granularity) => void;
  onLoadStock: () => void;
};

const PRESETS: [Preset, string][] = [
  ["today", "Today"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["month", "This month"],
  ["last_month", "Last month"],
];
const TABS = [
  ["overview", "Overview"],
  ["products", "Products"],
  ["staff", "Staff"],
  ["stock", "Stock"],
] as const;
const VELOCITY: Record<Velocity, [string, string]> = {
  fast: ["Fast", "bg-emerald-100 text-emerald-700"],
  normal: ["Steady", "bg-sky-100 text-sky-700"],
  slow: ["Slow", "bg-amber-100 text-amber-700"],
  dead: ["Dead", "bg-rose-100 text-rose-700"],
  new: ["New", "bg-violet-100 text-violet-700"],
};
const URGENCY = {
  out: ["Out of stock", "text-rose-600"],
  low: ["Low", "text-amber-600"],
  soon: ["Running low soon", "text-amber-600"],
} as const;
const METHOD: Record<string, string> = {
  cash: "Cash",
  credit: "On credit",
  mpesa: "M-Pesa",
  card: "Card",
  bank_transfer: "Bank transfer",
};

export function Reports({ report, stock, loading, onLoadReport, onLoadStock }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("overview");
  const [preset, setPreset] = useState<Preset | "custom">("30d");
  const [range, setRange] = useState(() => presetRange("30d"));
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [filter, setFilter] = useState<"all" | "reorder" | "slow" | "dead">("all");

  useEffect(() => {
    if (range.from <= range.to) onLoadReport(range.from, range.to, granularity);
  }, [range.from, range.to, granularity]);
  useEffect(() => {
    if (tab === "stock" && !stock) onLoadStock();
  }, [tab]);

  const choose = (p: Preset) => {
    setPreset(p);
    setRange(presetRange(p));
    setGranularity(
      p === "today" || p === "7d" || p === "month" || p === "last_month" ? "day" : "day",
    );
  };

  const series = useMemo(
    () => (report ? fillSeries(report.series, range.from, range.to, granularity) : []),
    [report, range, granularity],
  );
  const insights = useMemo(() => (stock ? analyseStock(stock) : []), [stock]);
  const totals = useMemo(() => stockTotals(insights), [insights]);
  const visible = useMemo(() => {
    const list = insights.filter((r) =>
      filter === "reorder"
        ? r.reorder
        : filter === "slow"
          ? r.velocity === "slow"
          : filter === "dead"
            ? r.velocity === "dead"
            : true,
    );
    return filter === "reorder"
      ? list.sort(
          (a, b) =>
            "out low soon".indexOf(a.reorder!.urgency) - "out low soon".indexOf(b.reorder!.urgency),
        )
      : list;
  }, [insights, filter]);
  const t = report?.totals;
  const maxRevenue = Math.max(1, ...(report?.staff.map((s) => s.revenue) ?? [1]));

  const card = (label: string, value: string, note: string, tone = "") => (
    <div key={label} className="rounded-2xl border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Sales are counted on the day they were made, net of refunds. Times are Nairobi time.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => choose(id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${preset === id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <Input
          type="date"
          value={range.from}
          max={todayInNairobi()}
          onChange={(e) => {
            setPreset("custom");
            setRange({ ...range, from: e.target.value });
          }}
          className="h-9 w-40 bg-card"
          aria-label="From"
        />
        <span className="text-sm text-muted-foreground">to</span>
        <Input
          type="date"
          value={range.to}
          max={todayInNairobi()}
          onChange={(e) => {
            setPreset("custom");
            setRange({ ...range, to: e.target.value });
          }}
          className="h-9 w-40 bg-card"
          aria-label="To"
        />
        {range.from > range.to && (
          <span className="text-xs text-rose-600">The start date is after the end date.</span>
        )}
      </div>

      <div className="flex gap-1 border-b text-sm">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2 font-medium ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== "stock" &&
        (loading && !report ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={18} /> Loading report…
          </div>
        ) : !report || !t ? null : (
          <div className={loading ? "opacity-60 transition" : "transition"}>
            {tab === "overview" && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {card(
                    "Revenue",
                    formatKes(t.revenue),
                    `${t.sales} ${t.sales === 1 ? "sale" : "sales"} · avg ${formatKes(t.avg_sale)}`,
                  )}
                  {card(
                    "Gross profit",
                    formatKes(t.gross_profit),
                    `${marginPct(t.gross_profit, t.revenue)}% margin`,
                    t.gross_profit < 0 ? "text-rose-600" : "",
                  )}
                  {card("Expenses", formatKes(t.expenses), "Recorded under Expenses")}
                  {card(
                    "Net profit",
                    formatKes(t.net_profit),
                    "Gross profit minus expenses",
                    t.net_profit < 0 ? "text-rose-600" : "text-emerald-700",
                  )}
                </div>
                <section className="rounded-2xl border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-semibold">Sales trend</h2>
                    <div className="flex gap-1 rounded-lg border p-0.5 text-xs">
                      {(["day", "week", "month"] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => setGranularity(g)}
                          className={`rounded-md px-3 py-1 font-medium ${granularity === g ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          {g === "day" ? "Daily" : g === "week" ? "Weekly" : "Monthly"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <i className="size-2.5 rounded-full bg-emerald-700" /> Revenue
                    </span>
                    <span className="flex items-center gap-1.5">
                      <i className="size-2.5 rounded-full bg-sky-500" /> Gross profit
                    </span>
                  </div>
                  {t.sales === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      No sales in this period.
                    </p>
                  ) : (
                    <div className="mt-3">
                      <TrendChart data={series} granularity={granularity} />
                    </div>
                  )}
                </section>
                <div className="grid gap-4 md:grid-cols-3">
                  <section className="rounded-2xl border bg-card p-5 shadow-sm">
                    <h2 className="font-semibold">Sales detail</h2>
                    <dl className="mt-3 space-y-2 text-sm">
                      {[
                        ["Gross sales", formatKes(t.gross_sales)],
                        ["Discounts", `-${formatKes(t.discounts)}`],
                        ["Refunds", `-${formatKes(t.refunds)}`],
                        ["Cost of goods", formatKes(t.cogs)],
                        ["Units sold", formatQuantity(t.units)],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                  <section className="rounded-2xl border bg-card p-5 shadow-sm">
                    <h2 className="font-semibold">Payments taken</h2>
                    {report.payments.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">None in this period.</p>
                    ) : (
                      <ul className="mt-3 space-y-2 text-sm">
                        {report.payments.map((p) => (
                          <li key={p.method} className="flex justify-between">
                            <span className="text-muted-foreground">
                              {METHOD[p.method] ?? p.method}
                            </span>
                            <span className="tabular-nums">{formatKes(p.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section className="rounded-2xl border bg-card p-5 shadow-sm">
                    <h2 className="font-semibold">Expenses by category</h2>
                    {report.expensesByCategory.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">No expenses recorded.</p>
                    ) : (
                      <ul className="mt-3 space-y-2 text-sm">
                        {report.expensesByCategory.map((e) => (
                          <li key={e.category} className="flex justify-between">
                            <span className="text-muted-foreground">{e.category}</span>
                            <span className="tabular-nums">{formatKes(e.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </div>
            )}

            {tab === "products" && (
              <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
                {report.products.length === 0 ? (
                  <p className="p-12 text-center text-sm text-muted-foreground">
                    No products sold in this period.
                  </p>
                ) : (
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 font-medium">#</th>
                        <th className="px-3 py-3 font-medium">Product</th>
                        <th className="px-3 py-3 text-right font-medium">Units</th>
                        <th className="px-3 py-3 text-right font-medium">Revenue</th>
                        <th className="px-3 py-3 text-right font-medium">Profit</th>
                        <th className="px-5 py-3 text-right font-medium">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {report.products.map((p, i) => (
                        <tr key={p.id}>
                          <td className="px-5 py-3 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-3">
                            <span className="block font-medium">{p.name}</span>
                            <span className="text-xs text-muted-foreground">{p.sku}</span>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {formatQuantity(p.units)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {formatKes(p.revenue)}
                          </td>
                          <td
                            className={`px-3 py-3 text-right tabular-nums ${p.profit < 0 ? "text-rose-600" : ""}`}
                          >
                            {formatKes(p.profit)}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums">
                            {marginPct(p.profit, p.revenue)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === "staff" && (
              <div className="rounded-2xl border bg-card shadow-sm">
                {report.staff.length === 0 ? (
                  <p className="p-12 text-center text-sm text-muted-foreground">
                    No sales in this period.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {report.staff.map((s) => (
                      <li key={s.id ?? "none"} className="p-5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium">{s.name ?? "Former team member"}</span>
                          <span className="font-semibold tabular-nums">{formatKes(s.revenue)}</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(s.revenue / maxRevenue) * 100}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {s.sales} {s.sales === 1 ? "sale" : "sales"} · average{" "}
                          {formatKes(s.avg_sale)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}

      {tab === "stock" &&
        (!stock ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={18} /> Analysing stock…
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {card(
                "Stock value (cost)",
                formatKes(totals.cost),
                `${insights.length} active products`,
              )}
              {card(
                "Stock value (retail)",
                formatKes(totals.retail),
                `Potential profit ${formatKes(totals.potentialProfit)}`,
              )}
              {card(
                "Dead stock",
                formatKes(totals.deadCost),
                `${totals.deadCount} products, no sales in 90 days`,
                totals.deadCount ? "text-rose-600" : "",
              )}
              {card(
                "Needs restocking",
                String(totals.reorderCount),
                "Out, low or running out soon",
                totals.reorderCount ? "text-amber-600" : "",
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["reorder", "Reorder"],
                  ["slow", "Slow"],
                  ["dead", "Dead stock"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${filter === id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
              {visible.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  <PackageSearch className="mx-auto mb-2" /> Nothing in this view.
                </div>
              ) : (
                <table className="w-full min-w-[44rem] text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Product</th>
                      <th className="px-3 py-3 font-medium">Movement</th>
                      <th className="px-3 py-3 text-right font-medium">In stock</th>
                      <th className="px-3 py-3 text-right font-medium">Sold (30d)</th>
                      <th className="px-3 py-3 text-right font-medium">Cover</th>
                      <th className="px-3 py-3 text-right font-medium">Value (cost)</th>
                      <th className="px-5 py-3 font-medium">Restock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visible.map((r) => {
                      const [label, tone] = VELOCITY[r.velocity];
                      return (
                        <tr key={r.id}>
                          <td className="px-5 py-3">
                            <span className="block font-medium">{r.name}</span>
                            <span className="text-xs text-muted-foreground">{r.sku}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}
                            >
                              {label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {formatQuantity(r.quantity)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {formatQuantity(r.units_30)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                            {r.days_of_cover === null ? "—" : `${r.days_of_cover} d`}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {formatKes(r.stock_cost)}
                          </td>
                          <td className="px-5 py-3">
                            {r.reorder ? (
                              <span
                                className={`text-xs font-medium ${URGENCY[r.reorder.urgency][1]}`}
                              >
                                {URGENCY[r.reorder.urgency][0]} · order about{" "}
                                {formatQuantity(r.reorder.suggested_qty)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Suggestions aim for about 30 days of cover based on the last 30 days of sales.
              Products listed for under 90 days are never called dead stock.
            </p>
          </div>
        ))}
    </div>
  );
}
