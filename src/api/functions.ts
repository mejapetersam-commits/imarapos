import { createServerFn } from "@tanstack/react-start";
import type { PoolClient } from "@neondatabase/serverless";
import { z } from "zod";
import { requireRole, withDb, type Role } from "@/server/db";
import { hashInviteToken, newInviteToken } from "@/server/invite";
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
        `SELECT (SELECT count(*)::int FROM sales WHERE status IN ('completed', 'refunded')) AS count,
                ((SELECT COALESCE(sum(total), 0) FROM sales WHERE status IN ('completed', 'refunded'))
                 - (SELECT COALESCE(sum(amount), 0) FROM refunds))::float8 AS revenue`,
      );
      const customers = await db.query("SELECT count(*)::int AS count FROM customers");
      const credit = await db.query(
        `SELECT COALESCE((SELECT sum(balance) FROM credit_accounts), 0)::float8 AS outstanding,
                COALESCE((SELECT sum(credit_outstanding) FROM sales WHERE credit_outstanding > 0 AND due_date < current_date), 0)::float8 AS overdue`,
      );
      return {
        role,
        products: products.rows as ProductRow[],
        categories: categories.rows as { id: string; name: string }[],
        suppliers: suppliers.rows as SupplierRow[],
        salesCount: sales.rows[0].count as number,
        revenue: sales.rows[0].revenue as number,
        customersCount: customers.rows[0].count as number,
        creditOutstanding: credit.rows[0].outstanding as number,
        creditOverdue: credit.rows[0].overdue as number,
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

// ---- Team and invites -------------------------------------------------------------------------

const OWNER_ONLY: readonly Role[] = ["owner"];
const inviteToken = z.string().min(20).max(100);
const invalidInvite = () =>
  Object.assign(new Error("This invite is invalid or has expired"), { code: "P0001" });

export type TeamMember = {
  user_id: string;
  name: string | null;
  email: string;
  role: Role;
  active: boolean;
  joined_at: string;
};
export type PendingInvite = { id: string; email: string; role: Role; expires_at: string };

export const loadTeam = createServerFn({ method: "POST" })
  .validator(z.object(inBusiness))
  .handler(({ data }) =>
    run(data.token, data.businessId, MANAGERS, async (db, userId) => {
      const members = (
        await db.query("SELECT user_id, name, email, role, active, joined_at FROM list_team()")
      ).rows as TeamMember[];
      const invites = (
        await db.query(
          "SELECT id, email, role, expires_at FROM business_invites WHERE accepted_at IS NULL AND expires_at > now() ORDER BY created_at DESC",
        )
      ).rows as PendingInvite[];
      return { members, invites, me: userId };
    }),
  );

export const createInvite = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ...inBusiness,
      email: z.string().trim().toLowerCase().email().max(160),
      role: z.enum(["manager", "cashier"]),
    }),
  )
  .handler(({ data }) =>
    run(data.token, data.businessId, OWNER_ONLY, async (db) => {
      const existing = await db.query(
        "SELECT 1 FROM list_team() WHERE lower(email) = $1 AND active",
        [data.email],
      );
      if (existing.rowCount)
        throw Object.assign(new Error("That person is already on your team."), { code: "P0001" });
      await db.query(
        "DELETE FROM business_invites WHERE lower(email) = $1 AND accepted_at IS NULL",
        [data.email],
      );
      const secret = newInviteToken();
      await db.query(
        "INSERT INTO business_invites (business_id, email, role, token_hash, invited_by, expires_at) VALUES (app_business(), $1, $2, $3, app_user(), now() + interval '7 days')",
        [data.email, data.role, await hashInviteToken(secret)],
      );
      await db.query(
        "INSERT INTO audit_logs (business_id, actor_id, action, entity, detail) VALUES (app_business(), app_user(), 'invite.created', 'invite', $1)",
        [JSON.stringify({ email: data.email, role: data.role })],
      );
      return secret;
    }),
  );

