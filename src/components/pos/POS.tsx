import { useMemo, useRef, useState } from "react";
import { Banknote, LoaderCircle, Minus, Plus, ScanBarcode, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addToCart,
  canComplete,
  cartSubtotal,
  cartTotal,
  changeDue,
  lineTotal,
  quickCashOptions,
  setQuantity,
  type CartLine,
} from "@/lib/cart";
import { formatKes, formatQuantity } from "@/lib/format";
import type { Product } from "./types";

type Props = {
  products: Product[];
  loading: boolean;
  saving: boolean;
  /** Resolves true when the sale was recorded. The same clientUuid is reused on retry, so a resend can never double-charge. */
  onComplete: (sale: {
    clientUuid: string;
    lines: CartLine[];
    discount: number;
    cashTendered: number;
  }) => Promise<boolean>;
};

const stockOf = (product: Product) => product.inventory?.quantity_on_hand ?? 0;

export function POS({ products, loading, saving, onComplete }: Props) {
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [tendered, setTendered] = useState("");
  const clientUuid = useRef<string>(crypto.randomUUID());
  const searchRef = useRef<HTMLInputElement>(null);

  const sellable = useMemo(() => products.filter((product) => product.active), [products]);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = term
      ? sellable.filter((p) =>
          [p.name, p.sku, p.barcode, p.category].some((v) => v?.toLowerCase().includes(term)),
        )
      : sellable;
    return matches.slice(0, 60);
  }, [sellable, query]);

  const discountValue = Number(discount) || 0;
  const tenderedValue = Number(tendered) || 0;
  const subtotal = cartSubtotal(lines);
  const total = cartTotal(lines, discountValue);
  const change = changeDue(total, tenderedValue);
  const ready = canComplete(lines, discountValue, tenderedValue) && !saving;

  const add = (product: Product) => {
    setLines((current) =>
      addToCart(current, {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unitPrice: product.selling_price,
        maxQuantity: stockOf(product),
      }),
    );
    searchRef.current?.focus();
  };

  /** Barcode scanners type the code and press Enter: an exact barcode/SKU match is added straight to the cart. */
  const onSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const code = query.trim().toLowerCase();
    if (!code) return;
    const exact = sellable.find(
      (p) => p.barcode?.toLowerCase() === code || p.sku.toLowerCase() === code,
    );
    const pick = exact ?? (results.length === 1 ? results[0] : undefined);
    if (pick) {
      add(pick);
      setQuery("");
    }
  };

  const complete = async () => {
    if (!ready) return;
    const ok = await onComplete({
      clientUuid: clientUuid.current,
      lines,
      discount: discountValue,
      cashTendered: tenderedValue,
    });
    if (ok) {
      setLines([]);
      setDiscount("");
      setTendered("");
      setQuery("");
      clientUuid.current = crypto.randomUUID();
      searchRef.current?.focus();
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <section className="min-w-0 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Point of sale</h1>
          <p className="text-sm text-muted-foreground">
            Scan a barcode or search, then tap a product to add it.
          </p>
        </div>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Search name or SKU, or scan a barcode"
            className="h-11 bg-card pl-9 pr-10"
          />
          <ScanBarcode
            size={18}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <LoaderCircle className="animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
            {sellable.length === 0
              ? "No products yet. Add products in Inventory first."
              : "No products match your search."}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {results.map((product) => {
              const stock = stockOf(product);
              const inCart = lines.find((line) => line.productId === product.id)?.quantity ?? 0;
              const out = stock <= 0;
              return (
                <li key={product.id}>
                  <button
                    disabled={out || inCart >= stock}
                    onClick={() => add(product)}
                    className="flex h-full w-full flex-col rounded-xl border bg-card p-3 text-left shadow-sm transition hover:border-primary hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
                    <span className="mt-auto pt-3 text-base font-semibold tabular-nums">
                      {formatKes(product.selling_price)}
                    </span>
                    <span
                      className={`text-xs ${out ? "text-rose-600" : stock <= product.low_stock_threshold ? "text-amber-600" : "text-muted-foreground"}`}
                    >
                      {out ? "Out of stock" : `${formatQuantity(stock)} in stock`}
                      {inCart > 0 && ` · ${formatQuantity(inCart)} in cart`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside className="h-fit rounded-2xl border bg-card shadow-sm lg:sticky lg:top-24">
        <div className="border-b p-4">
          <h2 className="font-semibold">Current sale</h2>
        </div>
        {lines.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Cart is empty.</p>
        ) : (
          <ul className="max-h-72 divide-y overflow-y-auto">
            {lines.map((line) => (
              <li key={line.productId} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{line.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatKes(line.unitPrice)} each
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <button
                    aria-label="Decrease"
                    className="rounded-md border p-1 hover:bg-muted"
                    onClick={() => setLines(setQuantity(lines, line.productId, line.quantity - 1))}
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    aria-label="Quantity"
                    inputMode="decimal"
                    className="h-7 w-12 rounded-md border bg-background text-center text-sm"
                    value={line.quantity}
                    onChange={(e) =>
                      setLines(setQuantity(lines, line.productId, Number(e.target.value)))
                    }
                  />
                  <button
                    aria-label="Increase"
                    className="rounded-md border p-1 hover:bg-muted disabled:opacity-40"
                    disabled={line.quantity >= line.maxQuantity}
                    onClick={() => setLines(setQuantity(lines, line.productId, line.quantity + 1))}
                  >
                    <Plus size={14} />
                  </button>
                </span>
                <span className="w-20 text-right text-sm font-medium tabular-nums">
                  {formatKes(lineTotal(line))}
                </span>
                <button
                  aria-label={`Remove ${line.name}`}
                  className="text-muted-foreground hover:text-rose-600"
                  onClick={() => setLines(setQuantity(lines, line.productId, 0))}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 border-t p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatKes(subtotal)}</span>
          </div>
          <label className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Discount (KES)</span>
            <Input
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="h-8 w-28 text-right"
              placeholder="0"
            />
          </label>
          {discountValue > subtotal && (
            <p className="text-xs text-rose-600">The discount is more than the subtotal.</p>
          )}
          <div className="flex justify-between border-t pt-3 text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatKes(total)}</span>
          </div>

          <div className="space-y-2 border-t pt-3">
            <label className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Banknote size={15} /> Cash received
              </span>
              <Input
                inputMode="decimal"
                type="number"
                min="0"
                step="0.01"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                className="h-9 w-32 text-right"
                placeholder="0"
              />
            </label>
            {total > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {quickCashOptions(total).map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setTendered(String(amount))}
                    className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted"
                  >
                    {amount === total ? "Exact" : amount.toLocaleString("en-KE")}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Change</span>
              <span className="font-medium tabular-nums">{formatKes(change)}</span>
            </div>
          </div>

          <Button
            className="h-12 w-full text-base"
            disabled={!ready}
            onClick={() => void complete()}
          >
            {saving && <LoaderCircle className="animate-spin" />} Complete sale · {formatKes(total)}
          </Button>
          {lines.length > 0 && (
            <button
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setLines([]);
                setDiscount("");
                setTendered("");
              }}
            >
              Clear cart
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
