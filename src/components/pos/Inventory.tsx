import { useMemo, useState } from "react";
import { LoaderCircle, PackagePlus, Pencil, Search, SlidersHorizontal, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKes, formatQuantity, stockState } from "@/lib/format";
import type { Category, Product } from "./types";

type Props = {
  products: Product[];
  categories: Category[];
  loading: boolean;
  canManage: boolean;
  onEdit: (product: Product) => void;
  onAddProduct: () => void;
  onAddCategory: () => void;
  onAdjust: (product: Product) => void;
};

const BADGE = {
  ok: ["In stock", "bg-emerald-100 text-emerald-700"],
  low: ["Low stock", "bg-amber-100 text-amber-700"],
  out: ["Out of stock", "bg-rose-100 text-rose-700"],
} as const;

export function Inventory(p: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = p.products.filter((x) => !x.active).length;
  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return p.products.filter(
      (x) =>
        (showArchived || x.active) &&
        (category === "all" || x.category_id === category) &&
        (!term ||
          [x.name, x.sku, x.barcode, x.category].some((v) => v?.toLowerCase().includes(term))),
    );
  }, [p.products, query, category, showArchived]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {p.products.length} {p.products.length === 1 ? "product" : "products"} ·{" "}
            {p.categories.length} {p.categories.length === 1 ? "category" : "categories"}
          </p>
        </div>
        {p.canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={p.onAddCategory}>
              <Tags /> Add category
            </Button>
            <Button onClick={p.onAddProduct}>
              <PackagePlus /> Add product
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, SKU or barcode"
            className="h-10 bg-card pl-9"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 rounded-lg border bg-card px-3 text-sm sm:w-52"
        >
          <option value="all">All categories</option>
          {p.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {archivedCount > 0 && (
          <label className="flex h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="size-4 accent-emerald-700"
            />
            Show archived ({archivedCount})
          </label>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {p.loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={18} /> Loading inventory…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-medium">
              {p.products.length === 0 ? "No products yet" : "No products match your search"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.products.length === 0
                ? "Add your first product with opening stock."
                : "Try a different search or category."}
            </p>
            {p.products.length === 0 && (
              <Button className="mt-5" onClick={p.onAddProduct}>
                <PackagePlus /> Add product
              </Button>
            )}
          </div>
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="px-3 py-3 text-right font-medium">Cost</th>
                  <th className="px-3 py-3 text-right font-medium">Price</th>
                  <th className="px-3 py-3 text-right font-medium">In stock</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((x) => {
                  const qty = x.inventory?.quantity_on_hand ?? 0;
                  const [label, tone] = x.active
                    ? BADGE[stockState(qty, x.low_stock_threshold)]
                    : (["Archived", "bg-muted text-muted-foreground"] as const);
                  return (
                    <tr key={x.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3.5">
                        <span className="block font-medium">{x.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {x.sku}
                          {x.barcode ? ` · ${x.barcode}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-muted-foreground">{x.category}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-muted-foreground">
                        {formatKes(x.cost_price)}
                      </td>
                      <td className="px-3 py-3.5 text-right font-medium tabular-nums">
                        {formatKes(x.selling_price)}
                      </td>
                      <td className="px-3 py-3.5 text-right font-medium tabular-nums">
                        {formatQuantity(qty)}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
                          {label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {p.canManage && (
                          <span className="inline-flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => p.onEdit(x)}>
                              <Pencil /> Edit
                            </Button>
                            {x.active && (
                              <Button size="sm" variant="outline" onClick={() => p.onAdjust(x)}>
                                <SlidersHorizontal /> Adjust
                              </Button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ul className="divide-y md:hidden">
              {rows.map((x) => {
                const qty = x.inventory?.quantity_on_hand ?? 0;
                const [label, tone] = x.active
                  ? BADGE[stockState(qty, x.low_stock_threshold)]
                  : (["Archived", "bg-muted text-muted-foreground"] as const);
                return (
                  <li key={x.id} className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block font-medium">{x.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {x.sku} · {x.category}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}
                      >
                        {label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {formatQuantity(qty)} in stock · {formatKes(x.selling_price)}
                      </span>
                      {p.canManage && (
                        <span className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => p.onEdit(x)}>
                            <Pencil /> Edit
                          </Button>
                          {x.active && (
                            <Button size="sm" variant="outline" onClick={() => p.onAdjust(x)}>
                              <SlidersHorizontal /> Adjust
                            </Button>
                          )}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
