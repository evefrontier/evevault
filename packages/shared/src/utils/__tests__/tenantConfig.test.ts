import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAvailableTenantIds, getDefaultTenantId } from "../tenantConfig";

vi.mock("../environment", () => ({
  isWeb: vi.fn(),
}));

vi.mock("../constants", () => ({
  TENANT_KEYS: {
    stillness: {
      clientId: "stillness-client",
      clientSecret: "secret",
      serverUrl: "https://auth.evefrontier.com",
      webOrigin: "https://evevault.evefrontier.com",
    },
    utopia: {
      clientId: "utopia-client",
      clientSecret: "secret",
      serverUrl: "https://test.auth.evefrontier.com",
      webOrigin: "https://uat.evevault.evefrontier.com",
    },
    testevenet: {
      clientId: "testevenet-client",
      clientSecret: "secret",
      serverUrl: "https://test.auth.evefrontier.com",
      webOrigin: "https://test.evevault.evefrontier.com",
      isDev: true,
    },
    nebula: {
      clientId: "nebula-client",
      clientSecret: "secret",
      serverUrl: "https://test.auth.evefrontier.com",
      webOrigin: "https://test.evevault.evefrontier.com",
      isDev: true,
    },
  },
}));

import { isWeb } from "../environment";

const STILLNESS_ORIGIN = "https://evevault.evefrontier.com";
const TEST_ORIGIN = "https://test.evevault.evefrontier.com";
const UAT_ORIGIN = "https://uat.evevault.evefrontier.com";
const UNKNOWN_ORIGIN = "https://unknown.example.com";

describe("getAvailableTenantIds", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLocation = window.location;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
    vi.clearAllMocks();
  });

  describe("when not web or not production (no URL filter)", () => {
    it("returns default tenant plus tenants with client secret when isWeb is false", () => {
      vi.mocked(isWeb).mockReturnValue(false);
      const ids = getAvailableTenantIds(false);
      expect(ids).toContain(getDefaultTenantId());
      expect(ids.length).toBeGreaterThan(1);
    });

    it("returns default tenant plus tenants with client secret when devMode is true", () => {
      vi.mocked(isWeb).mockReturnValue(true);
      process.env.NODE_ENV = "development";
      const ids = getAvailableTenantIds(true);
      expect(ids).toContain(getDefaultTenantId());
      expect(ids.length).toBeGreaterThan(1);
    });

    it("excludes isDev tenants when devMode is false and not web production", () => {
      vi.mocked(isWeb).mockReturnValue(false);
      const ids = getAvailableTenantIds(false);
      expect(ids).toContain("stillness");
      expect(ids).toContain("utopia");
      expect(ids).not.toContain("testevenet");
      expect(ids).not.toContain("nebula");
    });
  });

  describe("when web production (URL filter applied)", () => {
    beforeEach(() => {
      vi.mocked(isWeb).mockReturnValue(true);
      process.env.NODE_ENV = "production";
    });

    it("returns only tenants whose webOrigin matches window.location.origin", () => {
      Object.defineProperty(window, "location", {
        value: { origin: STILLNESS_ORIGIN },
        writable: true,
      });
      const ids = getAvailableTenantIds(false);
      expect(ids).toEqual(["stillness"]);
    });

    it("returns tenants for uat webOrigin when devMode false", () => {
      Object.defineProperty(window, "location", {
        value: { origin: UAT_ORIGIN },
        writable: true,
      });
      const ids = getAvailableTenantIds(false);
      expect(ids).toEqual(["utopia"]);
    });

    it("returns tenants for test webOrigin when devMode true", () => {
      Object.defineProperty(window, "location", {
        value: { origin: TEST_ORIGIN },
        writable: true,
      });
      const ids = getAvailableTenantIds(true);
      expect(ids).not.toContain("utopia");
      expect(ids).not.toContain("stillness");
      expect(ids).toContain("testevenet");
      expect(ids).toContain("nebula");
    });

    it("returns all test-webOrigin tenants when devMode true and origin is test webOrigin", () => {
      Object.defineProperty(window, "location", {
        value: { origin: TEST_ORIGIN },
        writable: true,
      });
      const ids = getAvailableTenantIds(true);
      expect(ids).not.toContain("utopia");
      expect(ids).toContain("testevenet");
      expect(ids).toContain("nebula");
      expect(ids).not.toContain("stillness");
    });

    it("returns empty array when origin matches no tenant webOrigin", () => {
      Object.defineProperty(window, "location", {
        value: { origin: UNKNOWN_ORIGIN },
        writable: true,
      });
      const ids = getAvailableTenantIds(false);
      expect(ids).toEqual([]);
    });

    it("normalizes trailing slash when comparing origin to webOrigin", () => {
      Object.defineProperty(window, "location", {
        value: { origin: `${STILLNESS_ORIGIN}/` },
        writable: true,
      });
      const ids = getAvailableTenantIds(false);
      expect(ids).toEqual(["stillness"]);
    });
  });
});
