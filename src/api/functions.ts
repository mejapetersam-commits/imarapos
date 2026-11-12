import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireRole, withDb } from "@/server/db";
import { userIdFromToken } from "@/server/verify-token";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const uuid = z.string().uuid();
const base = { token: z.string().min(10) };
const inBusiness = { ...base, businessId: uuid };
const MANAGERS = ["owner", "manager"] as const;
const ANYONE = ["owner", "manager", "cashier"] as const;

function friendly(error: unknown): string {
  const e = error as { code?: string; message?: string; constraint?: string };
  if (e.code === "23505")
    return e.constraint?.includes("sku")
      ? "That SKU is already in use."
      : e.constraint?.includes("barcode")
        ? "That barcode is already in use."
        : "That already exists.";
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
  roles: readonly ("owner" | "manager" | "cashier")[] | null,
  fn: (db: import("@neondatabase/serverless").PoolClient, userId: string) => Promise<T>,
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

export const loadBusinessData = createServerFn({ method: "POST" })
  .validator(z.object(inBusiness))
  .handler(({ data }) =>
    run(data.token, data.businessId, ANYONE, async (db) => {
      const products = await db.query(
        `SELECT p.id, p.name, p.sku, p.barcode, p.category_id, p.cost_price::float8 AS cost_price, p.selling_price::float8 AS selling_price,
                p.low_stock_threshold::float8 AS low_stock_threshold, p.active, i.quantity_on_hand::float8 AS quantity_on_hand
           FROM products p LEFT JOIN inventory i ON i.product_id = p.id AND i.business_id = p.business_id
          WHERE p.active ORDER BY p.name`,
      );
      const categories = await db.query("SELECT id, name FROM categories ORDER BY name");
      const sales = await db.query(
        "SELECT count(*)::int AS count, COALESCE(sum(total), 0)::float8 AS revenue FROM sales WHERE status = 'completed'",
      );
      const customers = await db.query("SELECT count(*)::int AS count FROM customers");
      return {
        products: products.rows as {
          id: string;
          name: string;
          sku: string;
          barcode: string | null;
          category_id: string | null;
          cost_price: number;
          selling_price: number;
          low_stock_threshold: number;
          active: boolean;
          quantity_on_hand: number | null;
        }[],
        categories: categories.rows as { id: string; name: string }[],
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

export const createProduct = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ...inBusiness,
      name: z.string().trim().min(1).max(160),
      sku: z.string().trim().min(1).max(64),
      barcode: z.string().trim().max(64).nullable(),
      categoryId: uuid.nullable(),
      costPrice: z.number().finite().min(0),
      sellingPrice: z.number().finite().min(0),
      lowStockThreshold: z.number().finite().min(0),
      initialStock: z.number().finite().min(0),
    }),
  )
  .handler(({ data }) =>
    run(
      data.token,
      data.businessId,
      MANAGERS,
      async (db) =>
        (
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
        ).rows[0].id as string,
    ),
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