export const revokeInvite = createServerFn({ method: "POST" })
  .validator(z.object({ ...inBusiness, inviteId: uuid }))
  .handler(({ data }) =>
    run(data.token, data.businessId, OWNER_ONLY, async (db) => {
      const result = await db.query(
        "DELETE FROM business_invites WHERE id = $1 AND accepted_at IS NULL",
        [data.inviteId],
      );
      if (!result.rowCount) throw notFound("Invite");
      return true as const;
    }),
  );

export const updateMember = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ...inBusiness,
      userId: uuid,
      role: z.enum(["owner", "manager", "cashier"]),
      active: z.boolean(),
    }),
  )
  .handler(({ data }) =>
    run(data.token, data.businessId, OWNER_ONLY, async (db) => {
      await db.query("SELECT update_member($1, $2, $3)", [data.userId, data.role, data.active]);
      return true as const;
    }),
  );

export const previewInvite = createServerFn({ method: "POST" })
  .validator(z.object({ ...base, inviteToken }))
  .handler(({ data }) =>
    run(data.token, null, null, async (db) => {
      const row = (
        await db.query("SELECT business_name, role, email FROM invite_preview($1)", [
          await hashInviteToken(data.inviteToken),
        ])
      ).rows[0];
      if (!row) throw invalidInvite();
      return row as { business_name: string; role: Role; email: string };
    }),
  );

export const acceptInvite = createServerFn({ method: "POST" })
  .validator(z.object({ ...base, inviteToken }))
  .handler(({ data }) =>
    run(
      data.token,
      null,
      null,
      async (db) =>
        (
          await db.query("SELECT accept_invite($1) AS id", [
            await hashInviteToken(data.inviteToken),
          ])
        ).rows[0].id as string,
    ),
  );

// ---- Sales, receipts and refunds ----------------------------------------------------------------

export type SaleListRow = {
  id: string;
  receipt_no: string | null;
  total: number;
  status: string;
  created_at: string;
  salesperson: string | null;
  customer: string | null;
  items: number;
};

export type Receipt = {
  business: string;
  customer: string | null;
  sale: {
    id: string;
    receipt_no: string | null;
    status: string;
    created_at: string;
    subtotal: number;
    discount_total: number;
    total: number;
    salesperson: string | null;
    due_date: string | null;
    credit_outstanding: number;
  };
  items: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    discount: number;
    line_total: number;
    returned_quantity: number;
  }[];
  payments: { method: string; amount: number; tendered: number | null; change_given: number }[];
  refunded: number;
  refunded_credit: number;
};

export const listSales = createServerFn({ method: "POST" })
  .validator(z.object(inBusiness))
  .handler(({ data }) =>
    run(data.token, data.businessId, ANYONE, async (db) => {
      const role = (await db.query("SELECT app_role() AS role")).rows[0].role as Role;
      const result = await db.query(
        `SELECT s.id, s.receipt_no, s.total::float8 AS total, s.status, s.created_at,
                member_name(s.salesperson_id) AS salesperson,
                (SELECT name FROM customers c WHERE c.id = s.customer_id) AS customer,
                (SELECT count(*)::int FROM sale_items i WHERE i.sale_id = s.id) AS items
           FROM sales s
          WHERE s.status <> 'draft' AND ($1::boolean OR s.salesperson_id = app_user())
          ORDER BY s.created_at DESC LIMIT 200`,
        [role !== "cashier"],
      );
      return result.rows as SaleListRow[];
    }),
  );

