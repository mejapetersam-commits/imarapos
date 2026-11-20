import { useMemo, useState } from "react";
import { ClipboardList, LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PurchaseOrderRow } from "@/api/functions";
import { formatKes, formatQuantity } from "@/lib/format";
import { poProgress } from "@/lib/po";

type Props = {
  orders: PurchaseOrderRow[];
  loading: boolean;
  needsRestock: number;
  onNew: () => void;
  onOpen: (order: PurchaseOrderRow) => void;
};

const FILTERS = [
  ["all", "All"],
  ["draft", "Draft"],
  ["ordered", "On order"],
  ["received", "Received"],
  ["cancelled", "Cancelled"],
] as const;
const BADGE: Record<string, [string, string]> = {
  draft: ["Draft", "bg-muted text-muted-foreground"],
  ordered: ["On order", "bg-sky-100 text-sky-700"],
  received: ["Received", "bg-emerald-100 text-emerald-700"],
  cancelled: ["Cancelled", "bg-rose-100 text-rose-700"],
};
const when = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { dateStyle: "medium" });
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

export function PurchaseOrders({ orders, loading, needsRestock, onNew, onOpen }: Props) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const rows = useMemo(
    () => orders.filter((o) => filter === "all" || o.status === filter),
    [orders, filter],
  );
  const openValue = orders
    .filter((o) => o.status === "ordered")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Purchase orders</h1>
          <p className="text-sm text-muted-foreground">
            Order stock from suppliers and receive it into inventory. {formatKes(openValue)}{" "}
            currently on order.
          </p>
        </div>
        <Button onClick={onNew}>
          <Plus /> New order
        </Button>
      </div>

      {needsRestock > 0 && (
        <button
          onClick={onNew}
          className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-sm hover:bg-amber-100"
        >
          <ClipboardList className="shrink-0 text-amber-700" size={20} />
          <span>
            <span className="font-medium text-amber-900">
              {needsRestock} {needsRestock === 1 ? "product needs" : "products need"} restocking.
            </span>{" "}
            <span className="text-amber-800">
              Start an order and add the suggested items for a supplier.
            </span>
          </span>
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${filter === id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={18} /> Loading orders…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-medium">
              {orders.length === 0 ? "No purchase orders yet" : "No orders in this view"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {orders.length === 0
                ? "Create an order for a supplier, then receive the delivery to add stock."
                : "Try another filter."}
            </p>
            {orders.length === 0 && (
              <Button className="mt-5" onClick={onNew}>
                <Plus /> New order
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((o) => {
              const [label, tone] = BADGE[o.status] ?? ["", ""];
              const late =
                o.status === "ordered" && o.expected_date !== null && o.expected_date < today();
              const partial = o.status === "ordered" && o.units_received > 0;
              return (
                <li key={o.id}>
                  <button
                    onClick={() => onOpen(o)}
                    className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 p-4 text-left hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="block font-medium">
                        {o.po_number} · {o.supplier}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {when(o.created_at)} · {o.items} {o.items === 1 ? "item" : "items"}
                        {o.expected_date ? ` · expected ${o.expected_date}` : ""}
                      </span>
                    </span>
                    {partial && (
                      <span className="w-32 text-xs text-muted-foreground">
                        <span className="block">
                          {formatQuantity(o.units_received)} of {formatQuantity(o.units_ordered)}{" "}
                          received
                        </span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                          <i
                            className="block h-full bg-primary"
                            style={{ width: `${poProgress(o.units_ordered, o.units_received)}%` }}
                          />
                        </span>
                      </span>
                    )}
                    {late && <span className="text-xs font-medium text-rose-600">Overdue</span>}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
                      {partial ? "Part received" : label}
                    </span>
                    <span className="w-28 text-right font-semibold tabular-nums">
                      {formatKes(o.total)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
