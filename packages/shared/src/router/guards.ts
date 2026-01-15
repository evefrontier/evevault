import { useAuthStore } from "@evevault/shared/auth";
import { redirect } from "@tanstack/react-router";

export interface RequireAuthOptions {
  /** Path to redirect to when not authenticated (default: "/") */
  redirectTo?: string;
  /** Whether to preserve the current path for redirect after login (default: false) */
  preserveRedirectPath?: boolean;
}

/**
 * Route guard to protect authenticated routes.
 * Redirects to the specified path if user is not authenticated.
 *
 * @example
 * // Simple usage (extension-style)
 * beforeLoad: () => requireAuth()
 *
 * @example
 * // With redirect path preservation (web-style)
 * beforeLoad: () => requireAuth({ preserveRedirectPath: true })
 */
export function requireAuth(options: RequireAuthOptions = {}) {
  const { redirectTo = "/", preserveRedirectPath = false } = options;

  const { user } = useAuthStore.getState();

  if (!user) {
    if (preserveRedirectPath && typeof window !== "undefined") {
      const currentPath = window.location.pathname + window.location.search;
      sessionStorage.setItem("evevault_redirect_after_login", currentPath);

      throw redirect({
        to: redirectTo,
        search: { redirect: currentPath },
      });
    }

    throw redirect({ to: redirectTo });
  }

  return { user };
}