export const getReceipt = createServerFn({ method: "POST" })
  .validator(z.object({ ...inBusiness, saleId: uuid }))
  .handler(({ data }) =>
    run(data.token, data.businessId, ANYONE, async (db) => {
      const role = (await db.query("SELECT app_role() AS role")).rows[0].role as Role;
      const sale = await db.query(
        `SELECT s.id, s.receipt_no, s.status, s.created_at, s.subtotal::float8 AS subtotal,
                s.discount_total::float8 AS discount_total, s.total::float8 AS total,
                to_char(s.due_date, 'YYYY-MM-DD') AS due_date, s.credit_outstanding::float8 AS credit_outstanding,
                member_name(s.salesperson_id) AS salesperson,
                (SELECT name FROM businesses WHERE id = s.business_id) AS business,
                (SELECT name FROM customers c WHERE c.id = s.customer_id) AS customer
           FROM sales s WHERE s.id = $1 AND ($2::boolean OR s.salesperson_id = app_user())`,
        [data.saleId, role !== "cashier"],
      );
      if (!sale.rowCount) throw notFound("Sale");
      const items = await db.query(
        `SELECT id, product_name AS name, product_sku AS sku, quantity::float8 AS quantity, unit_price::float8 AS unit_price,
                discount::float8 AS discount, line_total::float8 AS line_total, returned_quantity::float8 AS returned_quantity
           FROM sale_items WHERE sale_id = $1 ORDER BY product_name`,
        [data.saleId],
      );
      const payments = await db.query(
        "SELECT method, amount::float8 AS amount, tendered::float8 AS tendered, change_given::float8 AS change_given FROM payments WHERE sale_id = $1 AND status = 'confirmed' ORDER BY created_at, method",
        [data.saleId],
      );
      const refunded = await db.query(
        "SELECT COALESCE(sum(amount), 0)::float8 AS amount, COALESCE(sum(credit_applied), 0)::float8 AS credit FROM refunds WHERE sale_id = $1",
        [data.saleId],
      );
      const row = sale.rows[0];
      return {
        business: row.business as string,
        customer: row.customer as string | null,
        sale: {
          id: row.id,
          receipt_no: row.receipt_no,
          status: row.status,
          created_at: row.created_at,
          subtotal: row.subtotal,
          discount_total: row.discount_total,
          total: row.total,
          salesperson: row.salesperson,
          due_date: row.due_date,
          credit_outstanding: row.credit_outstanding,
        },
        items: items.rows,
        payments: payments.rows,
        refunded: refunded.rows[0].amount as number,
        refunded_credit: refunded.rows[0].credit as number,
      } as Receipt;
    }),
  );

export const createSale = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ...inBusiness,
      clientUuid: uuid,
      items: z
        .array(
          z.object({
            productId: uuid,
            quantity: z.number().finite().positive(),
            discount: z.number().finite().min(0).optional(),
          }),
        )
        .min(1)
        .max(100),
      discount: z.number().finite().min(0),
      cashTendered: z.number().finite().min(0),
      customerId: uuid.nullable(),
      creditAmount: z.number().finite().min(0),
    }),
  )
  .handler(({ data }) =>
    run(data.token, data.businessId, ANYONE, async (db) => {
      const items = data.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        discount: item.discount ?? 0,
      }));
      const result = await db.query("SELECT complete_sale($1, $2::jsonb, $3, $4, $5, $6) AS id", [
        data.clientUuid,
        JSON.stringify(items),
        data.discount,
        data.cashTendered,
        data.customerId,
        data.creditAmount,
      ]);
      return result.rows[0].id as string;
    }),
  );

export const refundSale = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ...inBusiness,
      saleId: uuid,
      reason: z.string().trim().max(200),
      items: z
        .array(z.object({ saleItemId: uuid, quantity: z.number().finite().positive() }))
        .min(1)
        .max(100),
    }),
  )
  .handler(({ data }) =>
    run(data.token, data.businessId, MANAGERS, async (db) => {
      const items = data.items.map((item) => ({
        sale_item_id: item.saleItemId,
        quantity: item.quantity,
      }));
      const result = await db.query("SELECT refund_sale($1, $2::jsonb, $3) AS amount", [
        data.saleId,
        JSON.stringify(items),
        data.reason,
      ]);
      return Number(result.rows[0].amount);
    }),
  );

