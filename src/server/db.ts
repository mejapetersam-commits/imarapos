import { Pool, type PoolClient } from "@neondatabase/serverless";

export type Role = "owner" | "manager" | "cashier";

/**
 * Runs `fn` in one transaction as the restricted app role. app.user_id / app.business_id are set
 * for the transaction only, so Postgres row-level security isolates each business even if a query
 * forgets a business_id filter. A pool per call keeps this safe on Workers and Node alike.
 */
export async function withDb<T>(
  userId: string,
  businessId: string | null,
  fn: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("Database is not configured.");
  const pool = new Pool({ connectionString: url, max: 1 });
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query(
      "SELECT set_config('app.user_id', $1, true), set_config('app.business_id', $2, true)",
      [userId, businessId ?? ""],
    );
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    db.release();
    await pool.end().catch(() => undefined);
  }
}

/** Throws unless the signed-in user is an active member of the current business with one of `allowed`. */
export async function requireRole(db: PoolClient, allowed: Role[]): Promise<Role> {
  const { rows } = await db.query<{ role: Role }>(
    "SELECT role FROM business_members WHERE business_id = app_business() AND user_id = app_user() AND active",
  );
  const role = rows[0]?.role;
  if (!role || !allowed.includes(role)) throw new Error("You do not have permission to do that.");
  return role;
}
