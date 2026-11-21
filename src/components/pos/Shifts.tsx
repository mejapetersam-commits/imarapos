import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  LoaderCircle,
  LockKeyhole,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ShiftBreakdown, ShiftRow } from "@/api/functions";
import { formatKes } from "@/lib/format";
import { cashVariance, shiftDuration, varianceInfo } from "@/lib/shift";
import { Modal } from "./Forms";

type Props = {
  open: ShiftRow | null;
  breakdown: ShiftBreakdown | null;
  shifts: ShiftRow[];
  requireShift: boolean;
  isOwner: boolean;
  canManage: boolean;
  userId: string;
  loading: boolean;
  saving: boolean;
  onOpenShift: (openingFloat: number) => void;
  onMovement: (
    kind: "pay_in" | "pay_out",
    amount: number,
    reason: string | null,
  ) => Promise<boolean>;
  onCloseShift: (shiftId: string, counted: number, notes: string | null) => Promise<boolean>;
  onToggleRequire: (value: boolean) => void;
  onView: (shiftId: string) => void;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
const TONE = {
  ok: "bg-emerald-100 text-emerald-700",
  over: "bg-sky-100 text-sky-700",
  short: "bg-rose-100 text-rose-700",
} as const;

export function Shifts(p: Props) {
  const [movement, setMovement] = useState<"pay_in" | "pay_out" | null>(null);
  const [closing, setClosing] = useState<ShiftRow | null>(null);
  const [counted, setCounted] = useState("");
  const [floatValue, setFloatValue] = useState("");
  const others = p.shifts.filter((s) => s.status === "open" && s.id !== p.open?.id);

  const rows: [string, number, string?][] = p.breakdown
    ? [
        ["Opening cash", p.breakdown.opening],
        ["Cash sales", p.breakdown.cash_sales],
        ["Customer repayments (cash)", p.breakdown.credit_repayments],
        ["Cash put in", p.breakdown.pay_ins],
        ["Cash taken out", -p.breakdown.pay_outs],
        ["Cash refunds", -p.breakdown.cash_refunds],
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Shifts &amp; cash drawer
        </h1>
        <p className="text-sm text-muted-foreground">
          Open a shift with your starting cash, and count the drawer when you close it. Differences
          are recorded.
        </p>
      </div>

      {p.open && p.breakdown ? (
        <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-emerald-600" />
                </span>{" "}
                Your shift is open
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Since {when(p.open.opened_at)} · {shiftDuration(p.open.opened_at, null)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Cash that should be in the drawer</p>
              <p className="text-3xl font-semibold tabular-nums">
                {formatKes(p.breakdown.expected)}
              </p>
            </div>
          </div>
          <dl className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-dashed py-1.5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className={`tabular-nums ${value < 0 ? "text-rose-600" : ""}`}>
                  {value < 0 ? "−" : ""}
                  {formatKes(Math.abs(value))}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setMovement("pay_in")}>
              <ArrowDownToLine /> Cash in
            </Button>
            <Button variant="outline" onClick={() => setMovement("pay_out")}>
              <ArrowUpFromLine /> Cash out
            </Button>
            <Button
              className="ml-auto"
              onClick={() => {
                setCounted("");
                setClosing(p.open);
              }}
            >
              <LockKeyhole /> Close shift
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed bg-card p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock size={20} />
            </span>
            <div>
              <h2 className="font-semibold">No shift open</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {p.requireShift
                  ? "A shift is required before you can sell or handle cash."
                  : "Open a shift so your cash sales and drawer are tracked."}
              </p>
            </div>
          </div>
          <form
            className="mt-5 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              p.onOpenShift(Number(floatValue) || 0);
            }}
          >
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">
                Opening cash in the drawer (KES)
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={floatValue}
                onChange={(e) => setFloatValue(e.target.value)}
                placeholder="0"
                className="h-10 w-48"
                autoFocus
              />
            </label>
            <Button type="submit" disabled={p.saving}>
              {p.saving ? <LoaderCircle className="animate-spin" /> : <PlayCircle />} Open shift
            </Button>
          </form>
        </section>
      )}

      {p.isOwner && (
        <label className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-sm shadow-sm">
          <input
            type="checkbox"
            checked={p.requireShift}
            onChange={(e) => p.onToggleRequire(e.target.checked)}
            className="mt-0.5 size-4 accent-emerald-700"
          />
          <span>
            <span className="block font-medium">Require an open shift to sell or handle cash</span>
            <span className="text-xs text-muted-foreground">
              When on, sales, cash refunds and cash repayments are blocked until the person opens a
              shift. Every cash movement is then tied to a drawer count.
            </span>
          </span>
        </label>
      )}

      {p.canManage && others.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Open shifts</h2>
          <ul className="mt-2 divide-y divide-amber-200">
            {others.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{s.cashier ?? "Team member"}</span>
                  <span className="text-amber-800">
                    {" "}
                    · since {when(s.opened_at)} · {shiftDuration(s.opened_at, null)}
                  </span>
                </span>
                <span className="tabular-nums text-amber-900">
                  {formatKes(s.live_expected ?? 0)} expected
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCounted("");
                    setClosing(s);
                  }}
                >
                  Close shift
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">
          {p.canManage ? "Shift history" : "Your shift history"}
        </h2>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          {p.loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
              <LoaderCircle className="animate-spin" size={18} /> Loading…
            </div>
          ) : p.shifts.length === 0 ? (
            <p className="p-12 text-center text-sm text-muted-foreground">No shifts yet.</p>
          ) : (
            <ul className="divide-y">
              {p.shifts.map((s) => {
                const v = varianceInfo(s.variance);
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => p.onView(s.id)}
                      className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 p-4 text-left hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1 basis-44">
                        <span className="block font-medium">
                          {s.cashier ?? "Team member"}
                          {s.cashier_id === p.userId ? " (you)" : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {when(s.opened_at)} · {shiftDuration(s.opened_at, s.closed_at)}
                        </span>
                      </span>
                      {s.status === "open" ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Open
                        </span>
                      ) : (
                        <>
                          <span className="w-44 text-right text-xs text-muted-foreground">
                            Expected {formatKes(s.expected_cash ?? 0)}
                            <br />
                            Counted {formatKes(s.counted_cash ?? 0)}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[v.tone]}`}
                          >
                            {v.label}
                          </span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {movement && (
        <Modal
          title={movement === "pay_in" ? "Cash in" : "Cash out"}
          description={
            movement === "pay_in"
              ? "Money added to the drawer, such as a float top-up."
              : "Money taken from the drawer, such as paying a supplier or a bank drop. A reason is required."
          }
          onClose={() => setMovement(null)}
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await p.onMovement(
                  movement,
                  Number(f.get("amount")),
                  String(f.get("reason") ?? "").trim() || null,
                )
              )
                setMovement(null);
            }}
          >
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Amount (KES)</span>
              <Input name="amount" type="number" min="0.01" step="0.01" required autoFocus />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">
                Reason{movement === "pay_out" ? "" : " (optional)"}
              </span>
              <Input
                name="reason"
                maxLength={200}
                required={movement === "pay_out"}
                placeholder={
                  movement === "pay_out" ? "e.g. Paid for delivery" : "e.g. Float top-up"
                }
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setMovement(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={p.saving}>
                {p.saving && <LoaderCircle className="animate-spin" />} Record
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {closing && (
        <Modal
          title="Close shift"
          description={
            closing.cashier_id === p.userId
              ? "Count the cash in the drawer and enter the total."
              : `You are closing ${closing.cashier ?? "a team member"}’s shift.`
          }
          onClose={() => setClosing(null)}
        >
          {(() => {
            const expected =
              closing.live_expected ??
              (closing.id === p.open?.id ? (p.breakdown?.expected ?? 0) : 0);
            const diff = counted === "" ? null : cashVariance(Number(counted), expected);
            const v = varianceInfo(diff);
            return (
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (
                    await p.onCloseShift(
                      closing.id,
                      Number(counted),
                      String(f.get("notes") ?? "").trim() || null,
                    )
                  )
                    setClosing(null);
                }}
              >
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Cash counted (KES)</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={counted}
                    onChange={(e) => setCounted(e.target.value)}
                    autoFocus
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  The system expects {formatKes(expected)}. Count first, so the difference is
                  honest.
                </p>
                {diff !== null && (
                  <p className={`rounded-lg px-3 py-2 text-sm font-medium ${TONE[v.tone]}`}>
                    {v.label}
                  </p>
                )}
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Notes (optional)</span>
                  <Input name="notes" maxLength={300} placeholder="Explain any difference" />
                </label>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setClosing(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={p.saving || counted === ""}>
                    {p.saving && <LoaderCircle className="animate-spin" />} Close shift
                  </Button>
                </div>
              </form>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
