import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ShiftDetail } from "@/api/functions";
import { formatKes } from "@/lib/format";
import { shiftDuration, varianceInfo } from "@/lib/shift";
import { Modal } from "./Forms";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });

export function ShiftReport({ detail: d, onClose }: { detail: ShiftDetail; onClose: () => void }) {
  const s = d.shift;
  const b = d.breakdown;
  const v = varianceInfo(s.variance);
  const lines: [string, number][] = [
    ["Opening cash", b.opening],
    ["Cash sales", b.cash_sales],
    ["Customer repayments (cash)", b.credit_repayments],
    ["Cash put in", b.pay_ins],
    ["Cash taken out", -b.pay_outs],
    ["Cash refunds", -b.cash_refunds],
  ];
  return (
    <Modal title={s.status === "open" ? "Shift in progress" : "Shift report"} onClose={onClose}>
      <div className="doc-print rounded-xl border bg-white p-5 text-sm text-black">
        <p className="text-base font-bold">{d.business}</p>
        <p className="text-black/70">
          {s.status === "open" ? "Shift report (not yet closed)" : "End-of-shift report"}
        </p>
        <div className="mt-3 grid gap-x-6 gap-y-1 text-black/80 sm:grid-cols-2">
          <p>
            Cashier: <span className="font-medium">{s.cashier ?? "Team member"}</span>
          </p>
          <p>
            Duration: <span className="font-medium">{shiftDuration(s.opened_at, s.closed_at)}</span>
          </p>
          <p>Opened: {when(s.opened_at)}</p>
          <p>Closed: {s.closed_at ? when(s.closed_at) : "—"}</p>
        </div>
        <p className="mt-3 text-black/80">
          Sales: <span className="font-medium">{d.sales_count}</span> · total{" "}
          {formatKes(d.sales_total)} (all payment methods)
        </p>
        <table className="mt-4 w-full">
          <tbody className="divide-y">
            {lines.map(([label, value]) => (
              <tr key={label}>
                <td className="py-1.5 text-black/70">{label}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {value < 0 ? "−" : ""}
                  {formatKes(Math.abs(value))}
                </td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="py-2">Expected in drawer</td>
              <td className="py-2 text-right tabular-nums">
                {formatKes(s.expected_cash ?? s.live_expected ?? b.expected)}
              </td>
            </tr>
            {s.status === "closed" && (
              <tr>
                <td className="py-1.5 text-black/70">Counted</td>
                <td className="py-1.5 text-right tabular-nums">{formatKes(s.counted_cash ?? 0)}</td>
              </tr>
            )}
            {s.status === "closed" && (
              <tr className="font-bold">
                <td className="py-2">Result</td>
                <td className="py-2 text-right">{v.label}</td>
              </tr>
            )}
          </tbody>
        </table>
        {d.movements.length > 0 && (
          <div className="mt-4">
            <p className="font-medium">Cash movements</p>
            <ul className="mt-1 divide-y text-black/80">
              {d.movements.map((m) => (
                <li key={m.id} className="flex justify-between gap-3 py-1.5">
                  <span>
                    {m.kind === "pay_in" ? "In" : "Out"} · {m.reason ?? "No reason given"}{" "}
                    <span className="text-black/50">
                      ({when(m.created_at)}
                      {m.by ? `, ${m.by}` : ""})
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {m.kind === "pay_in" ? "+" : "−"}
                    {formatKes(m.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {s.notes && <p className="mt-4 text-black/70">Notes: {s.notes}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => window.print()}>
          <Printer /> Print
        </Button>
        <Button onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
