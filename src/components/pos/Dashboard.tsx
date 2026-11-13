import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  PackagePlus,
  Receipt,
  Tags,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKes, formatQuantity, stockState } from "@/lib/format";
import type { Product } from "./types";

type Props = {
  name: string;
  products: Product[];
  revenue: number;
  salesCount: number;
  customersCount: number;
  categoriesCount: number;
  loading: boolean;
  canManage: boolean;
  onAddProduct: () => void;
  onOpenInventory: () => void;
};

export function Dashboard(p: Props) {
  const stockValue = p.products.reduce(
    (sum, x) => sum + (x.inventory?.quantity_on_hand ?? 0) * x.cost_price,
    0,
  );
  const low = p.products.filter(
    (x) => stockState(x.inventory?.quantity_on_hand ?? 0, x.low_stock_threshold) !== "ok",
  );
  const empty = !p.loading && p.products.length === 0;
  const cards = [
    {
      label: "Revenue",
      value: formatKes(p.revenue),
      note: `${p.salesCount} completed ${p.salesCount === 1 ? "sale" : "sales"}`,
      icon: Wallet,
      tone: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Stock value (at cost)",
      value: formatKes(stockValue),
      note: `${p.products.length} ${p.products.length === 1 ? "product" : "products"}`,
      icon: Boxes,
      tone: "bg-sky-100 text-sky-700",
    },
    {
      label: "Needs restocking",
      value: String(low.length),
      note: low.length ? "Low or out of stock" : "All stock levels healthy",
      icon: AlertTriangle,
      tone: low.length ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Customers",
      value: String(p.customersCount),
      note: "In your address book",
      icon: Users,
      tone: "bg-violet-100 text-violet-700",
    },
  ];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Overview</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{p.name}</h1>
        </div>
        {p.canManage && (
          <Button onClick={p.onAddProduct}>
            <PackagePlus /> Add product
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, note, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className={`flex size-9 items-center justify-center rounded-xl ${tone}`}>
                <Icon size={18} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{note}</p>
          </div>
        ))}
      </div>

      {empty ? (
        <div className="rounded-2xl border border-dashed bg-card p-8 sm:p-12">
          <h2 className="text-lg font-semibold">Let’s set up your shop</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Add your products with opening stock so every sale and restock is tracked from day one.
          </p>
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              [
                Tags,
                "Create categories",
                "Group products so they are easy to find.",
                p.categoriesCount > 0,
              ],
              [PackagePlus, "Add your first product", "SKU, prices and opening stock.", false],
              [Receipt, "Sell (coming soon)", "Fast checkout and receipts are next.", false],
            ].map(([Icon, title, text, done], i) => {
              const I = Icon as typeof Tags;
              return (
                <li key={String(title)} className="rounded-xl border bg-background p-4">
                  <span
                    className={`flex size-8 items-center justify-center rounded-lg ${done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                  >
                    <I size={16} />
                  </span>
                  <p className="mt-3 text-sm font-medium">
                    {i + 1}. {String(title)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{String(text)}</p>
                </li>
              );
            })}
          </ol>
          {p.canManage ? (
            <Button className="mt-6" onClick={p.onAddProduct}>
              <PackagePlus /> Add your first product
            </Button>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">
              Ask an owner or manager to add the first products.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Sales trend</h2>
            </div>
            <div className="mt-4 flex h-48 items-center justify-center rounded-xl bg-muted/40 text-center text-sm text-muted-foreground">
              {p.salesCount === 0
                ? "Your sales chart will appear after your first completed sale."
                : "Charts arrive with the reports module."}
            </div>
          </section>
          <section className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Low stock</h2>
              <button
                onClick={p.onOpenInventory}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View all <ArrowRight size={14} />
              </button>
            </div>
            {low.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">Nothing to restock right now.</p>
            ) : (
              <ul className="mt-3 divide-y">
                {low.slice(0, 6).map((x) => {
                  const qty = x.inventory?.quantity_on_hand ?? 0;
                  return (
                    <li
                      key={x.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{x.name}</span>
                        <span className="text-xs text-muted-foreground">{x.sku}</span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${qty <= 0 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
                      >
                        {qty <= 0 ? "Out of stock" : `${formatQuantity(qty)} left`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
