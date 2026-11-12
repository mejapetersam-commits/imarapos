import { createRemoteJWKSet, jwtVerify } from "jose";

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

/** Verifies a Neon Auth JWT (EdDSA; iss and aud are the auth URL's origin) and returns the user id. */
export async function userIdFromToken(token: string): Promise<string> {
  const base = process.env["NEON_AUTH_URL"];
  if (!base) throw new Error("Auth is not configured.");
  jwks ??= createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`));
  const origin = new URL(base).origin;
  const { payload } = await jwtVerify(token, jwks, {
    algorithms: ["EdDSA"],
    issuer: origin,
    audience: origin,
  });
  if (!payload.sub) throw new Error("Invalid session.");
  return payload.sub;
}
