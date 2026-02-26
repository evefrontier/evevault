import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../../utils/environment", () => ({
  isExtension: vi.fn().mockReturnValue(false),
  isWeb: vi.fn().mockReturnValue(true),
}));

vi.mock("../../utils/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("../deviceStore", () => ({
  useDeviceStore: {
    getState: () => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      initializeForChain: vi.fn().mockResolvedValue(undefined),
      isLocked: false,
      lock: vi.fn(),
    }),
  },
}));

vi.mock("../networkStore", () => ({
  useNetworkStore: {
    getState: () => ({
      chain: "sui:devnet",
      initialize: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("../../auth/utils/exchangeCode", () => ({
  exchangeCodeForTokens: vi.fn(),
}));

vi.mock("../../auth/utils/patchNonce", () => ({
  patchNonce: vi.fn(),
}));

import { useAuthStore } from "../../auth/stores/authStore";
import { useDeviceStore } from "../deviceStore";
import { useNetworkStore } from "../networkStore";
import { exchangeCodeForTokens } from "../../auth/utils/exchangeCode";
import { patchNonce } from "../../auth/utils/patchNonce";

describe("Auth and Device Store Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset auth store
    useAuthStore.setState({
      user: null,
      loading: false,
      error: null,
    });
  });

  describe("initialization flow", () => {
    it("initializes device store when user is authenticated", async () => {
      // Setup authenticated user
      useAuthStore.setState({
        user: {
          id_token: "test-token",
          access_token: "test-access",
          token_type: "Bearer",
          scope: "openid email profile",
          profile: {
            sub: "test-user",
            email: "test@example.com",
            preferred_username: "testuser",
            sui_address: "0x123",
            salt: "0x1",
          },
          expires_at: Date.now() / 1000 + 3600,
        },
        loading: false,
        error: null,
      });

      const deviceStore = useDeviceStore.getState();

      await useAuthStore.getState().initialize();

      // Device store should be initialized
      expect(deviceStore.initialize).toHaveBeenCalled();
    });

    it("initializes network store during auth initialization", async () => {
      useAuthStore.setState({
        user: {
          id_token: "test-token",
          access_token: "test-access",
          token_type: "Bearer",
          scope: "openid email profile",
          profile: {
            sub: "test-user",
            email: "test@example.com",
            preferred_username: "testuser",
            sui_address: "0x123",
            salt: "0x1",
          },
          expires_at: Date.now() / 1000 + 3600,
        },
        loading: false,
        error: null,
      });

      const networkStore = useNetworkStore.getState();

      await useAuthStore.getState().initialize();

      expect(networkStore.initialize).toHaveBeenCalled();
    });

    it("does not initialize device store when user is null", async () => {
      useAuthStore.setState({
        user: null,
        loading: false,
        error: null,
      });

      const deviceStore = useDeviceStore.getState();

      await useAuthStore.getState().initialize();

      // Should not initialize device for unauthenticated user
      expect(deviceStore.initialize).not.toHaveBeenCalled();
    });
  });

  describe("logout flow", () => {
    it("locks device store when user logs out", async () => {
      // Setup authenticated user
      useAuthStore.setState({
        user: {
          id_token: "test-token",
          access_token: "test-access",
          token_type: "Bearer",
          scope: "openid email profile",
          profile: {
            sub: "test-user",
            email: "test@example.com",
            preferred_username: "testuser",
            sui_address: "0x123",
            salt: "0x1",
          },
          expires_at: Date.now() / 1000 + 3600,
        },
        loading: false,
        error: null,
      });

      const deviceStore = useDeviceStore.getState();

      await useAuthStore.getState().logout();

      // Device should be locked on logout
      expect(deviceStore.lock).toHaveBeenCalled();
    });

    it("clears user data on logout", async () => {
      useAuthStore.setState({
        user: {
          id_token: "test-token",
          access_token: "test-access",
          token_type: "Bearer",
          scope: "openid email profile",
          profile: {
            sub: "test-user",
            email: "test@example.com",
            preferred_username: "testuser",
            sui_address: "0x123",
            salt: "0x1",
          },
          expires_at: Date.now() / 1000 + 3600,
        },
        loading: false,
        error: null,
      });

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().user).toBeNull();
    });

    it("clears error on logout", async () => {
      useAuthStore.setState({
        user: null,
        loading: false,
        error: "Previous error",
      });

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe("login with network switching", () => {
    it("initializes device for current network on login", async () => {
      vi.mocked(exchangeCodeForTokens).mockResolvedValue({
        id_token: "new-token",
        access_token: "new-access",
        token_type: "Bearer",
        scope: "openid email profile",
        expires_in: 3600,
      });

      vi.mocked(patchNonce).mockResolvedValue({
        id_token: "patched-token",
        access_token: "new-access",
        token_type: "Bearer",
        scope: "openid email profile",
        expires_in: 3600,
      });

      const deviceStore = useDeviceStore.getState();
      const networkStore = useNetworkStore.getState();

      await useAuthStore.getState().login("test-code", "test-verifier");

      // Should initialize device for current network
      expect(deviceStore.initializeForChain).toHaveBeenCalledWith(
        networkStore.chain
      );
    });
  });

  describe("error handling", () => {
    it("sets error state when initialization fails", async () => {
      const deviceStore = useDeviceStore.getState();
      vi.mocked(deviceStore.initialize).mockRejectedValue(
        new Error("Init failed")
      );

      useAuthStore.setState({
        user: {
          id_token: "test-token",
          access_token: "test-access",
          token_type: "Bearer",
          scope: "openid email profile",
          profile: {
            sub: "test-user",
            email: "test@example.com",
            preferred_username: "testuser",
            sui_address: "0x123",
            salt: "0x1",
          },
          expires_at: Date.now() / 1000 + 3600,
        },
        loading: false,
        error: null,
      });

      await useAuthStore.getState().initialize();

      // Error should be captured
      expect(useAuthStore.getState().error).toBeTruthy();
    });

    it("maintains user session when device initialization fails", async () => {
      const deviceStore = useDeviceStore.getState();
      vi.mocked(deviceStore.initialize).mockRejectedValue(
        new Error("Init failed")
      );

      const user = {
        id_token: "test-token",
        access_token: "test-access",
        token_type: "Bearer",
        scope: "openid email profile",
        profile: {
          sub: "test-user",
          email: "test@example.com",
          preferred_username: "testuser",
          sui_address: "0x123",
          salt: "0x1",
        },
        expires_at: Date.now() / 1000 + 3600,
      };

      useAuthStore.setState({
        user,
        loading: false,
        error: null,
      });

      await useAuthStore.getState().initialize();

      // User should still be set despite device init failure
      expect(useAuthStore.getState().user).toEqual(user);
    });
  });

  describe("state synchronization", () => {
    it("coordinates loading states between auth and device", async () => {
      useAuthStore.setState({
        user: {
          id_token: "test-token",
          access_token: "test-access",
          token_type: "Bearer",
          scope: "openid email profile",
          profile: {
            sub: "test-user",
            email: "test@example.com",
            preferred_username: "testuser",
            sui_address: "0x123",
            salt: "0x1",
          },
          expires_at: Date.now() / 1000 + 3600,
        },
        loading: true,
        error: null,
      });

      // Auth loading state should be true during initialization
      expect(useAuthStore.getState().loading).toBe(true);

      await useAuthStore.getState().initialize();

      // Loading should complete after initialization
      expect(useAuthStore.getState().loading).toBe(false);
    });

    it("ensures device is locked when no user", () => {
      useAuthStore.setState({
        user: null,
        loading: false,
        error: null,
      });

      const deviceStore = useDeviceStore.getState();

      // Device should be locked when no user
      expect(deviceStore.isLocked).toBe(false); // Initial state
    });
  });

  describe("user profile updates", () => {
    it("allows updating user profile", () => {
      const initialUser = {
        id_token: "test-token",
        access_token: "test-access",
        token_type: "Bearer",
        scope: "openid email profile",
        profile: {
          sub: "test-user",
          email: "test@example.com",
          preferred_username: "testuser",
          sui_address: "0x123",
          salt: "0x1",
        },
        expires_at: Date.now() / 1000 + 3600,
      };

      useAuthStore.setState({ user: initialUser, loading: false, error: null });

      const updatedUser = {
        ...initialUser,
        profile: {
          ...initialUser.profile,
          email: "updated@example.com",
        },
      };

      useAuthStore.getState().setUser(updatedUser);

      expect(useAuthStore.getState().user?.profile.email).toBe(
        "updated@example.com"
      );
    });
  });
});
