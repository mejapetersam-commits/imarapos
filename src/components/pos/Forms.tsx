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
import type { Category, Product } from "./types";

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
      <DialogContent className="sm:max-w-lg">
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

const selectClass = "h-10 w-full rounded-lg border bg-background px-3 text-sm";

export function BusinessForm({
  onSubmit,
  onCancel,
  canCancel,
}: {
  onSubmit: Submit;
  onCancel: () => void;
  canCancel: boolean;
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
          <Button type="submit">Create business</Button>
        </div>
      </form>
    </Modal>
  );
}

export function CategoryForm({
  onSubmit,
  onClose,
  categories,
}: {
  onSubmit: Submit;
  onClose: () => void;
  categories: Category[];
}) {
  return (
    <Modal
      title="Add category"
      description="Categories group products on the inventory list."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          onSubmit(e);
          e.currentTarget.reset();
        }}
        className="space-y-4"
      >
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
          <Button type="submit">Add category</Button>
        </div>
      </form>
    </Modal>
  );
}

export function ProductForm({
  categories,
  onSubmit,
  onClose,
}: {
  categories: Category[];
  onSubmit: Submit;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Add product"
      description="Prices are in KES. Opening stock is recorded in the movement history."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Product name">
          <Input name="name" required maxLength={160} autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU">
            <Input name="sku" required maxLength={64} />
          </Field>
          <Field label="Barcode (optional)">
            <Input name="barcode" maxLength={64} inputMode="numeric" />
          </Field>
        </div>
        <Field label="Category">
          <select name="categoryId" className={selectClass} defaultValue="">
            <option value="">Uncategorised</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cost price">
            <Input name="costPrice" type="number" min="0" step="0.01" defaultValue="0" required />
          </Field>
          <Field label="Selling price">
            <Input
              name="sellingPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              required
            />
          </Field>
          <Field label="Opening stock">
            <Input name="initialStock" type="number" min="0" step="any" defaultValue="0" required />
          </Field>
          <Field label="Low-stock alert at" hint="Alert when stock falls to this level.">
            <Input name="threshold" type="number" min="0" step="any" defaultValue="5" required />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save product</Button>
        </div>
      </form>
    </Modal>
  );
}

export function StockForm({
  product,
  onSubmit,
  onClose,
}: {
  product: Product;
  onSubmit: Submit;
  onClose: () => void;
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
          <Button type="submit">Update stock</Button>
        </div>
      </form>
    </Modal>
  );
}
