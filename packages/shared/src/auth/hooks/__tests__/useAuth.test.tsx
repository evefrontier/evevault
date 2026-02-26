import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAuth } from "../useAuth";

// Mock authStore
vi.mock("../../stores/authStore", () => ({
  useAuthStore: vi.fn(),
}));

import { useAuthStore } from "../../stores/authStore";

describe("useAuth", () => {
  const mockUser = {
    email: "test@example.com",
    name: "Test User",
    sub: "user-123",
  };

  const mockLogin = vi.fn();
  const mockExtensionLogin = vi.fn();
  const mockLogout = vi.fn();
  const mockSetUser = vi.fn();
  const mockRefreshJwt = vi.fn();
  const mockInitialize = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("returns auth state", () => {
    it("returns user from auth store", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: mockUser,
        loading: false,
        error: null,
        login: mockLogin,
        extensionLogin: mockExtensionLogin,
        logout: mockLogout,
        setUser: mockSetUser,
        refreshJwt: mockRefreshJwt,
        initialize: mockInitialize,
        // @ts-expect-error Partial mock
        jwt: null,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toEqual(mockUser);
    });

    it("returns loading state from auth store", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        loading: true,
        error: null,
        login: mockLogin,
        extensionLogin: mockExtensionLogin,
        logout: mockLogout,
        setUser: mockSetUser,
        refreshJwt: mockRefreshJwt,
        initialize: mockInitialize,
        // @ts-expect-error Partial mock
        jwt: null,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.loading).toBe(true);
    });

    it("returns error state from auth store", () => {
      const mockError = "Authentication failed";
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        loading: false,
        error: mockError,
        login: mockLogin,
        extensionLogin: mockExtensionLogin,
        logout: mockLogout,
        setUser: mockSetUser,
        refreshJwt: mockRefreshJwt,
        initialize: mockInitialize,
        // @ts-expect-error Partial mock
        jwt: null,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.error).toBe(mockError);
    });
  });

  describe("returns auth functions", () => {
    beforeEach(() => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        loading: false,
        error: null,
        login: mockLogin,
        extensionLogin: mockExtensionLogin,
        logout: mockLogout,
        setUser: mockSetUser,
        refreshJwt: mockRefreshJwt,
        initialize: mockInitialize,
        // @ts-expect-error Partial mock
        jwt: null,
      });
    });

    it("exposes login function", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.login).toBe(mockLogin);
    });

    it("exposes extensionLogin function", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.extensionLogin).toBe(mockExtensionLogin);
    });

    it("exposes logout function", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.logout).toBe(mockLogout);
    });

    it("exposes setUser function", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.setUser).toBe(mockSetUser);
    });

    it("exposes refreshJwt function", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.refreshJwt).toBe(mockRefreshJwt);
    });

    it("exposes initialize function", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.initialize).toBe(mockInitialize);
    });
  });

  describe("isAuthenticated computed property", () => {
    it("returns true when user is present", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: mockUser,
        loading: false,
        error: null,
        login: mockLogin,
        extensionLogin: mockExtensionLogin,
        logout: mockLogout,
        setUser: mockSetUser,
        refreshJwt: mockRefreshJwt,
        initialize: mockInitialize,
        // @ts-expect-error Partial mock
        jwt: null,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
    });

    it("returns false when user is null", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: null,
        loading: false,
        error: null,
        login: mockLogin,
        extensionLogin: mockExtensionLogin,
        logout: mockLogout,
        setUser: mockSetUser,
        refreshJwt: mockRefreshJwt,
        initialize: mockInitialize,
        // @ts-expect-error Partial mock
        jwt: null,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);
    });

    it("returns false when user is undefined", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: undefined,
        loading: false,
        error: null,
        login: mockLogin,
        extensionLogin: mockExtensionLogin,
        logout: mockLogout,
        setUser: mockSetUser,
        refreshJwt: mockRefreshJwt,
        initialize: mockInitialize,
        // @ts-expect-error Partial mock
        jwt: null,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe("integration scenarios", () => {
    it("provides all expected properties", () => {
      vi.mocked(useAuthStore).mockReturnValue({
        user: mockUser,
        loading: false,
        error: null,
        login: mockLogin,
        extensionLogin: mockExtensionLogin,
        logout: mockLogout,
        setUser: mockSetUser,
        refreshJwt: mockRefreshJwt,
        initialize: mockInitialize,
        // @ts-expect-error Partial mock
        jwt: null,
      });

      const { result } = renderHook(() => useAuth());

      expect(result.current).toHaveProperty("user");
      expect(result.current).toHaveProperty("loading");
      expect(result.current).toHaveProperty("error");
      expect(result.current).toHaveProperty("login");
      expect(result.current).toHaveProperty("extensionLogin");
      expect(result.current).toHaveProperty("logout");
      expect(result.current).toHaveProperty("setUser");
      expect(result.current).toHaveProperty("refreshJwt");
      expect(result.current).toHaveProperty("isAuthenticated");
      expect(result.current).toHaveProperty("initialize");
    });

    it("reflects state changes from auth store", () => {
      let currentUser = null as typeof mockUser | null;

      vi.mocked(useAuthStore).mockImplementation(() => ({
        user: currentUser,
        loading: false,
        error: null,
        login: mockLogin,
        extensionLogin: mockExtensionLogin,
        logout: mockLogout,
        setUser: mockSetUser,
        refreshJwt: mockRefreshJwt,
        initialize: mockInitialize,
        // @ts-expect-error Partial mock
        jwt: null,
      }));

      const { result, rerender } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);

      // Simulate login
      currentUser = mockUser;
      rerender();

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    it("handles loading state correctly", () => {
      let loading = true;

      vi.mocked(useAuthStore).mockImplementation(() => ({
        user: null,
        loading,
        error: null,
        login: mockLogin,
        extensionLogin: mockExtensionLogin,
        logout: mockLogout,
        setUser: mockSetUser,
        refreshJwt: mockRefreshJwt,
        initialize: mockInitialize,
        // @ts-expect-error Partial mock
        jwt: null,
      }));

      const { result, rerender } = renderHook(() => useAuth());

      expect(result.current.loading).toBe(true);

      loading = false;
      rerender();

      expect(result.current.loading).toBe(false);
    });

    it("handles error state correctly", () => {
      let error: string | null = null;

      vi.mocked(useAuthStore).mockImplementation(() => ({
        user: null,
        loading: false,
        error,
        login: mockLogin,
        extensionLogin: mockExtensionLogin,
        logout: mockLogout,
        setUser: mockSetUser,
        refreshJwt: mockRefreshJwt,
        initialize: mockInitialize,
        // @ts-expect-error Partial mock
        jwt: null,
      }));

      const { result, rerender } = renderHook(() => useAuth());

      expect(result.current.error).toBe(null);

      error = "Login failed";
      rerender();

      expect(result.current.error).toBe("Login failed");
    });
  });
});
