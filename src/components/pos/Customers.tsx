import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Crown,
  LoaderCircle,
  Repeat,
  Search,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CreditSummary, CustomerRow } from "@/api/functions";
import { formatKes } from "@/lib/format";

type Props = {
  customers: CustomerRow[];
  summary: CreditSummary | null;
  loading: boolean;
  onAdd: () => void;
  onOpen: (customer: CustomerRow) => void;
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-KE", { dateStyle: "medium" }) : "—";

export function Customers({ customers, summary, loading, onAdd, onOpen }: Props) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? customers.filter((c) =>
          [c.name, c.phone, c.email, c.town].some((v) => v?.toLowerCase().includes(term)),
        )
      : customers;
  }, [customers, query]);
  const topSpenders = useMemo(
    () =>
      [...customers]
        .filter((c) => c.total_spent > 0)
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 5),
    [customers],
  );
  const mostFrequent = useMemo(
    () =>
      [...customers]
        .filter((c) => c.orders > 0)
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5),
    [customers],
  );

  const cards = [
    {
      label: "Owed to you",
      value: formatKes(summary?.outstanding ?? 0),
      note: `${customers.filter((c) => c.balance > 0).length} customers with a balance`,
      icon: Wallet,
      tone: "bg-amber-100 text-amber-700",
    },
    {
      label: "Overdue",
      value: formatKes(summary?.overdue ?? 0),
      note: (summary?.overdue ?? 0) > 0 ? "Past the payment date" : "Nothing overdue",
      icon: AlertTriangle,
      tone:
        (summary?.overdue ?? 0) > 0
          ? "bg-rose-100 text-rose-700"
          : "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Credit customers",
      value: String(summary?.creditCustomers ?? 0),
      note: "With a credit limit",
      icon: Users,
      tone: "bg-sky-100 text-sky-700",
    },
    {
      label: "Customers",
      value: String(customers.length),
      note: "In your address book",
      icon: UserPlus,
      tone: "bg-violet-100 text-violet-700",
    },
  ];
  const aging = summary?.aging;
  const agingTotal = aging ? aging.not_due + aging.d1_30 + aging.d31_60 + aging.d61_plus : 0;
  const buckets = aging
    ? ([
        ["Not yet due", aging.not_due, "bg-emerald-500"],
        ["1–30 days late", aging.d1_30, "bg-amber-400"],
        ["31–60 days late", aging.d31_60, "bg-orange-500"],
        ["61+ days late", aging.d61_plus, "bg-rose-600"],
      ] as const)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Address book, purchase history and credit accounts.
          </p>
        </div>
        <Button onClick={onAdd}>
          <UserPlus /> Add customer
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, note, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className={`flex size-9 items-center justify-center rounded-xl ${tone}`}>
                <Icon size={18} />
              </span>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{note}</p>
          </div>
        ))}
      </div>

      {agingTotal > 0 && (
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Credit ageing</h2>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
            {buckets.map(
              ([label, amount, color]) =>
                amount > 0 && (
                  <div
                    key={label}
                    className={color}
                    style={{ width: `${(amount / agingTotal) * 100}%` }}
                    title={`${label}: ${formatKes(amount)}`}
                  />
                ),
            )}
          </div>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
            {buckets.map(([label, amount, color]) => (
              <li key={label} className="flex items-center gap-2">
                <span className={`size-2.5 rounded-full ${color}`} />
                <span className="text-muted-foreground">{label}</span>
                <span className="ml-auto font-medium tabular-nums">{formatKes(amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(topSpenders.length > 0 || mostFrequent.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["Top spenders", Crown, topSpenders.map((c) => [c, formatKes(c.total_spent)] as const)],
            [
              "Most frequent",
              Repeat,
              mostFrequent.map(
                (c) => [c, `${c.orders} ${c.orders === 1 ? "visit" : "visits"}`] as const,
              ),
            ],
          ].map(([title, Icon, list]) => {
            const I = Icon as typeof Crown;
            return (
              <section key={String(title)} className="rounded-2xl border bg-card p-5 shadow-sm">
                <h2 className="flex items-center gap-2 font-semibold">
                  <I size={16} className="text-primary" /> {String(title)}
                </h2>
                <ol className="mt-3 space-y-2 text-sm">
                  {(list as (readonly [CustomerRow, string])[]).map(([c, value], i) => (
                    <li key={c.id}>
                      <button
                        onClick={() => onOpen(c)}
                        className="flex w-full items-center gap-3 text-left hover:text-primary"
                      >
                        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                        <span className="font-medium tabular-nums">{value}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone, email or town"
          className="h-10 bg-card pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <LoaderCircle className="animate-spin" size={18} /> Loading customers…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-medium">
              {customers.length === 0 ? "No customers yet" : "No customers match your search"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {customers.length === 0
                ? "Add customers to track their purchases and offer credit."
                : "Try a different search."}
            </p>
            {customers.length === 0 && (
              <Button className="mt-5" onClick={onAdd}>
                <UserPlus /> Add customer
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onOpen(c)}
                  className="flex w-full flex-wrap items-center gap-x-6 gap-y-1 p-4 text-left hover:bg-muted/40"
                >
                  <span className="min-w-0 flex-1 basis-48">
                    <span className="block font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {[c.phone, c.town].filter(Boolean).join(" · ") || "No contact details"}
                    </span>
                  </span>
                  <span className="w-28 text-right text-sm">
                    <span className="block font-medium tabular-nums">
                      {formatKes(c.total_spent)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.orders} {c.orders === 1 ? "visit" : "visits"} · {when(c.last_purchase)}
                    </span>
                  </span>
                  <span className="w-36 text-right text-sm">
                    {(c.credit_limit ?? 0) > 0 ? (
                      <>
                        <span
                          className={`block font-medium tabular-nums ${c.overdue > 0 ? "text-rose-600" : ""}`}
                        >
                          {formatKes(c.balance)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          of {formatKes(c.credit_limit ?? 0)} limit
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">No credit</span>
                    )}
                  </span>
                  <span className="w-20 text-right">
                    {c.overdue > 0 ? (
                      <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                        Overdue
                      </span>
                    ) : c.balance > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        Owes
                      </span>
                    ) : null}
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
