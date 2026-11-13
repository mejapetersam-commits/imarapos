import { LoaderCircle, Mail, MapPin, Pencil, Phone, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Supplier } from "./types";

type Props = {
  suppliers: Supplier[];
  loading: boolean;
  canManage: boolean;
  onAdd: () => void;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
};

export function Suppliers(p: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            {p.suppliers.length} {p.suppliers.length === 1 ? "supplier" : "suppliers"}
          </p>
        </div>
        {p.canManage && (
          <Button onClick={p.onAdd}>
            <Truck /> Add supplier
          </Button>
        )}
      </div>

      {p.loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card p-12 text-sm text-muted-foreground">
          <LoaderCircle className="animate-spin" size={18} /> Loading suppliers…
        </div>
      ) : p.suppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center">
          <p className="font-medium">No suppliers yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add the businesses you buy stock from, then link them to products.
          </p>
          {p.canManage && (
            <Button className="mt-5" onClick={p.onAdd}>
              <Truck /> Add supplier
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {p.suppliers.map((s) => (
            <li key={s.id} className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{s.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {s.product_count} {s.product_count === 1 ? "product" : "products"} linked
                  </p>
                </div>
                {p.canManage && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => p.onEdit(s)}
                      aria-label={`Edit ${s.name}`}
                      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => p.onDelete(s)}
                      aria-label={`Delete ${s.name}`}
                      className="rounded-md p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                {s.phone && (
                  <p className="flex items-center gap-2">
                    <Phone size={14} /> {s.phone}
                  </p>
                )}
                {s.email && (
                  <p className="flex items-center gap-2">
                    <Mail size={14} /> <span className="truncate">{s.email}</span>
                  </p>
                )}
                {s.address && (
                  <p className="flex items-center gap-2">
                    <MapPin size={14} /> {s.address}
                  </p>
                )}
                {!s.phone && !s.email && !s.address && <p>No contact details yet.</p>}
              </div>
              {s.notes && (
                <p className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  {s.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
