import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAvailableTenantIds,
  getDefaultTenantId,
} from "#/utils/tenantConfig";

vi.mock("#/utils/environment", () => ({
  isWeb: vi.fn(),
}));

vi.mock("#/utils/constants", () => ({
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
    tauceti: {
      clientId: "tauceti-client",
      clientSecret: "secret",
      serverUrl: "https://test.auth.evefrontier.com",
      webOrigin: "https://test.evevault.evefrontier.com",
      isDev: true,
    },
    tesseract: {
      clientId: "tesseract-client",
      clientSecret: "secret",
      serverUrl: "https://test.auth.evefrontier.com",
      webOrigin: "https://test.evevault.evefrontier.com",
      isDev: true,
    },
    tetra: {
      clientId: "tetra-client",
      clientSecret: "secret",
      serverUrl: "https://test.auth.evefrontier.com",
      webOrigin: "https://test.evevault.evefrontier.com",
      isDev: true,
    },
    tiaki: {
      clientId: "tiaki-client",
      clientSecret: "secret",
      serverUrl: "https://test.auth.evefrontier.com",
      webOrigin: "https://test.evevault.evefrontier.com",
      isDev: true,
    },
  },
}));

import { setWindowLocation } from "#/testing";
import { isWeb } from "#/utils/environment";

const STILLNESS_ORIGIN = "https://evevault.evefrontier.com";
const TEST_ORIGIN = "https://test.evevault.evefrontier.com";
const UAT_ORIGIN = "https://uat.evevault.evefrontier.com";
const UNKNOWN_ORIGIN = "https://unknown.example.com";

describe("getAvailableTenantIds", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLocation = window.location;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    setWindowLocation(originalLocation);
    vi.clearAllMocks();
  });

  describe("when outside web-production context (no URL filter)", () => {
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
      expect(ids).not.toContain("tesseract");
      expect(ids).not.toContain("tiaki");
      expect(ids).not.toContain("tetra");
      expect(ids).not.toContain("tauceti");
    });
  });

  describe("when web production (URL filter applied)", () => {
    beforeEach(() => {
      vi.mocked(isWeb).mockReturnValue(true);
      process.env.NODE_ENV = "production";
    });

    it("returns only tenants whose webOrigin matches window.location.origin", () => {
      setWindowLocation({ origin: STILLNESS_ORIGIN });
      const ids = getAvailableTenantIds(false);
      expect(ids).toEqual(["stillness"]);
    });

    it("returns tenants for uat webOrigin when devMode false", () => {
      setWindowLocation({ origin: UAT_ORIGIN });
      const ids = getAvailableTenantIds(false);
      expect(ids).toEqual(["utopia"]);
    });

    it("returns tenants for test webOrigin when devMode true", () => {
      setWindowLocation({ origin: TEST_ORIGIN });
      const ids = getAvailableTenantIds(true);
      expect(ids).not.toContain("utopia");
      expect(ids).not.toContain("stillness");
      expect(ids).toContain("tesseract");
      expect(ids).toContain("tiaki");
      expect(ids).toContain("tetra");
      expect(ids).toContain("tauceti");
    });

    it("returns all test-webOrigin tenants when devMode true and origin is test webOrigin", () => {
      setWindowLocation({ origin: TEST_ORIGIN });
      const ids = getAvailableTenantIds(true);
      expect(ids).not.toContain("utopia");
      expect(ids).toContain("tesseract");
      expect(ids).toContain("tiaki");
      expect(ids).toContain("tetra");
      expect(ids).toContain("tauceti");
      expect(ids).not.toContain("stillness");
    });

    it("returns empty array when origin matches no tenant webOrigin", () => {
      setWindowLocation({ origin: UNKNOWN_ORIGIN });
      const ids = getAvailableTenantIds(false);
      expect(ids).toEqual([]);
    });

    it("normalizes trailing slash when comparing origin to webOrigin", () => {
      setWindowLocation({ origin: `${STILLNESS_ORIGIN}/` });
      const ids = getAvailableTenantIds(false);
      expect(ids).toEqual(["stillness"]);
    });
  });
});
