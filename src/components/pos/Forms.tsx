import { LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatQuantity } from "@/lib/format";
import type { Category, Product, Supplier } from "./types";

type Submit = (event: React.FormEvent<HTMLFormElement>) => void;

export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Submit({ saving, children }: { saving: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={saving}>
      {saving && <LoaderCircle className="animate-spin" />} {children}
    </Button>
  );
}

const selectClass = "h-10 w-full rounded-lg border bg-background px-3 text-sm";

export function BusinessForm({
  onSubmit,
  onCancel,
  canCancel,
  saving,
}: {
  onSubmit: Submit;
  onCancel: () => void;
  canCancel: boolean;
  saving: boolean;
}) {
  return (
    <Modal
      title="Create your business"
      description="Each business has its own products, stock and staff."
      onClose={canCancel ? onCancel : () => undefined}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Business name">
          <Input
            name="businessName"
            required
            maxLength={120}
            placeholder="e.g. Mama Njeri Supplies"
            autoFocus
          />
        </Field>
        <div className="flex justify-end gap-2">
          {canCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Submit saving={saving}>Create business</Submit>
        </div>
      </form>
    </Modal>
  );
}

export function CategoryForm({
  onSubmit,
  onClose,
  categories,
  saving,
}: {
  onSubmit: Submit;
  onClose: () => void;
  categories: Category[];
  saving: boolean;
}) {
  return (
    <Modal
      title="Add category"
      description="Categories group products on the inventory list."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Category name">
          <Input
            name="categoryName"
            required
            maxLength={80}
            placeholder="e.g. Beverages"
            autoFocus
          />
        </Field>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <span key={c.id} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                {c.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Done
          </Button>
          <Submit saving={saving}>Add category</Submit>
        </div>
      </form>
    </Modal>
  );
}

export function ProductForm({
  product,
  categories,
  suppliers,
  onSubmit,
  onClose,
  saving,
}: {
  product?: Product | null;
  categories: Category[];
  suppliers: Supplier[];
  onSubmit: Submit;
  onClose: () => void;
  saving: boolean;
}) {
  const editing = Boolean(product);
  return (
    <Modal
      title={editing ? "Edit product" : "Add product"}
      description={
        editing
          ? "Stock quantities change through Adjust stock, so every movement is recorded."
          : "Prices are in KES. Opening stock is recorded in the movement history."
      }
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Product name">
          <Input name="name" required maxLength={160} defaultValue={product?.name} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU">
            <Input name="sku" required maxLength={64} defaultValue={product?.sku} />
          </Field>
          <Field label="Barcode (optional)">
            <Input
              name="barcode"
              maxLength={64}
              inputMode="numeric"
              defaultValue={product?.barcode ?? ""}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select
              name="categoryId"
              className={selectClass}
              defaultValue={product?.category_id ?? ""}
            >
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Supplier">
            <select
              name="supplierId"
              className={selectClass}
              defaultValue={product?.supplier_id ?? ""}
            >
              <option value="">None</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cost price">
            <Input
              name="costPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product?.cost_price ?? 0}
              required
            />
          </Field>
          <Field label="Selling price">
            <Input
              name="sellingPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product?.selling_price ?? 0}
              required
            />
          </Field>
          {!editing && (
            <Field label="Opening stock">
              <Input
                name="initialStock"
                type="number"
                min="0"
                step="any"
                defaultValue="0"
                required
              />
            </Field>
          )}
          <Field label="Low-stock alert at" hint="Alert when stock falls to this level.">
            <Input
              name="threshold"
              type="number"
              min="0"
              step="any"
              defaultValue={product?.low_stock_threshold ?? 5}
              required
            />
          </Field>
        </div>
        {editing && (
          <label className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={product?.active}
              className="mt-0.5 size-4 accent-emerald-700"
            />
            <span>
              <span className="block font-medium">Active product</span>
              <span className="text-xs text-muted-foreground">
                Untick to archive it. Archived products keep their history but can’t be sold.
              </span>
            </span>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Submit saving={saving}>{editing ? "Save changes" : "Save product"}</Submit>
        </div>
      </form>
    </Modal>
  );
}

export function StockForm({
  product,
  onSubmit,
  onClose,
  saving,
}: {
  product: Product;
  onSubmit: Submit;
  onClose: () => void;
  saving: boolean;
}) {
  const qty = product.inventory?.quantity_on_hand ?? 0;
  return (
    <Modal
      title={`Adjust stock · ${product.name}`}
      description={`Currently ${formatQuantity(qty)} in stock. Use a negative number to remove stock.`}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Change in quantity" hint="e.g. 12 to add, -3 to remove">
          <Input name="quantity" type="number" step="any" required autoFocus />
        </Field>
        <Field label="Reason (optional)">
          <Input name="reason" maxLength={200} placeholder="e.g. Damaged, recount, new delivery" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Submit saving={saving}>Update stock</Submit>
        </div>
      </form>
    </Modal>
  );
}

export function SupplierForm({
  supplier,
  onSubmit,
  onClose,
  saving,
}: {
  supplier: Supplier | null;
  onSubmit: Submit;
  onClose: () => void;
  saving: boolean;
}) {
  return (
    <Modal
      title={supplier ? "Edit supplier" : "Add supplier"}
      description="Who you buy stock from. Link suppliers to products from the product form."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Supplier name">
          <Input name="name" required maxLength={120} defaultValue={supplier?.name} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <Input
              name="phone"
              type="tel"
              maxLength={40}
              defaultValue={supplier?.phone ?? ""}
              placeholder="+254 7…"
            />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" maxLength={160} defaultValue={supplier?.email ?? ""} />
          </Field>
        </div>
        <Field label="Address">
          <Input name="address" maxLength={300} defaultValue={supplier?.address ?? ""} />
        </Field>
        <Field label="Notes (optional)">
          <Input
            name="notes"
            maxLength={500}
            defaultValue={supplier?.notes ?? ""}
            placeholder="Payment terms, delivery days…"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Submit saving={saving}>{supplier ? "Save changes" : "Add supplier"}</Submit>
        </div>
      </form>
    </Modal>
  );
}