// ---- Customers & credit --------------------------------------------------------------------------

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  address: string | null;
  town: string | null;
  total_spent: number;
  orders: number;
  last_purchase: string | null;
  credit_limit: number | null;
  terms_days: number | null;
  balance: number;
  overdue: number;
};
export type CreditSummary = {
  outstanding: number;
  overdue: number;
  creditCustomers: number;
  aging: { not_due: number; d1_30: number; d31_60: number; d61_plus: number };
};
export type StatementEntry = {
  id: string;
  kind: "sale" | "payment" | "credit_note";
  amount: number;
  balance_after: number;
  method: string | null;
  reference: string | null;
  note: string | null;
  created_at: string;
  receipt_no: string | null;
};
export type CustomerSale = {
  id: string;
  receipt_no: string | null;
  total: number;
  status: string;
  created_at: string;
  credit_outstanding: number;
  due_date: string | null;
};

const CUSTOMER_SQL = `
  SELECT c.id, c.name, c.phone, c.email, c.notes, a.address, a.town,
         (COALESCE(s.spent, 0) - COALESCE(r.refunded, 0))::float8 AS total_spent,
         COALESCE(s.orders, 0)::int AS orders, s.last_purchase,
         ca.credit_limit::float8 AS credit_limit, ca.terms_days, COALESCE(ca.balance, 0)::float8 AS balance,
         COALESCE(o.overdue, 0)::float8 AS overdue
    FROM customers c
    LEFT JOIN LATERAL (SELECT address, town FROM customer_addresses WHERE customer_id = c.id ORDER BY is_primary DESC LIMIT 1) a ON true
    LEFT JOIN (SELECT customer_id, sum(total) AS spent, count(*) AS orders, max(created_at) AS last_purchase FROM sales WHERE status IN ('completed', 'refunded') GROUP BY customer_id) s ON s.customer_id = c.id
    LEFT JOIN (SELECT s2.customer_id, sum(rf.amount) AS refunded FROM refunds rf JOIN sales s2 ON s2.id = rf.sale_id GROUP BY s2.customer_id) r ON r.customer_id = c.id
    LEFT JOIN credit_accounts ca ON ca.customer_id = c.id
    LEFT JOIN (SELECT customer_id, sum(credit_outstanding) AS overdue FROM sales WHERE credit_outstanding > 0 AND due_date < current_date GROUP BY customer_id) o ON o.customer_id = c.id`;

export const listCustomers = createServerFn({ method: "POST" })
  .validator(z.object(inBusiness))
  .handler(({ data }) =>
    run(data.token, data.businessId, ANYONE, async (db) => {
      const customers = await db.query(`${CUSTOMER_SQL} ORDER BY c.name`);
      const aging = await db.query(
        `SELECT COALESCE(sum(credit_outstanding) FILTER (WHERE due_date >= current_date), 0)::float8 AS not_due,
                COALESCE(sum(credit_outstanding) FILTER (WHERE due_date < current_date AND due_date >= current_date - 30), 0)::float8 AS d1_30,
                COALESCE(sum(credit_outstanding) FILTER (WHERE due_date < current_date - 30 AND due_date >= current_date - 60), 0)::float8 AS d31_60,
                COALESCE(sum(credit_outstanding) FILTER (WHERE due_date < current_date - 60), 0)::float8 AS d61_plus
           FROM sales WHERE credit_outstanding > 0`,
      );
      const rows = customers.rows as CustomerRow[];
      const a = aging.rows[0];
      const summary: CreditSummary = {
        outstanding: rows.reduce((sum, c) => sum + c.balance, 0),
        overdue: a.d1_30 + a.d31_60 + a.d61_plus,
        creditCustomers: rows.filter((c) => (c.credit_limit ?? 0) > 0).length,
        aging: { not_due: a.not_due, d1_30: a.d1_30, d31_60: a.d31_60, d61_plus: a.d61_plus },
      };
      return { customers: rows, summary };
    }),
  );

