// @vitest-environment node

import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { getApiContext } from "#/auth/getApiContext";

const HS256_SECRET = new TextEncoder().encode(
  "unit-test-hs256-secret-32-chars!!",
);

async function makeIdToken(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(HS256_SECRET);
}

describe("getApiContext", () => {
  it("stillness: uses decoded.tier for .tech host segment", async () => {
    const token = await makeIdToken({
      tenant: "stillness",
      tier: "staging",
    });
    const { apiBaseUrl, tenant, decoded } = getApiContext(token);
    expect(tenant).toBe("stillness");
    expect(decoded.tier).toBe("staging");
    expect(apiBaseUrl).toBe("https://api.staging.tech.evefrontier.com");
  });

  it("stillness: defaults tier to prod when tier claim is missing", async () => {
    const token = await makeIdToken({ tenant: "stillness" });
    const { apiBaseUrl, tenant } = getApiContext(token);
    expect(tenant).toBe("stillness");
    expect(apiBaseUrl).toBe("https://api.prod.tech.evefrontier.com");
  });

  it("utopia: uses fixed uat.pub segment (ignores tier claim)", async () => {
    const token = await makeIdToken({
      tenant: "utopia",
      tier: "should-not-affect-url",
    });
    const { apiBaseUrl, tenant, decoded } = getApiContext(token);
    expect(tenant).toBe("utopia");
    expect(decoded.tier).toBe("should-not-affect-url");
    expect(apiBaseUrl).toBe("https://api.uat.pub.evefrontier.com");
  });

  it("default tenant: uses decoded.tier for .pub host segment", async () => {
    const token = await makeIdToken({
      tenant: "tiaki",
      tier: "test",
    });
    const { apiBaseUrl, tenant } = getApiContext(token);
    expect(tenant).toBe("tiaki");
    expect(apiBaseUrl).toBe("https://api.test.pub.evefrontier.com");
  });

  it("default tenant: defaults tier to test when tenant is non-stillness/non-utopia and tier missing", async () => {
    const token = await makeIdToken({ tenant: "frontier" });
    const { apiBaseUrl, tenant } = getApiContext(token);
    expect(tenant).toBe("frontier");
    expect(apiBaseUrl).toBe("https://api.test.pub.evefrontier.com");
  });

  it("default tenant: empty tenant string uses test.pub when tier missing", async () => {
    const token = await makeIdToken({});
    const { apiBaseUrl, tenant } = getApiContext(token);
    expect(tenant).toBe("");
    expect(apiBaseUrl).toBe("https://api.test.pub.evefrontier.com");
  });

  it("default tenant: empty tenant with tier uses tier.pub", async () => {
    const token = await makeIdToken({ tier: "preview" });
    const { apiBaseUrl, tenant } = getApiContext(token);
    expect(tenant).toBe("");
    expect(apiBaseUrl).toBe("https://api.preview.pub.evefrontier.com");
  });
});
