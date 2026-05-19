import { useAuthStore } from "@evevault/shared/auth";
import { createMockUser } from "@evevault/shared/testing";
import { render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteContextProvider, useRouteContext } from "../routeContext";

vi.mock("@evevault/shared/auth", () => ({
  useAuthStore: vi.fn(),
}));

const mockUseAuthStore = vi.mocked(useAuthStore);

const mockAuthState = ({
  user,
  loading,
}: {
  user: ReturnType<typeof createMockUser> | null;
  loading: boolean;
}) => {
  mockUseAuthStore.mockReturnValue({ user, loading } as ReturnType<
    typeof useAuthStore
  >);
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <RouteContextProvider>{children}</RouteContextProvider>
);

describe("RouteContextProvider", () => {
  beforeEach(() => {
    mockAuthState({ user: null, loading: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sets unauthenticated and not loading when there is no user", () => {
    const { result } = renderHook(() => useRouteContext(), { wrapper });

    expect(result.current).toEqual({
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it("sets authenticated and not loading when there is a user", () => {
    mockAuthState({ user: createMockUser(), loading: false });

    const { result } = renderHook(() => useRouteContext(), { wrapper });

    expect(result.current).toEqual({
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it("sets unauthenticated and loading when auth is loading without a user", () => {
    mockAuthState({ user: null, loading: true });

    const { result } = renderHook(() => useRouteContext(), { wrapper });

    expect(result.current).toEqual({
      isAuthenticated: false,
      isLoading: true,
    });
  });

  it("sets authenticated and loading during a refresh with a user", () => {
    mockAuthState({ user: createMockUser(), loading: true });

    const { result } = renderHook(() => useRouteContext(), { wrapper });

    expect(result.current).toEqual({
      isAuthenticated: true,
      isLoading: true,
    });
  });

  it("renders children without crashing", () => {
    render(
      <RouteContextProvider>
        <span data-testid="child">Child</span>
      </RouteContextProvider>,
    );

    expect(screen.getByTestId("child")).not.toBeNull();
  });
});

describe("useRouteContext", () => {
  beforeEach(() => {
    mockAuthState({ user: null, loading: false });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("throws when called outside the provider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(() => renderHook(() => useRouteContext())).toThrow(
      "useRouteContext must be used within RouteContextProvider",
    );

    consoleError.mockRestore();
  });

  it("returns the provider's computed context value end-to-end", () => {
    mockAuthState({ user: createMockUser(), loading: true });

    const { result } = renderHook(() => useRouteContext(), { wrapper });

    expect(result.current).toEqual({
      isAuthenticated: true,
      isLoading: true,
    });
  });
});
