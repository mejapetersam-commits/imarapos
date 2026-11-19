import { useRef, useState } from "react";
import { LoaderCircle, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CustomerRow, CustomerSale, StatementEntry } from "@/api/functions";
import { formatKes } from "@/lib/format";
import { reminderMessage, toWhatsAppNumber } from "@/lib/phone";
import { Modal } from "./Forms";

type Props = {
  business: string;
  customer: CustomerRow;
  entries: StatementEntry[];
  sales: CustomerSale[];
  canManage: boolean;
  saving: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenSale: (saleId: string) => void;
  onSaveTerms: (creditLimit: number, termsDays: number) => Promise<boolean>;
  onPay: (amount: number, reference: string | null, clientUuid: string) => Promise<boolean>;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
const KIND = { sale: "Credit sale", payment: "Payment", credit_note: "Return credit" } as const;

export function CustomerDetail({
  business,
  customer: c,
  entries,
  sales,
  canManage,
  saving,
  onClose,
  onEdit,
  onDelete,
  onOpenSale,
  onSaveTerms,
  onPay,
}: Props) {
  const [tab, setTab] = useState<"statement" | "purchases">("statement");
  const [paying, setPaying] = useState(false);
  const [editingTerms, setEditingTerms] = useState(false);
  const payId = useRef<string>(crypto.randomUUID());
  const hasCredit = (c.credit_limit ?? 0) > 0;
  const available = Math.max(0, (c.credit_limit ?? 0) - c.balance);
  const phone = toWhatsAppNumber(c.phone);

  const submitPay = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    if (!(amount > 0)) return;
    const ok = await onPay(
      amount,
      String(form.get("reference") ?? "").trim() || null,
      payId.current,
    );
    if (ok) {
      payId.current = crypto.randomUUID();
      setPaying(false);
    }
  };
  const submitTerms = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (await onSaveTerms(Number(form.get("limit")), Number(form.get("days"))))
      setEditingTerms(false);
  };

  return (
    <Modal
      title={c.name}
      description={
        [c.phone, c.email, [c.address, c.town].filter(Boolean).join(", ")]
          .filter(Boolean)
          .join(" · ") || "No contact details"
      }
      onClose={onClose}
    >
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          ["Spent", formatKes(c.total_spent)],
          ["Visits", String(c.orders)],
          ["Owes", formatKes(c.balance)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
              className={`font-semibold tabular-nums ${label === "Owes" && c.overdue > 0 ? "text-rose-600" : ""}`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">Credit account</p>
            {hasCredit ? (
              <p className="mt-0.5 text-muted-foreground">
                Limit {formatKes(c.credit_limit ?? 0)} · {c.terms_days} day terms ·{" "}
                <span className="font-medium text-foreground">
                  {formatKes(available)} available
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-muted-foreground">Not offered credit yet.</p>
            )}
            {c.overdue > 0 && (
              <p className="mt-1 font-medium text-rose-600">
                {formatKes(c.overdue)} is overdue. New credit is blocked until it is paid.
              </p>
            )}
          </div>
          {canManage && !editingTerms && (
            <Button size="sm" variant="outline" onClick={() => setEditingTerms(true)}>
              {hasCredit ? "Edit terms" : "Enable credit"}
            </Button>
          )}
        </div>
        {editingTerms && (
          <form onSubmit={submitTerms} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Credit limit (KES)</span>
              <Input
                name="limit"
                type="number"
                min="0"
                step="0.01"
                defaultValue={c.credit_limit ?? 0}
                required
                className="h-9 w-36"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Payment terms (days)</span>
              <Input
                name="days"
                type="number"
                min="0"
                max="365"
                step="1"
                defaultValue={c.terms_days ?? 30}
                required
                className="h-9 w-32"
              />
            </label>
            <Button type="submit" size="sm" disabled={saving}>
              {saving && <LoaderCircle className="animate-spin" />} Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingTerms(false)}>
              Cancel
            </Button>
          </form>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {c.balance > 0 && <Button onClick={() => setPaying(!paying)}>Record payment</Button>}
        {c.balance > 0 && phone && (
          <Button variant="outline" asChild>
            <a
              href={`https://wa.me/${phone}?text=${encodeURIComponent(reminderMessage({ customer: c.name, business, owed: c.balance, overdue: c.overdue }))}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle /> Send reminder
            </a>
          </Button>
        )}
        <Button variant="ghost" onClick={onEdit}>
          <Pencil /> Edit
        </Button>
        {canManage && (
          <Button variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={onDelete}>
            <Trash2 /> Delete
          </Button>
        )}
      </div>

      {paying && (
        <form onSubmit={submitPay} className="space-y-3 rounded-xl border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">
            Cash received is applied to the oldest unpaid invoices first. The customer owes{" "}
            {formatKes(c.balance)}.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Amount (KES)</span>
              <Input
                name="amount"
                type="number"
                min="0.01"
                max={c.balance}
                step="0.01"
                required
                autoFocus
                className="h-9 w-36"
              />
            </label>
            <label className="min-w-40 flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">Note (optional)</span>
              <Input
                name="reference"
                maxLength={120}
                placeholder="e.g. Paid at the till"
                className="h-9"
              />
            </label>
            <Button type="submit" disabled={saving}>
              {saving && <LoaderCircle className="animate-spin" />} Save payment
            </Button>
          </div>
        </form>
      )}

      <div className="flex gap-1 border-b text-sm">
        {(["statement", "purchases"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 font-medium ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t === "statement" ? "Credit statement" : "Purchases"}
          </button>
        ))}
      </div>

      {tab === "statement" ? (
        entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No credit activity yet.</p>
        ) : (
          <ul className="max-h-64 divide-y overflow-y-auto rounded-xl border text-sm">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {KIND[e.kind]}
                    {e.receipt_no ? ` · ${e.receipt_no}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {when(e.created_at)}
                    {e.reference || e.note ? ` · ${e.reference ?? e.note}` : ""}
                  </span>
                </span>
                <span className="text-right">
                  <span
                    className={`block font-medium tabular-nums ${e.amount < 0 ? "text-emerald-700" : ""}`}
                  >
                    {e.amount < 0 ? "−" : "+"}
                    {formatKes(Math.abs(e.amount))}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Balance {formatKes(e.balance_after)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )
      ) : sales.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No purchases recorded for this customer yet.
        </p>
      ) : (
        <ul className="max-h-64 divide-y overflow-y-auto rounded-xl border text-sm">
          {sales.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onOpenSale(s.id)}
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{s.receipt_no}</span>
                  <span className="text-xs text-muted-foreground">
                    {when(s.created_at)}
                    {s.credit_outstanding > 0
                      ? ` · ${formatKes(s.credit_outstanding)} unpaid${s.due_date ? `, due ${s.due_date}` : ""}`
                      : ""}
                  </span>
                </span>
                <span className="font-medium tabular-nums">{formatKes(s.total)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
