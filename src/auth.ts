import { createAuthClient } from "@neon/auth";
import { BetterAuthReactAdapter } from "@neon/auth/react/adapters";

export const authClient = createAuthClient(import.meta.env["VITE_NEON_AUTH_URL"] as string, {
  adapter: BetterAuthReactAdapter({ fetchOptions: { credentials: "include" } }),
});

/** Short-lived JWT (15 min) sent to server functions, which verify it against Neon Auth's JWKS. */
export async function getToken(): Promise<string | null> {
  const { data } = await authClient.getSession();
  return data?.session?.token ?? null;
}