export const customerStatement = createServerFn({ method: "POST" })
  .validator(z.object({ ...inBusiness, customerId: uuid }))
  .handler(({ data }) =>
    run(data.token, data.businessId, ANYONE, async (db) => {
      const customer = await db.query(`${CUSTOMER_SQL} WHERE c.id = $1`, [data.customerId]);
      if (!customer.rowCount) throw notFound("Customer");
      const entries = await db.query(
        `SELECT t.id, t.kind, t.amount::float8 AS amount, t.balance_after::float8 AS balance_after, t.method, t.reference, t.note, t.created_at, s.receipt_no
           FROM credit_transactions t LEFT JOIN sales s ON s.id = t.sale_id
          WHERE t.customer_id = $1 ORDER BY t.created_at DESC, t.id LIMIT 300`,
        [data.customerId],
      );
      const sales = await db.query(
        `SELECT id, receipt_no, total::float8 AS total, status, created_at, credit_outstanding::float8 AS credit_outstanding, to_char(due_date, 'YYYY-MM-DD') AS due_date
           FROM sales WHERE customer_id = $1 AND status <> 'draft' ORDER BY created_at DESC LIMIT 50`,
        [data.customerId],
      );
      return {
        customer: customer.rows[0] as CustomerRow,
        entries: entries.rows as StatementEntry[],
        sales: sales.rows as CustomerSale[],
      };
    }),
  );

export const saveCustomer = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ...inBusiness,
      customerId: uuid.nullable(),
      name: z.string().trim().min(1).max(120),
      phone: z.string().trim().max(40).nullable(),
      email: z.string().trim().max(160).nullable(),
      notes: z.string().trim().max(500).nullable(),
      address: z.string().trim().max(300).nullable(),
      town: z.string().trim().max(80).nullable(),
    }),
  )
  .handler(({ data }) =>
    run(data.token, data.businessId, ANYONE, async (db) => {
      let id = data.customerId;
      if (id) {
        const result = await db.query(
          "UPDATE customers SET name = $2, phone = $3, email = $4, notes = $5 WHERE id = $1",
          [id, data.name, data.phone, data.email, data.notes],
        );
        if (!result.rowCount) throw notFound("Customer");
      } else {
        id = (
          await db.query(
            "INSERT INTO customers (business_id, name, phone, email, notes) VALUES (app_business(), $1, $2, $3, $4) RETURNING id",
            [data.name, data.phone, data.email, data.notes],
          )
        ).rows[0].id as string;
      }
      await db.query("DELETE FROM customer_addresses WHERE customer_id = $1 AND is_primary", [id]);
      if (data.address)
        await db.query(
          "INSERT INTO customer_addresses (business_id, customer_id, address, town, is_primary) VALUES (app_business(), $1, $2, $3, true)",
          [id, data.address, data.town],
        );
      return id;
    }),
  );

export const deleteCustomer = createServerFn({ method: "POST" })
  .validator(z.object({ ...inBusiness, customerId: uuid }))
  .handler(({ data }) =>
    run(data.token, data.businessId, MANAGERS, async (db) => {
      const result = await db.query("DELETE FROM customers WHERE id = $1", [data.customerId]);
      if (!result.rowCount) throw notFound("Customer");
      return true as const;
    }),
  );

export const setCreditTerms = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ...inBusiness,
      customerId: uuid,
      creditLimit: z.number().finite().min(0),
      termsDays: z.number().int().min(0).max(365),
    }),
  )
  .handler(({ data }) =>
    run(data.token, data.businessId, MANAGERS, async (db) => {
      await db.query("SELECT set_credit_terms($1, $2, $3)", [
        data.customerId,
        data.creditLimit,
        data.termsDays,
      ]);
      return true as const;
    }),
  );

export const recordCreditPayment = createServerFn({ method: "POST" })
  .validator(
    z.object({
      ...inBusiness,
      customerId: uuid,
      amount: z.number().finite().positive(),
      reference: z.string().trim().max(120).nullable(),
      clientUuid: uuid,
    }),
  )
  .handler(({ data }) =>
    run(data.token, data.businessId, ANYONE, async (db) =>
      Number(
        (
          await db.query("SELECT record_credit_payment($1, $2, $3, $4) AS balance", [
            data.customerId,
            data.amount,
            data.reference,
            data.clientUuid,
          ])
        ).rows[0].balance,
      ),
    ),
  );
