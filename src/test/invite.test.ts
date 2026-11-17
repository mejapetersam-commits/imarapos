import { describe, expect, it } from "vitest";
import { hashInviteToken, newInviteToken } from "@/server/invite";

describe("invite tokens", () => {
  it("creates long, URL-safe, unique secrets", () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hashes deterministically to 64 hex characters and never equals the secret", async () => {
    const secret = newInviteToken();
    const first = await hashInviteToken(secret);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashInviteToken(secret)).toBe(first);
    expect(first).not.toContain(secret);
    expect(await hashInviteToken(`${secret}x`)).not.toBe(first);
  });

  it("matches the known SHA-256 of 'abc'", async () => {
    expect(await hashInviteToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
