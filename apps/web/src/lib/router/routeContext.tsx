import { useAuthStore } from "@evevault/shared/auth";
import { createContext, type ReactNode, useContext } from "react";

/**
 * Route context for shared data across routes
 * Provides access to commonly used data without prop drilling
 */
interface RouteContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
}

const RouteContext = createContext<RouteContextValue | null>(null);

export function RouteContextProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthStore();

  const value: RouteContextValue = {
    isAuthenticated: !!user,
    isLoading: loading,
  };

  return (
    <RouteContext.Provider value={value}>{children}</RouteContext.Provider>
  );
}

export function useRouteContext() {
  const context = useContext(RouteContext);
  if (!context) {
    throw new Error("useRouteContext must be used within RouteContextProvider");
  }
  return context;
}
