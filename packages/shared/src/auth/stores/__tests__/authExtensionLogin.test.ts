import { User, type UserManager } from "oidc-client-ts";
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
import type {
  AuthGet,
  AuthSet,
  GetUserManagerInstance,
} from "#/auth/stores/authWorkflowUtils";
import type { AuthState } from "#/auth/types";
import { makeTokenResponse } from "./authStoreTestMocks";

type AuthSetMock = AuthSet & ReturnType<typeof vi.fn>;

describe("authExtensionLogin()", () => {
  let mockSet: AuthSetMock;
  let mockGet: AuthGet;
  let mockGetUserManager: GetUserManagerInstance;
  let mockExtensionLogin: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    h.mockStoreUser.mockResolvedValue(undefined);
    h.mockEnrichUser.mockImplementation(async (user: unknown) => user);
    h.mockSyncPrimaryJwt.mockResolvedValue(undefined);
    h.mockDecodeJwt.mockReturnValue({ sub: "user-1", iat: 1000, exp: 4600 });
    mockSet = vi.fn() as AuthSetMock;
    mockGetUserManager = () =>
      ({ storeUser: h.mockStoreUser }) as unknown as UserManager;
    mockExtensionLogin = vi.fn().mockResolvedValue(makeTokenResponse());
    mockGet = () =>
      ({ extensionLogin: mockExtensionLogin }) as unknown as AuthState;
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
      mockExtensionLogin.mockResolvedValue(null);

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

    it("rejection with 'The user did not approve access.'", async () => {
      mockExtensionLogin.mockRejectedValue(
        new Error("The user did not approve access."),
      );

      const user = await loginExtensionSession(
        mockGet,
        mockSet,
        mockGetUserManager,
      );

      // No error state, only loading false.
      expect(user).toBeUndefined();
      expect(mockSet).toHaveBeenCalledWith({ loading: false });
      expect(mockSet).not.toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.anything() }),
      );
      expect(h.mockStoreUser).not.toHaveBeenCalled();
      expect(h.mockSyncPrimaryJwt).not.toHaveBeenCalled();
    });

    it("rejection with another Error: sets error to that message", async () => {
      mockExtensionLogin.mockRejectedValue(new Error("Another error"));

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
      mockExtensionLogin.mockRejectedValue("Another error");

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
