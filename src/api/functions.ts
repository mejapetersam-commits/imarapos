import { createServerFn } from "@tanstack/react-start";
import type { PoolClient } from "@neondatabase/serverless";
import { z } from "zod";
import { requireRole, withDb, type Role } from "@/server/db";
import { userIdFromToken } from "@/server/verify-token";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const uuid = z.string().uuid();
const base = { token: z.string().min(10) };
const inBusiness = { ...base, businessId: uuid };
const MANAGERS: readonly Role[] = ["owner", "manager"];
const ANYONE: readonly Role[] = ["owner", "manager", "cashier"];

function friendly(error: unknown): string {
  const e = error as { code?: string; message?: string; constraint?: string };
  if (e.code === "23505") {
    if (e.constraint?.includes("sku")) return "That SKU is already in use.";
    if (e.constraint?.includes("barcode")) return "That barcode is already in use.";
    return "That already exists.";
  }
  if (e.code === "23503")
    return "This is still linked to products or orders, so it can’t be deleted.";
  if (e.code === "42501") return "You do not have permission to do that.";
  if (e.code === "23514") return "One of the values is not allowed (check prices and quantities).";
  if (e.code === "P0001" || e.message?.startsWith("You do not have"))
    return e.message ?? "Request failed.";
  if (e.message === "Invalid session." || /JWT|JWS|signature|exp/.test(e.message ?? ""))
    return "Your session has expired. Please sign in again.";
  console.error(error);
  return "Something went wrong. Please try again.";
}

async function run<T>(
  token: string,
  businessId: string | null,
  roles: readonly Role[] | null,
  fn: (db: PoolClient, userId: string) => Promise<T>,
): Promise<Result<T>> {
  try {
    const userId = await userIdFromToken(token);
    const data = await withDb(userId, businessId, async (db) => {
      if (roles) await requireRole(db, [...roles]);
      return fn(db, userId);
    });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: friendly(error) };
  }
}

const notFound = (what: string) =>
  Object.assign(new Error(`${what} not found.`), { code: "P0001" });

export const listBusinesses = createServerFn({ method: "POST" })
  .validator(z.object(base))
  .handler(({ data }) =>
    run(
      data.token,
      null,
      null,
      async (db) =>
        (await db.query("SELECT id, name, currency FROM businesses ORDER BY created_at")).rows as {
          id: string;
          name: string;
          currency: string;
        }[],
    ),
  );

export const createBusiness = createServerFn({ method: "POST" })
  .validator(z.object({ ...base, name: z.string().trim().min(1).max(120) }))
  .handler(({ data }) =>
    run(data.token, null, null, async (db) => {
      const created = await db.query<{ id: string }>("SELECT create_business($1) AS id", [
        data.name,
      ]);
      return (
        await db.query("SELECT id, name, currency FROM businesses WHERE id = $1", [
          created.rows[0]!.id,
        ])
      ).rows[0] as { id: string; name: string; currency: string };
    }),
  );

export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  supplier_id: string | null;
  cost_price: number;
  selling_price: number;
  low_stock_threshold: number;
  active: boolean;
  quantity_on_hand: number | null;
};
export type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  product_count: number;
};

export const loadBusinessData = createServerFn({ method: "POST" })
  .validator(z.object(inBusiness))
  .handler(({ data }) =>
    run(data.token, data.businessId, ANYONE, async (db) => {
      const products = await db.query(
        `SELECT p.id, p.name, p.sku, p.barcode, p.category_id, p.supplier_id, p.cost_price::float8 AS cost_price, p.selling_price::float8 AS selling_price,
                p.low_stock_threshold::float8 AS low_stock_threshold, p.active, i.quantity_on_hand::float8 AS quantity_on_hand
           FROM products p LEFT JOIN inventory i ON i.product_id = p.id AND i.business_id = p.business_id
          ORDER BY p.active DESC, p.name`,
      );
      const categories = await db.query("SELECT id, name FROM categories ORDER BY name");
      const suppliers = await db.query(
        `SELECT s.id, s.name, s.phone, s.email, s.address, s.notes,
                (SELECT count(*)::int FROM products p WHERE p.supplier_id = s.id) AS product_count
           FROM suppliers s ORDER BY s.name`,
      );
      const role = (await db.query("SELECT app_role() AS role")).rows[0].role as Role;
      const sales = await db.query(
        "SELECT count(*)::int AS count, COALESCE(sum(total), 0)::float8 AS revenue FROM sales WHERE status = 'completed'",
      );
      const customers = await db.query("SELECT count(*)::int AS count FROM customers");
      return {
        role,
        products: products.rows as ProductRow[],
        categories: categories.rows as { id: string; name: string }[],
        suppliers: suppliers.rows as SupplierRow[],
        salesCount: sales.rows[0].count as number,
        revenue: sales.rows[0].revenue as number,
        customersCount: customers.rows[0].count as number,
      };
    }),
  );

