import { useMemo, useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKes } from "@/lib/format";
import { poTotal, round2, validatePoLines, type PoLine } from "@/lib/po";
import { Modal } from "./Forms";
import type { Product, Supplier } from "./types";

export type PoPayload = {
  supplierId: string;
  items: PoLine[];
  expectedDate: string | null;
  notes: string | null;
};

type Props = {
  suppliers: Supplier[];
  products: Product[];
  suggestionsFor: (supplierId: string) => PoLine[];
  initial: (PoPayload & { poNumber: string }) | null;
  saving: boolean;
  onSubmit: (payload: PoPayload, markOrdered: boolean) => void;
  onClose: () => void;
};

const selectClass = "h-10 w-full rounded-lg border bg-background px-3 text-sm";

export function PurchaseOrderForm({
  suppliers,
  products,
  suggestionsFor,
  initial,
  saving,
  onSubmit,
  onClose,
}: Props) {
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? "");
  const [lines, setLines] = useState<PoLine[]>(initial?.items ?? []);
  const [expected, setExpected] = useState(initial?.expectedDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [picked, setPicked] = useState("");
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const available = useMemo(
    () =>
      products
        .filter((p) => p.active && !lines.some((l) => l.productId === p.id))
        .sort(
          (a, b) =>
            Number(b.supplier_id === supplierId) - Number(a.supplier_id === supplierId) ||
            a.name.localeCompare(b.name),
        ),
    [products, lines, supplierId],
  );
  const suggested = supplierId
    ? suggestionsFor(supplierId).filter((s) => !lines.some((l) => l.productId === s.productId))
    : [];
  const total = poTotal(lines);

  const addProduct = () => {
    const product = byId.get(picked);
    if (!product) return;
    setLines([...lines, { productId: product.id, quantity: 1, unitCost: product.cost_price ?? 0 }]);
    setPicked("");
  };
  const update = (id: string, patch: Partial<PoLine>) =>
    setLines(lines.map((l) => (l.productId === id ? { ...l, ...patch } : l)));

  const submit = (markOrdered: boolean) => {
    if (!supplierId) return setError("Choose a supplier.");
    const problem = validatePoLines(lines);
    if (problem) return setError(problem);
    setError(null);
    onSubmit(
      {
        supplierId,
        items: lines.map((l) => ({ ...l, unitCost: round2(l.unitCost) })),
        expectedDate: expected || null,
        notes: notes.trim() || null,
      },
      markOrdered,
    );
  };

  return (
    <Modal
      title={initial ? `Edit ${initial.poNumber}` : "New purchase order"}
      description="Prices are what you expect to pay the supplier. They update each product's cost when you receive the stock."
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Supplier</span>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className={selectClass}
              autoFocus
            >
              <option value="">Choose a supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {suppliers.length === 0 && (
              <span className="block text-xs text-amber-700">
                Add a supplier first on the Suppliers page.
              </span>
            )}
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Expected delivery</span>
            <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </label>
        </div>

        {suggested.length > 0 && (
          <button
            type="button"
            onClick={() => setLines([...lines, ...suggested.filter((s) => byId.has(s.productId))])}
            className="flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900 hover:bg-amber-100"
          >
            <Sparkles size={16} className="shrink-0" /> Add {suggested.length} suggested{" "}
            {suggested.length === 1 ? "item" : "items"} that need restocking
          </button>
        )}

        <div className="flex gap-2">
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className={selectClass}
            aria-label="Product to add"
          >
            <option value="">Add a product…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku}){p.supplier_id === supplierId && supplierId ? " ★" : ""}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={addProduct} disabled={!picked}>
            <Plus /> Add
          </Button>
        </div>

        {lines.length > 0 && (
          <ul className="divide-y rounded-xl border">
            {lines.map((l) => {
              const product = byId.get(l.productId);
              return (
                <li
                  key={l.productId}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 p-3 sm:grid-cols-[1fr_5.5rem_7rem_6rem_auto]"
                >
                  <span className="min-w-0 sm:col-auto">
                    <span className="block truncate text-sm font-medium">
                      {product?.name ?? "Product"}
                    </span>
                    <span className="text-xs text-muted-foreground">{product?.sku}</span>
                  </span>
                  <button
                    type="button"
                    aria-label="Remove"
                    className="justify-self-end text-muted-foreground hover:text-rose-600 sm:order-last"
                    onClick={() => setLines(lines.filter((x) => x.productId !== l.productId))}
                  >
                    <Trash2 size={15} />
                  </button>
                  <label className="text-xs text-muted-foreground">
                    Qty
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={l.quantity}
                      onChange={(e) => update(l.productId, { quantity: Number(e.target.value) })}
                      className="mt-1 h-9"
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Unit cost
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.unitCost}
                      onChange={(e) => update(l.productId, { unitCost: Number(e.target.value) })}
                      className="mt-1 h-9"
                    />
                  </label>
                  <span className="text-right text-sm font-medium tabular-nums sm:self-end sm:pb-2">
                    {formatKes(round2(l.quantity * l.unitCost))}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Notes for the supplier (optional)</span>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Delivery instructions, payment terms…"
          />
        </label>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">Order total</span>
          <span className="text-lg font-semibold tabular-nums">{formatKes(total)}</span>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="outline" disabled={saving} onClick={() => submit(false)}>
            Save as draft
          </Button>
          {!initial && (
            <Button type="button" disabled={saving} onClick={() => submit(true)}>
              Save and mark as ordered
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
