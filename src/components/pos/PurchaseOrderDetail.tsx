import { useState } from "react";
import { LoaderCircle, MessageCircle, PackageCheck, Pencil, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PurchaseOrderDetail as Detail } from "@/api/functions";
import { formatKes, formatQuantity } from "@/lib/format";
import { toWhatsAppNumber } from "@/lib/phone";
import { outstanding, poMessage, poProgress } from "@/lib/po";
import { Modal } from "./Forms";

type Props = {
  detail: Detail;
  saving: boolean;
  onClose: () => void;
  onEdit: () => void;
  onStatus: (status: "ordered" | "cancelled") => void;
  onReceive: (items: { itemId: string; quantity: number }[], note: string | null) => void;
};

const STATUS: Record<string, [string, string]> = {
  draft: ["Draft", "bg-muted text-muted-foreground"],
  ordered: ["On order", "bg-sky-100 text-sky-700"],
  received: ["Received", "bg-emerald-100 text-emerald-700"],
  cancelled: ["Cancelled", "bg-rose-100 text-rose-700"],
};
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-KE", { dateStyle: "medium" }) : "—";

export function PurchaseOrderDetail({
  detail: d,
  saving,
  onClose,
  onEdit,
  onStatus,
  onReceive,
}: Props) {
  const [receiving, setReceiving] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const o = d.order;
  const [label, tone] = STATUS[o.status] ?? ["", ""];
  const canReceive = o.status === "draft" || o.status === "ordered";
  const received = d.items.reduce((s, i) => s + i.received_quantity, 0);
  const ordered = d.items.reduce((s, i) => s + i.quantity, 0);
  const phone = toWhatsAppNumber(d.supplier.phone);
  const message = poMessage({
    business: d.business,
    poNumber: o.po_number,
    supplier: d.supplier.name,
    expected: o.expected_date,
    notes: o.notes,
    items: d.items,
    total: d.total,
  });

  const startReceiving = () => {
    setQty(Object.fromEntries(d.items.map((i) => [i.id, String(outstanding(i))])));
    setReceiving(true);
  };
  const submitReceive = (event: React.FormEvent) => {
    event.preventDefault();
    const items = d.items
      .map((i) => ({ itemId: i.id, quantity: Number(qty[i.id] ?? 0) }))
      .filter((i) => i.quantity > 0);
    if (items.length) onReceive(items, note.trim() || null);
  };

  return (
    <Modal title={`${o.po_number} · ${d.supplier.name}`} onClose={onClose}>
      {receiving ? (
        <form onSubmit={submitReceive} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter what actually arrived. Stock is added now, and each product’s cost is updated as
            an average of what you already hold and this delivery.
          </p>
          <ul className="divide-y rounded-xl border">
            {d.items.map((i) => {
              const left = outstanding(i);
              return (
                <li key={i.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{i.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatQuantity(left)} still to come · {formatKes(i.unit_cost)} each
                    </span>
                  </span>
                  <Input
                    type="number"
                    min="0"
                    max={left}
                    step="any"
                    disabled={left <= 0}
                    value={qty[i.id] ?? ""}
                    onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })}
                    className="h-9 w-24 text-right"
                  />
                </li>
              );
            })}
          </ul>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="Delivery note or invoice number (optional)"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setReceiving(false)}>
              Back
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <LoaderCircle className="animate-spin" />} Add to stock
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="doc-print rounded-xl border bg-white p-5 text-sm text-black">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold">{d.business}</p>
                <p className="text-black/70">Purchase order {o.po_number}</p>
                <p className="text-black/70">
                  Created {when(o.created_at)}
                  {o.expected_date ? ` · needed by ${o.expected_date}` : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium print:hidden ${tone}`}
              >
                {label}
              </span>
            </div>
            <div className="mt-3 text-black/80">
              <p className="font-medium">To: {d.supplier.name}</p>
              {d.supplier.phone && <p>{d.supplier.phone}</p>}
              {d.supplier.email && <p>{d.supplier.email}</p>}
            </div>
            <table className="mt-4 w-full text-left">
              <thead className="border-b text-xs uppercase text-black/60">
                <tr>
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Unit cost</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {d.items.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2">
                      <span className="block font-medium">{i.name}</span>
                      <span className="text-xs text-black/60">
                        {i.sku}
                        {i.received_quantity > 0
                          ? ` · ${formatQuantity(i.received_quantity)} received`
                          : ""}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatQuantity(i.quantity)}</td>
                    <td className="py-2 text-right tabular-nums">{formatKes(i.unit_cost)}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatKes(Math.round(i.quantity * i.unit_cost * 100) / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-bold">
                  <td className="py-2" colSpan={3}>
                    Total
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatKes(d.total)}</td>
                </tr>
              </tfoot>
            </table>
            {o.notes && <p className="mt-3 text-black/70">Note: {o.notes}</p>}
            {o.status === "ordered" && received > 0 && (
              <div className="mt-4 print:hidden">
                <p className="text-xs text-black/60">
                  {formatQuantity(received)} of {formatQuantity(ordered)} units received
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10">
                  <i
                    className="block h-full bg-emerald-600"
                    style={{ width: `${poProgress(ordered, received)}%` }}
                  />
                </div>
              </div>
            )}
            {o.status === "received" && (
              <p className="mt-3 text-xs text-black/60">Fully received on {when(o.received_at)}.</p>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {o.status === "draft" && (
              <Button variant="outline" onClick={onEdit}>
                <Pencil /> Edit
              </Button>
            )}
            {o.status === "draft" && (
              <Button variant="outline" disabled={saving} onClick={() => onStatus("ordered")}>
                Mark as ordered
              </Button>
            )}
            {(o.status === "draft" || (o.status === "ordered" && received === 0)) && (
              <Button
                variant="ghost"
                className="text-rose-600 hover:text-rose-700"
                disabled={saving}
                onClick={() => onStatus("cancelled")}
              >
                <XCircle /> Cancel order
              </Button>
            )}
            {o.status !== "cancelled" && phone && (
              <Button variant="outline" asChild>
                <a
                  href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle /> WhatsApp
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
            {canReceive && (
              <Button onClick={startReceiving}>
                <PackageCheck /> Receive stock
              </Button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
