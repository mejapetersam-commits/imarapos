import { useState } from "react";
import { LoaderCircle, MessageCircle, Printer, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Receipt } from "@/api/functions";
import { formatKes, formatQuantity } from "@/lib/format";
import { Modal } from "./Forms";

type Props = {
  receipt: Receipt;
  canRefund: boolean;
  saving: boolean;
  onRefund: (items: { saleItemId: string; quantity: number }[], reason: string) => void;
  onClose: () => void;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });

export function receiptText(r: Receipt): string {
  const lines = r.items.map(
    (i) => `${formatQuantity(i.quantity)} x ${i.name}  ${formatKes(i.line_total)}`,
  );
  return [
    r.business,
    `Receipt ${r.sale.receipt_no ?? ""}`,
    when(r.sale.created_at),
    "",
    ...lines,
    "",
    r.sale.discount_total > 0 ? `Discount: ${formatKes(r.sale.discount_total)}` : "",
    `TOTAL: ${formatKes(r.sale.total)}`,
    "",
    "Thank you for shopping with us.",
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n");
}

export function ReceiptDialog({ receipt: r, canRefund, saving, onRefund, onClose }: Props) {
  const [refunding, setRefunding] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const refundable =
    r.sale.status === "completed" && r.items.some((i) => i.quantity - i.returned_quantity > 0);

  const submitRefund = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    const items = r.items
      .map((i) => ({ saleItemId: i.id, quantity: Number(quantities[i.id] ?? 0) }))
      .filter((i) => i.quantity > 0);
    if (items.length) onRefund(items, reason);
  };

  return (
    <Modal title={refunding ? "Return items" : "Receipt"} onClose={onClose}>
      {refunding ? (
        <form onSubmit={submitRefund} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter how many of each item are being returned. Stock is added back and the refund is
            paid out in cash.
          </p>
          <ul className="divide-y rounded-xl border">
            {r.items.map((i) => {
              const left = i.quantity - i.returned_quantity;
              return (
                <li key={i.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span>
                    <span className="block font-medium">{i.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatQuantity(left)} of {formatQuantity(i.quantity)} returnable
                    </span>
                  </span>
                  <Input
                    type="number"
                    min="0"
                    max={left}
                    step="any"
                    disabled={left <= 0}
                    value={quantities[i.id] ?? ""}
                    onChange={(e) => setQuantities({ ...quantities, [i.id]: e.target.value })}
                    className="h-9 w-24 text-right"
                    placeholder="0"
                  />
                </li>
              );
            })}
          </ul>
          <Input name="reason" maxLength={200} placeholder="Reason (optional)" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRefunding(false)}>
              Back
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <LoaderCircle className="animate-spin" />} Refund
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="receipt-print mx-auto w-full max-w-[22rem] rounded-xl border bg-white p-5 font-mono text-[13px] leading-relaxed text-black">
            <div className="text-center">
              <p className="text-base font-bold">{r.business}</p>
              <p>Receipt {r.sale.receipt_no}</p>
              <p>{when(r.sale.created_at)}</p>
              {r.sale.salesperson && <p>Served by {r.sale.salesperson}</p>}
              {r.sale.status !== "completed" && (
                <p className="mt-1 font-bold uppercase">{r.sale.status}</p>
              )}
            </div>
            <hr className="my-3 border-dashed border-black/40" />
            {r.items.map((i) => (
              <div key={i.id} className="mb-1.5">
                <div className="flex justify-between gap-2">
                  <span>{i.name}</span>
                  <span>{formatKes(i.line_total)}</span>
                </div>
                <div className="text-black/60">
                  {formatQuantity(i.quantity)} x {formatKes(i.unit_price)}
                  {i.discount > 0 ? ` (-${formatKes(i.discount)})` : ""}
                  {i.returned_quantity > 0
                    ? ` · ${formatQuantity(i.returned_quantity)} returned`
                    : ""}
                </div>
              </div>
            ))}
            <hr className="my-3 border-dashed border-black/40" />
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatKes(r.sale.subtotal)}</span>
            </div>
            {r.sale.discount_total > 0 && (
              <div className="flex justify-between">
                <span>Discount</span>
                <span>-{formatKes(r.sale.discount_total)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <span>TOTAL</span>
              <span>{formatKes(r.sale.total)}</span>
            </div>
            {r.payment && (
              <>
                <div className="flex justify-between">
                  <span>{r.payment.method === "cash" ? "Cash" : r.payment.method}</span>
                  <span>{formatKes(r.payment.tendered ?? r.payment.amount)}</span>
                </div>
                {r.payment.change_given > 0 && (
                  <div className="flex justify-between">
                    <span>Change</span>
                    <span>{formatKes(r.payment.change_given)}</span>
                  </div>
                )}
              </>
            )}
            {r.refunded > 0 && (
              <div className="mt-1 flex justify-between font-bold">
                <span>Refunded</span>
                <span>-{formatKes(r.refunded)}</span>
              </div>
            )}
            <p className="mt-4 text-center">Thank you!</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {canRefund && refundable && (
              <Button variant="outline" onClick={() => setRefunding(true)}>
                <Undo2 /> Return items
              </Button>
            )}
            <Button variant="outline" asChild>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(receiptText(r))}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle /> WhatsApp
              </a>
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
