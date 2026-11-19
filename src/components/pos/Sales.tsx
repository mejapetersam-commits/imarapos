import { LoaderCircle } from "lucide-react";
import type { SaleListRow } from "@/api/functions";
import { formatKes } from "@/lib/format";

const BADGE: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-700",
  refunded: "bg-rose-100 text-rose-700",
  voided: "bg-muted text-muted-foreground",
  pending_payment: "bg-amber-100 text-amber-700",
};
const LABEL: Record<string, string> = {
  completed: "Completed",
  refunded: "Refunded",
  voided: "Voided",
  pending_payment: "Awaiting payment",
};
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });

export function Sales({
  sales,
  loading,
  ownOnly,
  onOpen,
}: {
  sales: SaleListRow[];
  loading: boolean;
  ownOnly: boolean;
  onOpen: (id: string) => void;
}) {
  const today = new Date().toDateString();
  const todays = sales.filter(
    (s) => s.status === "completed" && new Date(s.created_at).toDateString() === today,
  );
  const todayTotal = todays.reduce((sum, s) => sum + s.total, 0);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sales</h1>
          <p className="text-sm text-muted-foreground">
            {ownOnly ? "Your recent sales." : "Recent sales across your team."}
          </p>
        </div>
        <div className="rounded-2xl border bg-card px-5 py-3 text-right shadow-sm">
          <p className="text-xs text-muted-foreground">Today</p>
          <p className="text-lg font-semibold tabular-nums">{formatKes(todayTotal)}</p>
          <p className="text-xs text-muted-foreground">
            {todays.length} {todays.length === 1 ? "sale" : "sales"}
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={18} /> Loading sales…
          </div>
        ) : sales.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-medium">No sales yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Completed sales appear here with their receipts.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {sales.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => onOpen(s.id)}
                  className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{s.receipt_no}</span>
                    <span className="text-xs text-muted-foreground">
                      {when(s.created_at)} · {s.items} {s.items === 1 ? "item" : "items"}
                      {s.customer ? ` · ${s.customer}` : ""}
                      {s.salesperson ? ` · ${s.salesperson}` : ""}
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[s.status] ?? "bg-muted"}`}
                  >
                    {LABEL[s.status] ?? s.status}
                  </span>
                  <span className="w-28 text-right font-semibold tabular-nums">
                    {formatKes(s.total)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
