import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getApiContextMock = vi.hoisted(() => vi.fn());

vi.mock("#/auth/getApiContext", () => ({
  getApiContext: getApiContextMock,
}));

import { vendJwt } from "#/auth/vendToken";

describe("vendJwt", () => {
  const idToken = "primary.id.jwt";
  const apiBase = "https://api.test.pub.evefrontier.com";
  const tenant = "frontier-tenant";

  beforeEach(() => {
    vi.clearAllMocks();
    getApiContextMock.mockReturnValue({
      apiBaseUrl: apiBase,
      tenant,
      decoded: {},
    });
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs nonce to vend URL with tenant and bearer token", async () => {
    const vended = "vended.id.jwt";
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ token: vended }), { status: 200 }),
    );

    const result = await vendJwt(idToken, { nonce: "device-nonce-1" });

    expect(getApiContextMock).toHaveBeenCalledWith(idToken);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${apiBase}/auth/zklogin/vend-jwt`,
      expect.objectContaining({
        method: "POST",
        headers: {
          "X-Tenant": tenant,
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ nonce: "device-nonce-1" }),
      }),
    );
    expect(result).toBe(vended);
  });

  it("throws with response body when HTTP status is not ok", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response("upstream error", {
        status: 502,
        statusText: "Bad Gateway",
      }),
    );

    await expect(vendJwt(idToken, { nonce: "n" })).rejects.toThrow(
      "JWT vend failed: upstream error",
    );
  });

  it("throws when JSON body has no string token", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    await expect(vendJwt(idToken, { nonce: "n" })).rejects.toThrow(
      "JWT vend failed: no token in response",
    );
  });

  it("throws when token field is not a string", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ token: 123 }), { status: 200 }),
    );

    await expect(vendJwt(idToken, { nonce: "n" })).rejects.toThrow(
      "JWT vend failed: no token in response",
    );
  });
});
