import { User } from "oidc-client-ts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mockStoreUser: vi.fn(),
  mockEnrichUser: vi.fn(),
  mockSyncPrimaryJwt: vi.fn(),
  mockDecodeJwt: vi.fn(),
}));

vi.mock("#/auth/userJwtSync", () => ({
  enrichUserWithZkLoginIfNeeded: (...args: unknown[]) =>
    h.mockEnrichUser(...args),
  syncPrimaryJwtFromUser: (...args: unknown[]) => h.mockSyncPrimaryJwt(...args),
}));
vi.mock("#/auth/utils/authStoreUtils", () => ({
  resolveExpiresAt: vi.fn(),
}));
vi.mock("#/utils", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  isBrowser: () => true,
}));
vi.mock("jose", () => ({
  decodeJwt: (...args: unknown[]) => h.mockDecodeJwt(...args),
}));

import { loginExtensionSession } from "#/auth/stores/authExtensionLogin";
import { makeJwt } from "#/testing";
import type { OAuthTokenResponse } from "#/types/authTypes";

function makeTokenResponse(): OAuthTokenResponse {
  return {
    id_token: makeJwt({ sub: "user-1", iat: 1000, exp: 4600 }),
    access_token: "access-token",
    token_type: "Bearer",
    scope: "openid",
    refresh_token: "refresh-token",
    expires_in: 3600,
    expires_at: 4600,
  };
}

describe("authExtensionLogin()", () => {
  let mockSet: ReturnType<typeof vi.fn>;
  let mockGet: ReturnType<typeof vi.fn>;
  let mockGetUserManager: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    h.mockStoreUser.mockResolvedValue(undefined);
    h.mockEnrichUser.mockImplementation(async (user: unknown) => user);
    h.mockSyncPrimaryJwt.mockResolvedValue(undefined);
    h.mockDecodeJwt.mockReturnValue({ sub: "user-1", iat: 1000, exp: 4600 });
    mockSet = vi.fn();
    mockGetUserManager = vi
      .fn()
      .mockReturnValue({ storeUser: h.mockStoreUser });
    mockGet = vi.fn().mockReturnValue({
      extensionLogin: vi.fn().mockResolvedValue(makeTokenResponse()),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Success path", () => {
    it("builds user, persists enriched user, sets { user, loading: false }", async () => {
      const user = await loginExtensionSession(
        mockGet,
        mockSet,
        mockGetUserManager,
      );

      expect(user).toBeDefined();
      expect(h.mockEnrichUser).toHaveBeenCalledWith(
        expect.any(User),
        expect.any(Function),
      );
      expect(h.mockStoreUser).toHaveBeenCalledWith(expect.any(User));
      expect(h.mockSyncPrimaryJwt).toHaveBeenCalledWith(expect.any(User));
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ loading: false }),
      );
    });
  });

  describe("Rejection paths", () => {
    it("resolves undefined or null: sets { loading: false }, returns undefined", async () => {
      mockGet.mockReturnValue({
        extensionLogin: vi.fn().mockResolvedValue(null),
      });

      const user = await loginExtensionSession(
        mockGet,
        mockSet,
        mockGetUserManager,
      );

      expect(user).toBeUndefined();
      expect(mockSet).toHaveBeenCalledWith({ loading: false });
      expect(h.mockStoreUser).not.toHaveBeenCalled();
      expect(h.mockSyncPrimaryJwt).not.toHaveBeenCalled();
    });

    it("rejection with 'The user did not approve access.': no error state, only loading false", async () => {
      mockGet.mockReturnValue({
        extensionLogin: vi
          .fn()
          .mockRejectedValue(new Error("The user did not approve access.")),
      });

      const user = await loginExtensionSession(
        mockGet,
        mockSet,
        mockGetUserManager,
      );

      expect(user).toBeUndefined();
      expect(mockSet).toHaveBeenCalledWith({ loading: false });
      expect(mockSet).not.toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.anything() }),
      );
      expect(h.mockStoreUser).not.toHaveBeenCalled();
      expect(h.mockSyncPrimaryJwt).not.toHaveBeenCalled();
    });

    it("rejection with another Error: sets error to that message", async () => {
      mockGet.mockReturnValue({
        extensionLogin: vi.fn().mockRejectedValue(new Error("Another error")),
      });

      const user = await loginExtensionSession(
        mockGet,
        mockSet,
        mockGetUserManager,
      );

      expect(user).toBeUndefined();
      expect(mockSet).toHaveBeenCalledWith({ error: "Another error" });
      expect(mockSet).toHaveBeenCalledWith({ loading: false });
      expect(h.mockStoreUser).not.toHaveBeenCalled();
      expect(h.mockSyncPrimaryJwt).not.toHaveBeenCalled();
    });

    it("rejection with non-Error: sets error to 'Unknown error'", async () => {
      mockGet.mockReturnValue({
        extensionLogin: vi.fn().mockRejectedValue("Another error"),
      });

      const user = await loginExtensionSession(
        mockGet,
        mockSet,
        mockGetUserManager,
      );

      expect(user).toBeUndefined();
      expect(mockSet).toHaveBeenCalledWith({ error: "Unknown error" });
      expect(mockSet).toHaveBeenCalledWith({ loading: false });
      expect(h.mockStoreUser).not.toHaveBeenCalled();
      expect(h.mockSyncPrimaryJwt).not.toHaveBeenCalled();
    });
  });
});