export const createCategory = createServerFn({ method: "POST" })
  .validator(z.object({ ...inBusiness, name: z.string().trim().min(1).max(80) }))
  .handler(({ data }) =>
    run(
      data.token,
      data.businessId,
      MANAGERS,
      async (db) =>
        (
          await db.query(
            "INSERT INTO categories (business_id, name) VALUES (app_business(), $1) RETURNING id, name",
            [data.name],
          )
        ).rows[0] as { id: string; name: string },
    ),
  );

const productFields = {
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(64),
  barcode: z.string().trim().max(64).nullable(),
  categoryId: uuid.nullable(),
  supplierId: uuid.nullable(),
  costPrice: z.number().finite().min(0),
  sellingPrice: z.number().finite().min(0),
  lowStockThreshold: z.number().finite().min(0),
};

export const createProduct = createServerFn({ method: "POST" })
  .validator(
    z.object({ ...inBusiness, ...productFields, initialStock: z.number().finite().min(0) }),
  )
  .handler(({ data }) =>
    run(data.token, data.businessId, MANAGERS, async (db) => {
      const id = (
        await db.query("SELECT add_product_with_stock($1,$2,$3,$4,$5,$6,$7,$8) AS id", [
          data.name,
          data.sku,
          data.barcode,
          data.categoryId,
          data.costPrice,
          data.sellingPrice,
          data.lowStockThreshold,
          data.initialStock,
        ])
      ).rows[0].id as string;
      if (data.supplierId)
        await db.query("UPDATE products SET supplier_id = $2 WHERE id = $1", [id, data.supplierId]);
      return id;
    }),
  );

export const updateProduct = createServerFn({ method: "POST" })
  .validator(z.object({ ...inBusiness, ...productFields, productId: uuid, active: z.boolean() }))
  .handler(({ data }) =>
    run(data.token, data.businessId, MANAGERS, async (db) => {
      await db.query("SELECT update_product($1,$2,$3,$4,$5,$6,$7,$8,$9)", [
        data.productId,
        data.name,
        data.sku,
        data.barcode,
        data.categoryId,
        data.costPrice,
        data.sellingPrice,
        data.lowStockThreshold,
        data.active,
      ]);
      await db.query("UPDATE products SET supplier_id = $2 WHERE id = $1", [
        data.productId,
        data.supplierId,
      ]);
      return true as const;
    }),
  );

export const adjustStock = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ...inBusiness,
      productId: uuid,
      delta: z
        .number()
        .finite()
        .refine((n) => n !== 0),
      note: z.string().trim().max(200).optional(),
    }),
  )
  .handler(({ data }) =>
    run(data.token, data.businessId, MANAGERS, async (db) =>
      Number(
        (
          await db.query("SELECT adjust_inventory($1, $2, 'adjustment', $3) AS qty", [
            data.productId,
            data.delta,
            data.note ?? null,
          ])
        ).rows[0].qty,
      ),
    ),
  );

const supplierFields = {
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).nullable(),
  email: z.string().trim().max(160).nullable(),
  address: z.string().trim().max(300).nullable(),
  notes: z.string().trim().max(500).nullable(),
};

export const createSupplier = createServerFn({ method: "POST" })
  .validator(z.object({ ...inBusiness, ...supplierFields }))
  .handler(({ data }) =>
    run(
      data.token,
      data.businessId,
      MANAGERS,
      async (db) =>
        (
          await db.query(
            "INSERT INTO suppliers (business_id, name, phone, email, address, notes) VALUES (app_business(), $1, $2, $3, $4, $5) RETURNING id",
            [data.name, data.phone, data.email, data.address, data.notes],
          )
        ).rows[0].id as string,
    ),
  );

export const updateSupplier = createServerFn({ method: "POST" })
  .validator(z.object({ ...inBusiness, supplierId: uuid, ...supplierFields }))
  .handler(({ data }) =>
    run(data.token, data.businessId, MANAGERS, async (db) => {
      const result = await db.query(
        "UPDATE suppliers SET name = $2, phone = $3, email = $4, address = $5, notes = $6 WHERE id = $1",
        [data.supplierId, data.name, data.phone, data.email, data.address, data.notes],
      );
      if (!result.rowCount) throw notFound("Supplier");
      return true as const;
    }),
  );

export const deleteSupplier = createServerFn({ method: "POST" })
  .validator(z.object({ ...inBusiness, supplierId: uuid }))
  .handler(({ data }) =>
    run(data.token, data.businessId, MANAGERS, async (db) => {
      const result = await db.query("DELETE FROM suppliers WHERE id = $1", [data.supplierId]);
      if (!result.rowCount) throw notFound("Supplier");
      return true as const;
    }),
  );
