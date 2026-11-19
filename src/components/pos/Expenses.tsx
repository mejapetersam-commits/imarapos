import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import type { ExpenseRow } from "@/api/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKes } from "@/lib/format";
import { presetRange, type Preset } from "@/lib/report";

type Props = {
  expenses: ExpenseRow[];
  loading: boolean;
  onLoad: (from: string, to: string) => void;
  onAdd: () => void;
  onDelete: (expense: ExpenseRow) => void;
};

const PRESETS: [Preset, string][] = [
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["month", "This month"],
  ["last_month", "Last month"],
];

export function Expenses({ expenses, loading, onLoad, onAdd, onDelete }: Props) {
  const [preset, setPreset] = useState<Preset>("month");
  const range = useMemo(() => presetRange(preset), [preset]);
  useEffect(() => onLoad(range.from, range.to), [range.from, range.to]);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Rent, wages, transport and other costs. They are subtracted from gross profit in
            Reports.
          </p>
        </div>
        <Button onClick={onAdd}>
          <Plus /> Add expense
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPreset(id)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${preset === id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Total spent</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatKes(total)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {expenses.length} {expenses.length === 1 ? "entry" : "entries"}
            </p>
          </div>
          {byCategory.length > 0 && (
            <div className="rounded-2xl border bg-card p-5 shadow-sm">
              <p className="text-sm font-medium">By category</p>
              <ul className="mt-3 space-y-2 text-sm">
                {byCategory.map(([c, a]) => (
                  <li key={c} className="flex justify-between">
                    <span className="text-muted-foreground">{c}</span>
                    <span className="tabular-nums">{formatKes(a)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
              <LoaderCircle className="animate-spin" size={18} /> Loading…
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-medium">No expenses in this period</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Record costs so profit reports are accurate.
              </p>
              <Button className="mt-5" onClick={onAdd}>
                <Plus /> Add expense
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-center gap-4 p-4">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{e.category}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(`${e.spent_on}T00:00:00`).toLocaleDateString("en-KE", {
                        dateStyle: "medium",
                      })}
                      {e.description ? ` · ${e.description}` : ""}
                      {e.created_by_name ? ` · ${e.created_by_name}` : ""}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatKes(e.amount)}</span>
                  <button
                    aria-label={`Delete ${e.category} expense`}
                    onClick={() => onDelete(e)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
