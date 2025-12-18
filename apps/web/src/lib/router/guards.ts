import { useAuthStore, waitForAuthHydration } from "@evevault/shared/auth";
import { redirect } from "@tanstack/react-router";

/**
 * Route guard to protect authenticated routes
 * Redirects to login if user is not authenticated
 * Preserves the intended destination for redirect after login
 */
export async function requireAuth() {
  await waitForAuthHydration(); // TODO(dev-auth): remove when real login is available

  const user = useAuthStore.getState().user;

  if (!user) {
    const currentPath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/";

    // Store redirect path in sessionStorage so it persists through OAuth flow
    if (typeof window !== "undefined") {
      sessionStorage.setItem("evevault_redirect_after_login", currentPath);
    }

    throw redirect({
      to: "/",
      search: {
        redirect: currentPath,
      },
    });
  }

  return { user };
}
